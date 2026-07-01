import logging
import posixpath
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime
import asyncio

from app.explore.schemas.document import DocumentUploadResponse
from app.explore.services.pdf_parser import PDFParser, extract_text, is_extractable
from app.explore.services.rag_service import RAGService
from app.explore.services.membership import is_project_member
from app.explore.api.deps import AuthContext, get_auth_context, get_current_user_id
from app.explore.core.limiter import limiter
from app.explore.core.uploads import parse_content_length, read_capped
from app.explore.db.supabase import user_client, supabase

logger = logging.getLogger(__name__)

router = APIRouter()

# Supabase Storage bucket that backs the Document Portal "Files" UI.
_FILES_BUCKET = "Files"


def _safe_storage_key(project_id: int, storage_path: str) -> str:
    """Build the service-role storage key ``{project_id}/{storage_path}`` after
    proving ``storage_path`` (client-controlled) cannot escape the project prefix.

    Rejects (HTTP 400) traversal sequences (``..``), leading slashes/backslashes,
    NUL bytes, and any value that — once normalized and joined — does not remain
    strictly under ``{project_id}/``. This is the only gate stopping a director of
    one project from reaching another project's storage objects, since the
    download runs as the service role (no RLS).
    """
    if (
        not storage_path
        or "\x00" in storage_path
        or "\\" in storage_path
        or storage_path.startswith("/")
        or ".." in storage_path.split("/")
    ):
        raise HTTPException(status_code=400, detail="Invalid storage path")

    prefix = f"{project_id}/"
    key = f"{prefix}{storage_path}"
    # Normalize and re-assert the prefix as defence-in-depth against any escape
    # the explicit checks above missed.
    normalized = posixpath.normpath(key)
    if normalized != key or not normalized.startswith(prefix):
        raise HTTPException(status_code=400, detail="Invalid storage path")

    return key


class IndexFileRequest(BaseModel):
    """Index (or re-index) a Document Portal file into the project's RAG corpus."""

    project_id: int = Field(..., description="Project the file belongs to")
    storage_path: str = Field(
        ..., description="Project-relative path of the file in the 'Files' bucket"
    )


class ByFileRequest(BaseModel):
    """Address a single Document Portal file by its project + storage path."""

    project_id: int = Field(..., description="Project the file belongs to")
    storage_path: str = Field(
        ..., description="Project-relative path of the file in the 'Files' bucket"
    )


async def _ensure_director_member(auth: AuthContext, project_id: int) -> None:
    """Authorize a knowledge-mutating call: director AND member of ``project_id``.

    Mirrors ``/upload``: the membership check stops cross-project tagging and the
    director gate stops any plain member from mutating the corpus. Both run under
    the caller's RLS context; the actual writes run as the service role (no RLS),
    so this explicit check is the only gate.
    """
    db = user_client(auth.access_token)
    if not await is_project_member(db, auth.user_id, project_id):
        raise HTTPException(
            status_code=403,
            detail="You are not a member of the specified project.",
        )
    if not await _is_director(db, auth.user_id):
        raise HTTPException(
            status_code=403,
            detail="Only directors can manage knowledge documents.",
        )


async def _is_director(db, user_id: str) -> bool:
    """True if the caller's ``profiles.role`` is ``director``.

    Runs under the caller's RLS context (``db`` is built from the caller's JWT),
    so it only ever reads the caller's own profile row.
    """

    def _query() -> bool:
        prof = (
            db.table("profiles")
            .select("role")
            .eq("uid", user_id)
            .limit(1)
            .execute()
        )
        return bool(prof.data) and prof.data[0].get("role") == "director"

    return await asyncio.to_thread(_query)


@router.post("/upload", response_model=DocumentUploadResponse)
@limiter.limit("10/minute")
async def upload_document(
    request: Request,
    file: UploadFile = File(...),
    project_id: int = Form(...),
    auth: AuthContext = Depends(get_auth_context),
):
    """Upload a PDF document for RAG processing.

    ``project_id`` is required and tags the stored chunks so ``search_documents``
    retrieves them for that project. The caller MUST be a director AND a member
    of that project: membership stops cross-project tagging, and the director
    gate stops any project member from injecting corpus documents (the insert
    runs as the service role, bypassing RLS, so the check must be explicit).
    """
    # Enforce upload size cap via Content-Length header first (fast path),
    # then bound the actual read so an oversize body is never fully buffered.
    parse_content_length(request)

    user_id = auth.user_id

    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported at this time"
        )

    # Authorization, under the caller's RLS context (a client built from the
    # caller's JWT, so it only observes the caller's own rows):
    #   1. The caller must be a member of project_id (no cross-project tagging).
    #   2. The caller must be a director (the directors-only corpus, enforced
    #      here because store_document inserts via the service role / no RLS).
    db = user_client(auth.access_token)
    if not await is_project_member(db, user_id, project_id):
        raise HTTPException(
            status_code=403,
            detail="You are not a member of the specified project."
        )
    if not await _is_director(db, user_id):
        raise HTTPException(
            status_code=403,
            detail="Only directors can upload knowledge documents."
        )

    try:
        file_bytes = await read_capped(file)

        pdf_parser = PDFParser()
        pages_data = pdf_parser.extract_text_with_metadata(
            file_bytes=file_bytes,
            filename=file.filename
        )

        if not pages_data:
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted from the PDF"
            )

        rag_service = RAGService()
        all_document_ids = []

        for page_data in pages_data:
            page_data["metadata"]["upload_date"] = datetime.now().isoformat()

            doc_ids = await rag_service.store_document(
                content=page_data["content"],
                metadata=page_data["metadata"],
                client_id=user_id,
                project_id=project_id
            )
            all_document_ids.extend(doc_ids)

        return DocumentUploadResponse(
            success=True,
            message=f"Successfully uploaded {file.filename}",
            document_ids=[str(id) for id in all_document_ids],
            chunks_created=len(all_document_ids)
        )

    except HTTPException:
        raise
    except Exception:
        logger.error("Error processing document upload", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error processing document"
        )


@router.get("/list")
async def list_documents(user_id: str = Depends(get_current_user_id), limit: int = 50):
    """List all documents for the current user."""
    try:
        from app.explore.db.supabase import supabase

        result = supabase.table("client_knowledge") \
            .select("metadata") \
            .eq("uid", user_id) \
            .limit(limit) \
            .execute()

        documents = {}
        for doc in result.data:
            metadata = doc.get("metadata", {})
            filename = metadata.get("filename")
            if filename and filename not in documents:
                documents[filename] = metadata

        return {
            "documents": list(documents.values()),
            "count": len(documents)
        }

    except Exception:
        logger.error("Error listing documents", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error listing documents"
        )


@router.post("/knowledge/index-file")
async def index_file(
    body: IndexFileRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """Index a Document Portal file into the project's RAG corpus.

    Downloads ``{project_id}/{storage_path}`` from the "Files" storage bucket via
    the service client, extracts its text by extension, and stores the chunks
    tagged ``source='portal'``. Binary/unsupported types are NOT errors — they
    return ``{"indexed": false, "reason": "unsupported_type"}`` (HTTP 200).

    Re-indexing a replaced file first deletes the prior ``(project_id,
    storage_path)`` rows so chunks never duplicate. Director + membership gated.
    """
    await _ensure_director_member(auth, body.project_id)

    # Reject any traversal/escaping path BEFORE touching storage (the download
    # runs as the service role, so an escaping key reads another project's data).
    absolute_path = _safe_storage_key(body.project_id, body.storage_path)

    if not is_extractable(body.storage_path):
        return {"indexed": False, "reason": "unsupported_type"}

    try:
        file_bytes = await asyncio.to_thread(
            supabase.storage.from_(_FILES_BUCKET).download, absolute_path
        )
    except Exception:
        logger.error("Could not download file from storage: %s", absolute_path, exc_info=True)
        raise HTTPException(
            status_code=404,
            detail="Could not download file from storage",
        )

    try:
        content = extract_text(file_bytes=file_bytes, filename=body.storage_path)
        if content is None:
            return {"indexed": False, "reason": "unsupported_type"}
        if not content.strip():
            return {"indexed": False, "reason": "empty"}

        # Drop any existing chunks for this file so a re-index of a replaced
        # file doesn't leave stale/duplicate chunks behind.
        supabase.table("client_knowledge") \
            .delete() \
            .eq("project_id", body.project_id) \
            .eq("storage_path", body.storage_path) \
            .execute()

        filename = body.storage_path.rsplit("/", 1)[-1]
        rag_service = RAGService()
        doc_ids = await rag_service.store_document(
            content=content,
            metadata={
                "filename": filename,
                "storage_path": body.storage_path,
                "upload_date": datetime.now().isoformat(),
            },
            client_id=auth.user_id,
            project_id=body.project_id,
            storage_path=body.storage_path,
            source="portal",
        )

        return {"indexed": True, "chunks": len(doc_ids)}

    except HTTPException:
        raise
    except Exception:
        logger.error("Error indexing file: %s", body.storage_path, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error indexing file",
        )


@router.delete("/knowledge/by-file")
async def delete_by_file(
    body: ByFileRequest,
    auth: AuthContext = Depends(get_auth_context),
):
    """Remove every indexed chunk of a Document Portal file from the corpus.

    Deletes ``client_knowledge`` rows matching ``project_id`` AND
    ``storage_path``. Director + membership gated. Returns ``{"deleted": n}``.
    """
    await _ensure_director_member(auth, body.project_id)

    # Validate the client-supplied path with the same guard as index-file so a
    # traversal/escaping value can never be used to address another project.
    _safe_storage_key(body.project_id, body.storage_path)

    try:
        result = supabase.table("client_knowledge") \
            .delete() \
            .eq("project_id", body.project_id) \
            .eq("storage_path", body.storage_path) \
            .execute()

        deleted = len(result.data) if result.data else 0
        return {"deleted": deleted}

    except Exception:
        logger.error("Error deleting file index: %s", body.storage_path, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error deleting file index",
        )


@router.get("/knowledge/indexed")
async def list_indexed_files(
    project_id: int,
    auth: AuthContext = Depends(get_auth_context),
):
    """List the distinct portal files indexed for ``project_id``.

    Returns ``[{"storage_path", "chunks"}]`` grouped by ``storage_path`` over
    rows with ``source='portal'`` — the data behind the frontend's per-file
    "indexed" badges. Membership gated (read access for any project member).
    """
    db = user_client(auth.access_token)
    if not await is_project_member(db, auth.user_id, project_id):
        raise HTTPException(
            status_code=403,
            detail="You are not a member of the specified project.",
        )

    try:
        result = supabase.table("client_knowledge") \
            .select("storage_path") \
            .eq("project_id", project_id) \
            .eq("source", "portal") \
            .execute()

        counts: dict[str, int] = {}
        for row in result.data or []:
            path = row.get("storage_path")
            if path:
                counts[path] = counts.get(path, 0) + 1

        return [
            {"storage_path": path, "chunks": chunks}
            for path, chunks in sorted(counts.items())
        ]

    except HTTPException:
        raise
    except Exception:
        logger.error("Error listing indexed files for project %s", project_id, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Error listing indexed files",
        )
