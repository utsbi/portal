from supabase import create_client, Client
from app.core.config import settings


# Initialize client with secret key
supabase: Client = create_client(
    settings.SUPABASE_URL,
    settings.supabase_secret
)
