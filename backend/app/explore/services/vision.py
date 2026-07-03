"""Image → text extraction via a vision-capable model.

The chat models (DeepSeek v4, text-only) can't see images, so a pasted or
attached image is transcribed ONCE here, at attach time, by ``VISION_MODEL``.
The resulting text then flows through the standard text-attachment pipeline
unchanged — content-addressed storage, prompt injection, save-to-knowledge —
and no other part of the system needs to know images exist.
"""

import base64
import logging

from openai import AsyncOpenAI

from app.explore.core.config import settings

logger = logging.getLogger(__name__)

# Kept deliberately extraction-flavored: the transcript stands in for the image
# in a text-only prompt, so verbatim text + data-bearing structure matter and
# stylistic commentary does not.
_TRANSCRIBE_PROMPT = (
    "Transcribe this image so it can stand in for the image itself as context "
    "in a project-management conversation. Extract ALL visible text verbatim "
    "(render tables as markdown tables). Then, only if they carry meaning "
    "beyond the text, briefly describe charts, diagrams, photos, or layout. "
    "Output only the transcription/description — no preamble."
)

# Bounds a runaway transcription; ~4k tokens comfortably covers a dense
# document screenshot while staying far below the 20k-char attachment cap.
_MAX_TOKENS = 4000


class VisionDisabledError(RuntimeError):
    """Raised when image attachments are turned off (VISION_MODEL='')."""


async def extract_image_text(file_bytes: bytes, content_type: str) -> str:
    """Return a text transcription/description of an image, or raise.

    ``content_type`` must be an ``image/*`` MIME type — it is embedded in the
    data URL the vision model receives.
    """
    if not settings.vision_model:
        raise VisionDisabledError("Image attachments are not enabled")

    client = AsyncOpenAI(
        api_key=settings.api_key,
        base_url="https://openrouter.ai/api/v1",
    )
    data_url = (
        f"data:{content_type};base64,{base64.b64encode(file_bytes).decode()}"
    )
    resp = await client.chat.completions.create(
        model=settings.vision_model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _TRANSCRIBE_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        max_tokens=_MAX_TOKENS,
    )
    content = (resp.choices[0].message.content or "").strip() if resp.choices else ""
    logger.info(
        "Vision transcription: model=%s, %d bytes in, %d chars out",
        settings.vision_model,
        len(file_bytes),
        len(content),
    )
    return content
