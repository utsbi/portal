from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class ChatMessage(BaseModel):
    """A single message in the chat history."""
    role: str = Field(..., description="Role of the message sender: 'user' or 'assistant'")
    content: str = Field(..., description="Content of the message")
    timestamp: Optional[datetime] = Field(default=None, description="When the message was sent")


class AttachmentFile(BaseModel):
    """A temporary file attachment for the current chat session."""
    filename: str = Field(..., description="Name of the uploaded file")
    content: str = Field(..., description="Extracted text content from the file")
    file_type: str = Field(default="pdf", description="Type of file: pdf, doc, txt, etc.")


class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""
    query: str = Field(..., max_length=8000, description="The user's question or request")
    history: List[ChatMessage] = Field(default=[], max_length=50, description="Previous messages in the conversation")
    attachments: List[AttachmentFile] = Field(default=[], max_length=10, description="Temporary file attachments for this session")
    include_sources: bool = Field(default=True, description="Whether to include source documents in response")
    model_preference: Optional[str] = Field(
        default=None,
        description="LLM model preference: 'fast' for speed, 'thinking' for complex reasoning"
    )
    project_id: Optional[int] = Field(
        default=None,
        description=(
            "The caller's active project. Live-data tools are narrowed to this "
            "project after membership is verified server-side; an id the caller "
            "is not a member of yields no data. Omit to use all of the caller's "
            "projects."
        ),
    )


class SourceDocument(BaseModel):
    """A source document used to generate the response."""
    content: str = Field(..., description="Relevant excerpt from the source")
    filename: str = Field(..., description="Name of the source file")
    page_number: Optional[int] = Field(default=None, description="Page number if applicable")
    relevance_score: Optional[float] = Field(default=None, description="Similarity score 0-1")


class ChatResponse(BaseModel):
    """Response from the chat endpoint."""
    answer: str = Field(..., description="The AI-generated response")
    sources: List[SourceDocument] = Field(default=[], description="Source documents used")
    timestamp: datetime = Field(default_factory=datetime.now, description="Response timestamp")