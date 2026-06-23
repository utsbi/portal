"""Tests for app.explore.schemas.chat — ChatRequest validation."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.explore.schemas.chat import AttachmentFile, ChatMessage, ChatRequest


# ---------------------------------------------------------------------------
# ChatRequest — query field
# ---------------------------------------------------------------------------

class TestChatRequestQuery:
    def test_valid_query_accepted(self):
        req = ChatRequest(query="What is the project status?")
        assert req.query == "What is the project status?"

    def test_query_at_max_length_accepted(self):
        req = ChatRequest(query="a" * 8000)
        assert len(req.query) == 8000

    def test_query_over_max_length_rejected(self):
        with pytest.raises(ValidationError) as exc_info:
            ChatRequest(query="a" * 8001)
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("query",) for e in errors)

    def test_query_required(self):
        with pytest.raises(ValidationError):
            ChatRequest()  # type: ignore[call-arg]


# ---------------------------------------------------------------------------
# ChatRequest — history field
# ---------------------------------------------------------------------------

class TestChatRequestHistory:
    def test_history_defaults_to_empty(self):
        req = ChatRequest(query="hello")
        assert req.history == []

    def test_history_at_max_length_accepted(self):
        msgs = [
            ChatMessage(role="user", content=f"msg {i}") for i in range(50)
        ]
        req = ChatRequest(query="hello", history=msgs)
        assert len(req.history) == 50

    def test_history_over_max_length_rejected(self):
        msgs = [
            ChatMessage(role="user", content=f"msg {i}") for i in range(51)
        ]
        with pytest.raises(ValidationError) as exc_info:
            ChatRequest(query="hello", history=msgs)
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("history",) for e in errors)

    def test_history_message_role_and_content(self):
        msg = ChatMessage(role="assistant", content="I can help.")
        assert msg.role == "assistant"
        assert msg.content == "I can help."

    def test_history_message_timestamp_optional(self):
        msg = ChatMessage(role="user", content="hi")
        assert msg.timestamp is None


# ---------------------------------------------------------------------------
# ChatRequest — attachments field
# ---------------------------------------------------------------------------

class TestChatRequestAttachments:
    def test_attachments_defaults_to_empty(self):
        req = ChatRequest(query="hello")
        assert req.attachments == []

    def test_attachments_at_max_length_accepted(self):
        atts = [
            AttachmentFile(filename=f"file{i}.pdf", content="text", file_type="pdf")
            for i in range(10)
        ]
        req = ChatRequest(query="hello", attachments=atts)
        assert len(req.attachments) == 10

    def test_attachments_over_max_length_rejected(self):
        atts = [
            AttachmentFile(filename=f"file{i}.pdf", content="text", file_type="pdf")
            for i in range(11)
        ]
        with pytest.raises(ValidationError) as exc_info:
            ChatRequest(query="hello", attachments=atts)
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("attachments",) for e in errors)

    def test_attachment_file_type_defaults_to_pdf(self):
        att = AttachmentFile(filename="doc.pdf", content="text content")
        assert att.file_type == "pdf"


# ---------------------------------------------------------------------------
# ChatRequest — optional fields
# ---------------------------------------------------------------------------

class TestChatRequestOptionals:
    def test_include_sources_defaults_true(self):
        req = ChatRequest(query="hello")
        assert req.include_sources is True

    def test_model_preference_defaults_none(self):
        req = ChatRequest(query="hello")
        assert req.model_preference is None

    def test_model_preference_fast(self):
        req = ChatRequest(query="hello", model_preference="fast")
        assert req.model_preference == "fast"

    def test_model_preference_thinking(self):
        req = ChatRequest(query="hello", model_preference="thinking")
        assert req.model_preference == "thinking"

    def test_project_id_defaults_none(self):
        req = ChatRequest(query="hello")
        assert req.project_id is None

    def test_project_id_set(self):
        req = ChatRequest(query="hello", project_id=42)
        assert req.project_id == 42

    def test_valid_full_payload(self):
        """A fully-populated valid ChatRequest must not raise."""
        req = ChatRequest(
            query="What is the roof R-value?",
            history=[ChatMessage(role="user", content="Hi"), ChatMessage(role="assistant", content="Hello")],
            attachments=[AttachmentFile(filename="spec.pdf", content="R-30", file_type="pdf")],
            include_sources=True,
            model_preference="thinking",
            project_id=7,
        )
        assert req.project_id == 7
        assert len(req.history) == 2
        assert len(req.attachments) == 1
