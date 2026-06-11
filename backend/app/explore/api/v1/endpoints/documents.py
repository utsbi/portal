from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from datetime import datetime
from typing import Optional
import asyncio

from app.explore.schemas.document import DocumentUploadResponse
from app.explore.services.pdf_parser import PDFParser
from app.explore.services.rag_service import RAGService
from app.explore.api.deps import AuthContext, get_auth_context, get_current_user_id
from app.explore.db.supabase import user_client


router = APIRouter()


async def _is_project_member(access_token: str, user_id: str, project_id: int) -> bool:
    """True if the caller (uid=user_id) is a member of project_id.

    Runs under the caller's RLS context (a client built from the caller's JWT),
    so it can only observe the caller's own ``project_members`` rows.
    """
    db = user_client(access_token)

    def _query() -> bool:
        prof = (
            db.table("profiles").select("id").eq("uid", user_id).limit(1).execute()
        )
        if not prof.data:
            return False
        profile_id = prof.data[0]["id"]
        mem = (
            db.table("project_members")
            .select("project_id")
            .eq("profile_id", profile_id)
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        return bool(mem.data)

    return await asyncio.to_thread(_query)


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    project_id: Optional[int] = Form(None),
    auth: AuthContext = Depends(get_auth_context)
):
    """Upload a PDF document for RAG processing.

    ``project_id`` tags the stored chunks so ``search_documents`` retrieves
    them for that project. The caller MUST be a member of that project; an
    unauthorized ``project_id`` is rejected (not silently dropped) so a caller
    can't tag uploads into a project they don't belong to.
    """
    user_id = auth.user_id

    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported at this time"
        )

    # Authorization: a project_id may only be set by a member of that project.
    # Verified under the caller's RLS context (project_members only exposes the
    # caller's own memberships), so a non-member's project_id is rejected.
    if project_id is not None:
        if not await _is_project_member(auth.access_token, user_id, project_id):
            raise HTTPException(
                status_code=403,
                detail="You are not a member of the specified project."
            )

    try:
        file_bytes = await file.read()
        
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing document: {str(e)}"
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
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error listing documents: {str(e)}"
        )
