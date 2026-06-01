from typing import Optional
from fastapi import HTTPException, status, Header
from app.explore.db.supabase import supabase


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Resolve the authenticated user ID from the Supabase access token.

    Requires a valid ``Authorization: Bearer <token>`` header and raises 401
    otherwise. The Next.js proxy always forwards the caller's Supabase token
    (see frontend/app/api/chat/route.ts), so there is no anonymous path.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )

    try:
        user_response = supabase.auth.get_user(token)
    except Exception:
        # Don't surface GoTrue internals to the caller; log-and-generic.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if not user_response or not user_response.user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return user_response.user.id


async def get_optional_user_id(
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    """User ID when a valid token is present, otherwise ``None`` (no error)."""
    try:
        return await get_current_user_id(authorization)
    except HTTPException:
        return None
