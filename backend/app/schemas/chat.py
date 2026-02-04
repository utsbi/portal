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
    query: str = Field(..., description="The user's question or request")
    history: List[ChatMessage] = Field(default=[], description="Previous messages in the conversation")
    attachments: List[AttachmentFile] = Field(default=[], description="Temporary file attachments for this session")
    include_sources: bool = Field(default=True, description="Whether to include source documents in response")
    model_preference: Optional[str] = Field(
        default=None, 
        description="LLM model preference: 'flash' for speed, 'thinking' for complex reasoning"
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