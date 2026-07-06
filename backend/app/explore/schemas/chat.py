from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import List, Optional
from datetime import datetime

# Per-field character cap for attacker-controlled free text that feeds straight
# into the LLM prompt context. 100_000 chars (~25k tokens) is generous for any
# single extracted document or history turn while stopping a single multi-MB
# field from bypassing the query cap and amplifying token cost / memory.
_MAX_FIELD_CHARS = 100_000
# Image attachments carry a base64 ``data:`` URL, not prompt text — they are sent
# to the model as pixels and never injected into the text context, so the text
# amplification risk does not apply. Their ceiling is sized to the 10 MB upload
# cap (~13.4 MB of base64 plus the data-URL prefix).
_MAX_IMAGE_CHARS = 14_000_000
# Aggregate cap across the whole request (query + every history/non-image
# attachment body), so the item-count caps (history<=50, attachments<=10) can't
# be multiplied into a multi-MB payload. ~2 MB of text is far beyond any
# legitimate chat request.
_MAX_TOTAL_CHARS = 2_000_000
# Aggregate image budget for a request (sum of base64 chars). Bounds a turn to a
# couple of full-size images without letting them inflate the text total above.
_MAX_TOTAL_IMAGE_CHARS = 28_000_000


class ChatMessage(BaseModel):
    """A single message in the chat history."""
    role: str = Field(..., description="Role of the message sender: 'user' or 'assistant'")
    content: str = Field(..., max_length=_MAX_FIELD_CHARS, description="Content of the message")
    timestamp: Optional[datetime] = Field(default=None, description="When the message was sent")
    images: List[str] = Field(
        default=[],
        max_length=10,
        description="Base64 data: URLs for images attached to this user turn, "
        "re-sent so multimodal models keep visual context across turns",
    )

    @model_validator(mode="after")
    def _bound_images(self) -> "ChatMessage":
        for url in self.images:
            if not url.startswith("data:image/"):
                raise ValueError("history image must be a data:image/ URL")
            if len(url) > _MAX_IMAGE_CHARS:
                raise ValueError(
                    f"history image exceeds {_MAX_IMAGE_CHARS} characters"
                )
        return self


class AttachmentFile(BaseModel):
    """A temporary file attachment for the current chat session."""
    filename: str = Field(..., description="Name of the uploaded file")
    content: str = Field(..., description="Attachment body: extracted text, or a base64 data: URL for images")
    file_type: str = Field(default="pdf", description="Type of file: pdf, doc, txt, image, etc.")

    @model_validator(mode="after")
    def _bound_content(self) -> "AttachmentFile":
        """Cap ``content`` by kind: image data URLs get a large (upload-sized)
        ceiling since they are sent to the model as pixels, not prompt text;
        everything else keeps the tight text cap that guards prompt-injection
        amplification."""
        if self.file_type == "image":
            if not self.content.startswith("data:image/"):
                raise ValueError("image attachment content must be a data:image/ URL")
            if len(self.content) > _MAX_IMAGE_CHARS:
                raise ValueError(
                    f"image attachment exceeds {_MAX_IMAGE_CHARS} characters"
                )
        elif len(self.content) > _MAX_FIELD_CHARS:
            raise ValueError(
                f"attachment content exceeds {_MAX_FIELD_CHARS} characters"
            )
        return self


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
        non-image attachment body) exceeds the aggregate text cap, or whose
        combined image data exceeds the separate image cap, so neither can be
        multiplied into an oversized payload."""
        text_total = len(self.query)
        text_total += sum(len(m.content) for m in self.history)
        image_total = 0
        for m in self.history:
            image_total += sum(len(u) for u in m.images)
        for a in self.attachments:
            if a.file_type == "image":
                image_total += len(a.content)
            else:
                text_total += len(a.content)
        if text_total > _MAX_TOTAL_CHARS:
            raise ValueError(
                f"total request text exceeds {_MAX_TOTAL_CHARS} characters"
            )
        if image_total > _MAX_TOTAL_IMAGE_CHARS:
            raise ValueError(
                f"total request image data exceeds {_MAX_TOTAL_IMAGE_CHARS} characters"
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