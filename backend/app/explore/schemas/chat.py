from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Optional
from datetime import datetime

# Per-field character cap for attacker-controlled free text that feeds straight
# into the LLM prompt context. 100_000 chars (~25k tokens) is generous for any
# single extracted document or history turn while stopping a single multi-MB
# field from bypassing the query cap and amplifying token cost / memory.
_MAX_FIELD_CHARS = 100_000
# Aggregate cap across the whole request (query + every history/attachment body),
# so the item-count caps (history<=50, attachments<=10) can't be multiplied into
# a multi-MB payload. ~2 MB of text is far beyond any legitimate chat request.
_MAX_TOTAL_CHARS = 2_000_000


class ChatMessage(BaseModel):
    """A single message in the chat history."""
    role: str = Field(..., description="Role of the message sender: 'user' or 'assistant'")
    content: str = Field(..., max_length=_MAX_FIELD_CHARS, description="Content of the message")
    timestamp: Optional[datetime] = Field(default=None, description="When the message was sent")


class AttachmentFile(BaseModel):
    """A temporary file attachment for the current chat session."""
    filename: str = Field(..., description="Name of the uploaded file")
    content: str = Field(..., max_length=_MAX_FIELD_CHARS, description="Extracted text content from the file")
    file_type: str = Field(default="pdf", description="Type of file: pdf, doc, txt, etc.")


class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""

    # Reject unknown fields (422) rather than silently dropping them, so a typo'd
    # security-relevant field (e.g. 'include_source' vs 'include_sources') or
    # client/contract drift surfaces instead of failing open. The Next.js proxy
    # only ever sends the fields declared below (see frontend/app/api/chat/
    # route.ts), so this is non-breaking for legitimate payloads.
    model_config = ConfigDict(extra="forbid")

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

    @model_validator(mode="after")
    def _bound_total_payload(self) -> "ChatRequest":
        """Reject a request whose combined free-text (query + every history and
        attachment body) exceeds the aggregate cap, so the per-item caps can't be
        multiplied into a multi-MB prompt."""
        total = len(self.query)
        total += sum(len(m.content) for m in self.history)
        total += sum(len(a.content) for a in self.attachments)
        if total > _MAX_TOTAL_CHARS:
            raise ValueError(
                f"total request text exceeds {_MAX_TOTAL_CHARS} characters"
            )
        return self


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