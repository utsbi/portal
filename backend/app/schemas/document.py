from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class DocumentMetadata(BaseModel):
    """Metadata associated with a document."""
    filename: str = Field(..., description="Original filename")
    page_number: Optional[int] = Field(default=None, description="Page number within the document")
    upload_date: Optional[str] = Field(default=None, description="ISO format upload timestamp")
    total_pages: Optional[int] = Field(default=None, description="Total pages in the original document")
    file_type: str = Field(default="pdf", description="Type of document")


class DocumentChunk(BaseModel):
    """A chunk of document content for vector storage."""
    content: str = Field(..., description="Text content of the chunk")
    metadata: DocumentMetadata = Field(..., description="Associated metadata")
    embedding: Optional[List[float]] = Field(default=None, description="Vector embedding")


class DocumentUploadResponse(BaseModel):
    """Response from document upload endpoint."""
    success: bool = Field(..., description="Whether upload was successful")
    message: str = Field(..., description="Status message")
    document_ids: List[str] = Field(default=[], description="IDs of created document chunks")
    chunks_created: int = Field(default=0, description="Number of chunks created")


class DocumentListItem(BaseModel):
    """A document in the list response."""
    filename: str = Field(..., description="Name of the file")
    upload_date: Optional[str] = Field(default=None, description="When the document was uploaded")
    total_pages: Optional[int] = Field(default=None, description="Number of pages")
    chunk_count: Optional[int] = Field(default=None, description="Number of chunks stored")


class DocumentListResponse(BaseModel):
    """Response from document list endpoint."""
    documents: List[DocumentListItem] = Field(default=[], description="List of documents")
    count: int = Field(..., description="Total number of documents")


class SearchResult(BaseModel):
    """A search result from the RAG service."""
    id: int = Field(..., description="Document chunk ID")
    content: str = Field(..., description="Text content of the chunk")
    metadata: Dict[str, Any] = Field(default={}, description="Document metadata")
    similarity_score: float = Field(..., description="Similarity score 0-1")
