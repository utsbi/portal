from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import StreamingResponse
import asyncio
import json
import logging
from datetime import datetime

from app.explore.schemas.chat import ChatRequest, ChatResponse, ChatMessage, SourceDocument
from app.explore.agents.explore import run_explore_agent_streaming
from app.explore.api.deps import get_current_user_id
from app.explore.services.pdf_parser import PDFParser

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/")
async def chat(request: ChatRequest, raw_request: Request, user_id: str = Depends(get_current_user_id)):
    """Chat with the Explore AI Agent via SSE streaming."""
    history = [
        {"role": msg.role, "content": msg.content}
        for msg in request.history
    ]
    attachments = [
        {"filename": att.filename, "content": att.content, "file_type": att.file_type}
        for att in request.attachments
    ]

    async def event_generator():
        try:
            async for event in run_explore_agent_streaming(
                query=request.query,
                client_id=user_id,
                history=history,
                attachments=attachments,
                model_preference=request.model_preference or "fast"
            ):
                if await raw_request.is_disconnected():
                    logger.info("Client disconnected, stopping SSE stream")
                    return

                # Strip sources if not requested
                if event.get("type") == "result" and not request.include_sources:
                    event["sources"] = []

                yield f"data: {json.dumps(event)}\n\n"

            yield "data: [DONE]\n\n"

        except asyncio.CancelledError:
            logger.info("SSE stream cancelled")
            return
        except Exception as e:
            logger.error(f"SSE stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

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
async def extract_file_text(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """Extract text from file without adding to database.

    Supports PDF, DOCX, DOC, and TXT files.
    Returns the extracted text content for session-only use.
    """
    try:
        file_bytes = await file.read()
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

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to extract text from file: {str(e)}"
        )
