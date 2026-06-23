from slowapi import Limiter
from slowapi.util import get_remote_address


def _user_or_ip_key(request) -> str:
    """Rate-limit bucket key: the authenticated user when a Bearer token is
    present, otherwise the remote address.

    Every authenticated caller arrives through the single Next.js proxy, so they
    all share one source IP — keying on IP alone would make the limit a global
    throttle shared across tenants. Deriving the key from the Bearer credential
    instead gives each user their own bucket. Unauthenticated requests (no/blank
    Bearer) fall back to the remote address.
    """
    authorization = request.headers.get("Authorization") or request.headers.get(
        "authorization"
    )
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if token:
            return f"user:{token}"
    return get_remote_address(request)


limiter = Limiter(key_func=_user_or_ip_key)
