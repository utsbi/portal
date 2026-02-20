import os
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/calendar", tags=["calendar"])

#GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/v1/calendar/google/callback")

# @router.get("/google/connect")
#async def google_connect():
    # replace with the real Google OAuth URL 
  #  return JSONResponse({"ok": True, "redirect_uri": GOOGLE_REDIRECT_URI}) 

@router.get("/google/callback")
async def google_callback(request: Request):
    return JSONResponse({"ok": True, "query": dict(request.query_params)})