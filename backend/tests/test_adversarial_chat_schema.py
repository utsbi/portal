"""Adversarial tests for ChatRequest payload bounds (schemas/chat.py).

REQUIREMENT derived first: an authenticated chat request is attacker-controlled
input. ``query`` is capped at 8000 chars and the list lengths are capped (history
<=50, attachments <=10) — but the TOTAL payload must also be bounded, because the
attachment ``content`` and history ``content`` strings feed straight into the LLM
prompt context (rag_service.build_context_string) and into memory. Without a
per-field/total byte bound, a single request with 10 multi-megabyte attachments
(within the item-count cap) or huge history entries is accepted — a token-cost /
memory amplification DoS.

These tests assert the *bound that should exist*. Where the implementation has no
such bound (a real gap), the test is xfail(strict=False) with a BUG reason.
"""

from __future__ import annotations

import pytest

from app.explore.schemas.chat import ChatRequest

# A single ~5 MB string — comfortably within the 8000-char query cap's spirit but
# applied to fields that have NO length cap.
_BIG = "A" * 5_000_000


class TestUnboundedAttachmentContent:
    def test_single_attachment_content_should_be_bounded(self):
        # If a per-field cap existed, constructing this would raise.
        with pytest.raises(Exception):
            ChatRequest.model_validate(
                {
                    "query": "hi",
                    "attachments": [
                        {"filename": "f.txt", "content": _BIG, "file_type": "txt"}
                    ],
                }
            )

    def test_total_attachment_payload_should_be_bounded(self):
        chunk = "B" * 2_000_000  # ~2 MB each x 10 = ~20 MB total
        with pytest.raises(Exception):
            ChatRequest.model_validate(
                {
                    "query": "hi",
                    "attachments": [
                        {
                            "filename": f"f{i}.txt",
                            "content": chunk,
                            "file_type": "txt",
                        }
                        for i in range(10)
                    ],
                }
            )


class TestUnboundedHistoryContent:
    def test_history_entry_content_should_be_bounded(self):
        with pytest.raises(Exception):
            ChatRequest.model_validate(
                {
                    "query": "hi",
                    "history": [{"role": "user", "content": _BIG}],
                }
            )


class TestQueryCapHoldsAtBoundary:
    """The one bound that DOES exist (query max_length=8000) must hold. These
    should pass and prove the boundary."""

    def test_query_at_8000_chars_accepted(self):
        req = ChatRequest(query="x" * 8000)
        assert len(req.query) == 8000

    def test_query_over_8000_chars_rejected(self):
        with pytest.raises(Exception):
            ChatRequest(query="x" * 8001)

    def test_query_length_counts_characters_not_bytes(self):
        """max_length on a str counts CHARACTERS. A 4001-char string of 4-byte
        astral-plane emoji is ~16 KB of UTF-8 yet under the 8000-char cap — a
        byte-budget the char cap does not constrain. Documents that the cap is a
        char cap, not a byte cap (relevant for downstream memory/token sizing)."""
        emoji = "\U0001f600"  # 1 code point, 4 UTF-8 bytes
        s = emoji * 4001
        req = ChatRequest(query=s)
        assert len(req.query) == 4001
        assert len(req.query.encode("utf-8")) == 4001 * 4  # ~16 KB, cap unaware


class TestListItemCaps:
    def test_attachments_over_10_items_rejected(self):
        with pytest.raises(Exception):
            ChatRequest.model_validate(
                {
                    "query": "hi",
                    "attachments": [
                        {"filename": f"f{i}", "content": "x", "file_type": "txt"}
                        for i in range(11)
                    ],
                }
            )

    def test_history_over_50_items_rejected(self):
        with pytest.raises(Exception):
            ChatRequest.model_validate(
                {
                    "query": "hi",
                    "history": [{"role": "user", "content": "x"} for _ in range(51)],
                }
            )


class TestExtraFieldsSilentlyIgnored:
    def test_unknown_field_is_rejected(self):
        with pytest.raises(Exception):
            ChatRequest.model_validate(
                {
                    "query": "hi",
                    "include_source": False,
                    "totally_unknown": "x",
                }
            )
