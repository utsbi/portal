from fastapi import APIRouter
#from app.api.v1.endpoints import chat, documents
from app.api.v1.endpoints import calendar
from app.explore.api.v1.endpoints import chat, documents


router = APIRouter(prefix="/v1")

#router.include_router(chat.router, prefix="/chat", tags=["chat"])
#router.include_router(documents.router, prefix="/documents", tags=["documents"])
router.include_router(calendar.router)
