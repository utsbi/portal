from supabase import create_client, Client
from app.explore.core.config import settings


# Initialize client with secret key (service role — bypasses RLS).
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.supabase_secret
)


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
