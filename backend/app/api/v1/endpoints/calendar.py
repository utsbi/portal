import os
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/calendar", tags=["calendar"])

@router.get("/google/callback")
async def google_callback(request: Request):
    return JSONResponse({"ok": True, "query": dict(request.query_params)})