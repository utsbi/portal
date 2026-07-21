"""Shared upload-size guards for the file endpoints.

Both ``/chat/extract-text`` and ``/documents/upload`` must (a) reject a
malformed Content-Length without 500ing and (b) bound the actual body read so an
oversize upload — even one that bypassed the Content-Length fast path via chunked
transfer-encoding or a spoofed-low header — is never fully buffered into memory.
"""

from fastapi import HTTPException, Request, UploadFile

from app.explore.core.config import settings

# Chunk size for the bounded upload read. Small enough that the loop aborts an
# oversize body after at most one chunk past the cap (never the whole body).
_UPLOAD_CHUNK_BYTES = 64 * 1024


def parse_content_length(request: Request) -> None:
    """Reject (400) a present-but-non-numeric Content-Length, and 413 if it
    already declares a body over the cap (fast path). A malformed header must
    never reach ``int()`` unguarded and surface as a 500."""
    content_length = request.headers.get("content-length")
    if content_length is None:
        return
    try:
        declared = int(content_length)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Content-Length header")
    if declared > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large")


async def read_capped(file: UploadFile) -> bytes:
    """Read ``file`` in fixed-size chunks, aborting with 413 the moment the
    cumulative size exceeds ``MAX_UPLOAD_BYTES`` — so an oversize body (even one
    that bypassed the Content-Length fast path) is never fully buffered in RAM."""
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(_UPLOAD_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File too large")
        chunks.append(chunk)
    return b"".join(chunks)
