import base64
import json

from slowapi import Limiter
from slowapi.util import get_remote_address


def _user_or_ip_key(request) -> str:
    """Rate-limit bucket key: the stable user id (JWT ``sub`` claim) when a
    Bearer JWT is present, otherwise the remote address.

    Every authenticated caller arrives through the single Next.js proxy, so they
    all share one source IP — keying on IP alone would make the limit a global
    throttle shared across tenants. Deriving the key from the stable ``sub``
    claim gives each user their own persistent bucket across token refreshes.
    Keying on the raw token string would create a new bucket on every refresh,
    making the limit trivially bypassable and leaking tokens into limiter memory.
    Unauthenticated requests (no/blank Bearer) fall back to the remote address.

    The JWT signature is NOT re-validated here — the endpoint's auth dependency
    (``get_auth_context`` / ``get_current_user_id``) already validates it before
    the route body runs. The key function only needs the stable identity.
    """
    authorization = request.headers.get("Authorization") or request.headers.get(
        "authorization"
    )
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        if token:
            try:
                parts = token.split(".")
                if len(parts) >= 2:
                    # JWT payload is base64url without padding; restore padding.
                    payload_b64 = parts[1]
                    padded = payload_b64 + "=" * (-len(payload_b64) % 4)
                    payload = json.loads(base64.urlsafe_b64decode(padded))
                    sub = payload.get("sub") or ""
                    if sub:
                        return f"user:{sub}"
            except Exception:
                pass
    return get_remote_address(request)


limiter = Limiter(key_func=_user_or_ip_key)
