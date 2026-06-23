import logging
from dataclasses import dataclass
from typing import Optional, Tuple
from fastapi import HTTPException, status, Header
from app.explore.db.supabase import supabase

logger = logging.getLogger("security")


@dataclass(frozen=True)
class AuthContext:
    """The verified caller identity plus the validated bearer token.

    ``access_token`` is the same bearer that ``supabase.auth.get_user`` just
    validated; it is used to build an RLS-scoped PostgREST client so live-data
    queries run under the caller's row-level-security context.
    """

    user_id: str
    access_token: str


def _validate_bearer(authorization: Optional[str]) -> Tuple[str, str]:
    """Validate the bearer token and return ``(user_id, access_token)``.

    Raises 401 on a missing/malformed header or an invalid/expired token. This
    is the single source of token validation shared by every auth dependency.
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
        logger.warning("Auth failure: token validation raised an exception")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    if not user_response or not user_response.user:
        logger.warning("Auth failure: token validated but no user returned")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    uid = user_response.user.id
    if not uid or not uid.strip():
        # An empty/blank id is not a usable identity: every downstream query
        # scopes on it (profiles.uid == id, client_knowledge.uid == id), so a
        # blank id would silently widen scope to "rows with a blank owner".
        logger.warning("Auth failure: token resolved to an empty/blank user id")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    return uid, token


async def get_current_user_id(authorization: Optional[str] = Header(None)) -> str:
    """Resolve the authenticated user ID from the Supabase access token.

    Requires a valid ``Authorization: Bearer <token>`` header and raises 401
    otherwise. The Next.js proxy always forwards the caller's Supabase token
    (see frontend/app/api/chat/route.ts), so there is no anonymous path.
    """
    user_id, _ = _validate_bearer(authorization)
    return user_id


async def get_auth_context(authorization: Optional[str] = Header(None)) -> AuthContext:
    """Resolve the caller's ``user_id`` AND the validated ``access_token``.

    Uses the same validation as ``get_current_user_id``. The returned token is
    needed to build an RLS-scoped client so live-data queries run under the
    caller's row-level-security context (defense-in-depth alongside the
    backend's manual ``project_id`` scoping).
    """
    user_id, access_token = _validate_bearer(authorization)
    return AuthContext(user_id=user_id, access_token=access_token)


async def get_optional_user_id(
    authorization: Optional[str] = Header(None),
) -> Optional[str]:
    """User ID when a valid token is present, otherwise ``None`` (no error)."""
    try:
        return await get_current_user_id(authorization)
    except HTTPException:
        return None
