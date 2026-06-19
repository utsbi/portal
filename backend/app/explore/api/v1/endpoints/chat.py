from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import StreamingResponse
import asyncio
import json
import logging
from datetime import datetime

from app.explore.schemas.chat import ChatRequest
from app.explore.agents.explore import run_explore_agent_streaming
from app.explore.api.deps import AuthContext, get_auth_context, get_current_user_id
from app.explore.core.config import settings
from app.explore.core.limiter import limiter
from app.explore.services.pdf_parser import PDFParser

logger = logging.getLogger(__name__)

router = APIRouter()

# Overall timeout (seconds) for the upstream SSE stream. Set just under the
# Next.js proxy's 300 s limit so a stalled upstream never pins the connection.
_STREAM_TIMEOUT_S = 290


@router.post("/")
@limiter.limit("20/minute")
async def chat(request: Request, body: ChatRequest, auth: AuthContext = Depends(get_auth_context)):
    """Chat with the Explore AI Agent via SSE streaming."""
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in body.history
    ]
    attachments = [
        {"filename": att.filename, "content": att.content, "file_type": att.file_type}
        for att in body.attachments
    ]

    async def event_generator():
        try:
            async with asyncio.timeout(_STREAM_TIMEOUT_S):
                async for event in run_explore_agent_streaming(
                    query=body.query,
                    client_id=auth.user_id,
                    access_token=auth.access_token,
                    project_id=body.project_id,
                    history=history,
                    attachments=attachments,
                    model_preference=body.model_preference or "fast",
                ):
                    if await request.is_disconnected():
                        logger.info("Client disconnected, stopping SSE stream")
                        return

                    # Strip sources if not requested
                    if event.get("type") == "result" and not body.include_sources:
                        event["sources"] = []

                    yield f"data: {json.dumps(event)}\n\n"

                yield "data: [DONE]\n\n"

        except TimeoutError:
            logger.warning("SSE stream timed out after %ds", _STREAM_TIMEOUT_S)
            yield f"data: {json.dumps({'type': 'error', 'message': 'Request timed out'})}\n\n"
        except asyncio.CancelledError:
            logger.info("SSE stream cancelled")
            return
        except Exception:
            # Log the full exception server-side, but never leak internals to
            # the client — return a generic error message instead.
            logger.error("SSE stream error", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': 'An internal error occurred'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/health")
async def chat_health():
    """Health check endpoint for chat service."""
    return {
        "status": "healthy",
        "service": "chat",
        "timestamp": datetime.now().isoformat()
    }


@router.post("/extract-text")
@limiter.limit("10/minute")
async def extract_file_text(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    """Extract text from file without adding to database.

    Supports PDF, DOCX, DOC, and TXT files.
    Returns the extracted text content for session-only use.
    """
    # Enforce upload size cap via Content-Length header first (fast path),
    # then verify the actual bytes read (defence-in-depth).
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large")

    try:
        file_bytes = await file.read()
        if len(file_bytes) > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File too large")

        filename = file.filename or "attachment"
        file_lower = filename.lower()

        if file_lower.endswith('.pdf'):
            # Use PDF parser for PDF files
            pdf_parser = PDFParser()
            pages = pdf_parser.extract_text_with_metadata(file_bytes, filename)
            content = "\n\n".join([p["content"] for p in pages])
            file_type = "pdf"

        elif file_lower.endswith(('.doc', '.docx')):
            # Use python-docx for DOCX files
            import docx
            import io
            doc = docx.Document(io.BytesIO(file_bytes))
            content = "\n\n".join([para.text for para in doc.paragraphs if para.text.strip()])
            file_type = "docx"

        else:
            # Plain text files
            content = file_bytes.decode('utf-8', errors='ignore')
            file_type = "txt"

        return {
            "filename": filename,
            "content": content,
            "file_type": file_type
        }

    except HTTPException:
        raise
    except Exception:
        # Log the full exception server-side; return a generic client message.
        logger.error("Failed to extract text from file", exc_info=True)
        raise HTTPException(
            status_code=400,
            detail="Failed to extract text from file"
        )
