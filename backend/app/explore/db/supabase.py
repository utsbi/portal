from supabase import create_client, Client
from app.explore.core.config import settings

# Fail fast at startup if the service-role credentials are absent or empty.
# A missing SUPABASE_SECRET_KEY causes supabase_secret to return "" which
# makes create_client succeed but every privileged request silently operates
# as the anon role, bypassing the service-role scope the backend depends on.
if not settings.SUPABASE_URL or not settings.SUPABASE_URL.strip():
    raise RuntimeError(
        "SUPABASE_URL is not configured — set it in the environment or .env file"
    )
if not settings.supabase_secret or not settings.supabase_secret.strip():
    raise RuntimeError(
        "SUPABASE_SECRET_KEY is not configured — set it in the environment or .env file"
    )

# Initialize client with secret key (service role — bypasses RLS).
supabase: Client = create_client(settings.SUPABASE_URL, settings.supabase_secret)


def user_client(access_token: str) -> Client:
    """A PostgREST client scoped to the caller (RLS enforced) via their JWT.

    Built from the anon/publishable key so the ``apikey`` header stays the anon
    key, then ``postgrest.auth(access_token)`` overrides the ``Authorization``
    header to ``Bearer <user JWT>``. PostgREST evaluates RLS as that user
    (``auth.uid()`` resolves to the caller), so every subsequent ``.table()`` /
    ``.rpc()`` call on this client runs under the caller's RLS context.
    """
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_PUBLIC_KEY)
    client.postgrest.auth(access_token)
    return client
