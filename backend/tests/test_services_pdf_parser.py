"""Tests for the zip-bomb guard in pdf_parser.

Office formats (docx, pptx, xlsx) are zip archives.  A malicious small
archive can declare a huge decompressed size and OOM the process.  The guard
reads only the Central Directory metadata (no decompression) and rejects
archives that exceed three limits:

  1. Total declared uncompressed size > _ZIP_MAX_DECOMPRESSED_BYTES
  2. Member count > _ZIP_MAX_MEMBER_COUNT
  3. Compression ratio > _ZIP_MAX_RATIO

The limits are patched to small values in these tests so we never need to
build 200 MB files in memory.
"""
from __future__ import annotations

import io
import zipfile

import pytest
from fastapi import HTTPException

import app.explore.services.pdf_parser as parser_mod
from app.explore.services.pdf_parser import _check_zip_bomb, extract_text


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_zip(
    members: list[tuple[str, bytes]],
    *,
    compress: bool = False,
) -> bytes:
    """Build an in-memory zip archive from (name, content) pairs."""
    buf = io.BytesIO()
    compression = zipfile.ZIP_DEFLATED if compress else zipfile.ZIP_STORED
    with zipfile.ZipFile(buf, "w", compression=compression) as zf:
        for name, data in members:
            zf.writestr(name, data)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# _check_zip_bomb unit tests
# ---------------------------------------------------------------------------

class TestZipBombGuardDirect:
    """Unit tests for _check_zip_bomb() in isolation."""

    def test_rejects_archive_exceeding_decompressed_cap(self, monkeypatch):
        """Declared total uncompressed size above cap → 400."""
        monkeypatch.setattr(parser_mod, "_ZIP_MAX_DECOMPRESSED_BYTES", 1024)

        # 2 KB uncompressed, stored (no compression) → file_size = 2048
        bomb = _make_zip([("payload.txt", b"x" * 2048)])

        with pytest.raises(HTTPException) as exc_info:
            _check_zip_bomb(bomb)
        assert exc_info.value.status_code == 400
        assert "decompressed size" in exc_info.value.detail

    def test_rejects_archive_exceeding_member_count(self, monkeypatch):
        """More members than _ZIP_MAX_MEMBER_COUNT → 400."""
        monkeypatch.setattr(parser_mod, "_ZIP_MAX_MEMBER_COUNT", 3)

        bomb = _make_zip([(f"{i}.txt", b"a") for i in range(4)])

        with pytest.raises(HTTPException) as exc_info:
            _check_zip_bomb(bomb)
        assert exc_info.value.status_code == 400
        assert "member count" in exc_info.value.detail

    def test_rejects_archive_exceeding_compression_ratio(self, monkeypatch):
        """Compression ratio above _ZIP_MAX_RATIO → 400."""
        monkeypatch.setattr(parser_mod, "_ZIP_MAX_RATIO", 2)

        # All-zero bytes compress extremely well; ratio will be >> 2.
        bomb = _make_zip([("payload.bin", b"\x00" * 8192)], compress=True)

        with pytest.raises(HTTPException) as exc_info:
            _check_zip_bomb(bomb)
        assert exc_info.value.status_code == 400
        assert "ratio" in exc_info.value.detail

    def test_normal_small_zip_passes_all_guards(self):
        """A legitimate small archive passes every guard without raising."""
        # Deliberately within default caps — no monkeypatching needed.
        small = _make_zip([
            ("word/document.xml", b"<w:document/>"),
            ("[Content_Types].xml", b"<Types/>"),
            ("_rels/.rels", b""),
        ])
        # Must not raise.
        _check_zip_bomb(small)

    def test_non_zip_bytes_pass_silently(self):
        """Non-zip bytes are not rejected — the Office parser handles them."""
        _check_zip_bomb(b"this is not a zip file")

    def test_empty_bytes_pass_silently(self):
        """Empty payload is not rejected by the zip guard."""
        _check_zip_bomb(b"")


# ---------------------------------------------------------------------------
# Integration: extract_text() raises 400 for zip-bomb office files
# ---------------------------------------------------------------------------

class TestExtractTextZipBombRejection:
    """Verify the guard fires through the public extract_text() dispatcher."""

    @pytest.mark.parametrize("filename", ["doc.docx", "deck.pptx", "sheet.xlsx"])
    def test_extract_text_rejects_bomb_for_all_office_formats(
        self, monkeypatch, filename
    ):
        """All three Office extensions hit the guard and return 400."""
        monkeypatch.setattr(parser_mod, "_ZIP_MAX_DECOMPRESSED_BYTES", 1024)

        bomb = _make_zip([("payload.txt", b"x" * 2048)])

        with pytest.raises(HTTPException) as exc_info:
            extract_text(bomb, filename)
        assert exc_info.value.status_code == 400

    @pytest.mark.parametrize("filename", ["doc.docx", "deck.pptx", "sheet.xlsx"])
    def test_extract_text_small_zip_passes_guard(self, monkeypatch, filename):
        """A sub-cap zip is not rejected by the guard (it may fail later for
        being an invalid Office file, but that is a distinct error path)."""
        monkeypatch.setattr(parser_mod, "_ZIP_MAX_DECOMPRESSED_BYTES", 1024)

        # 512 bytes — well under the patched 1 KB cap.
        small = _make_zip([("word/document.xml", b"a" * 512)])

        # Guard must NOT raise HTTPException.  The downstream parser may raise
        # something else (BadZipFile / ValueError / etc.) — that's fine.
        try:
            extract_text(small, filename)
        except HTTPException:
            pytest.fail("zip-bomb guard incorrectly rejected a sub-cap archive")
        except Exception:
            pass  # downstream Office parser error — acceptable
