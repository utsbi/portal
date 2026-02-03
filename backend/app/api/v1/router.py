from fastapi import APIRouter
from app.api.v1.endpoints import chat, documents


router = APIRouter(prefix="/v1")

router.include_router(chat.router, prefix="/chat", tags=["chat"])
router.include_router(documents.router, prefix="/documents", tags=["documents"])
