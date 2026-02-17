from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings from environment variables."""

    SUPABASE_URL: str
    SUPABASE_PUBLIC_KEY: str
    SUPABASE_SECRET_KEY: Optional[str] = None
    OPEN_ROUTER_KEY: Optional[str] = None
    THINK_MODEL: Optional[str] = None
    FAST_MODEL: Optional[str] = None
    EMBEDDING_MODEL: Optional[str] = None
    EMBEDDING_DIMENSIONS: Optional[int] = None

    class Config:
        env_file = ".env"
        extra = "allow"

    @property
    def api_key(self) -> str:
        """Get OpenRouter API key."""
        return self.OPEN_ROUTER_KEY or ""

    @property
    def think_model(self) -> str:
        """Get thinking model name."""
        return self.THINK_MODEL or ""

    @property
    def fast_model(self) -> str:
        """Get fast model name."""
        return self.FAST_MODEL or ""

    @property
    def embedding_model(self) -> str:
        """Get embedding model name."""
        return self.EMBEDDING_MODEL or "openai/text-embedding-3-small"

    @property
    def embedding_dimensions(self) -> int:
        """Get embedding vector dimensions."""
        return self.EMBEDDING_DIMENSIONS or 4096

    @property
    def supabase_secret(self) -> str:
        """Get the Supabase secret key."""
        return self.SUPABASE_SECRET_KEY or ""

settings = Settings()
