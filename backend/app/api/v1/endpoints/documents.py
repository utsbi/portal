from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from typing import List
from datetime import datetime

from app.schemas.document import DocumentUploadResponse
from app.services.pdf_parser import PDFParser
from app.services.rag_service import RAGService
from app.api.deps import get_current_user_id


router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id)
):
    """Upload a PDF document for RAG processing."""
    # Validate file type
    if not file.filename.endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported at this time"
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
                client_id=user_id
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
        from app.db.supabase import supabase
        
        result = supabase.table("client_documents") \
            .select("metadata") \
            .eq("client_id", user_id) \
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
