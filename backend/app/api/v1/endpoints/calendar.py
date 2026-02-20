import os
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/calendar", tags=["calendar"])

#GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/v1/calendar/google/callback")

# @router.get("/google/connect")
#async def google_connect():
    # Placeholder for now — we’ll replace with the real Google OAuth URL next
  #  return JSONResponse({"ok": True, "redirect_uri": GOOGLE_REDIRECT_URI}) 

@router.get("/google/callback")
async def google_callback(request: Request):
    # This will receive ?code=... from Google
    return JSONResponse({"ok": True, "query": dict(request.query_params)})