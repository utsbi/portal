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
    RERANK_MODEL: Optional[str] = None
    RERANK_CANDIDATES: Optional[int] = None
    RERANK_TOP_N: Optional[int] = None

    class Config:
        env_file = ".env"
        extra = "ignore"

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
        """Get embedding model name.

        Defaults to qwen3-embedding-8b, which natively emits 4096-dim vectors
        matching the ``client_knowledge.embedding`` column and the default
        ``embedding_dimensions`` below. (The previous default,
        text-embedding-3-small, maxes out at 1536 dims and contradicted the
        4096 dimension default.)
        """
        return self.EMBEDDING_MODEL or "qwen/qwen3-embedding-8b"

    @property
    def embedding_dimensions(self) -> int:
        """Get embedding vector dimensions (must match the stored vector size)."""
        return self.EMBEDDING_DIMENSIONS or 4096

    @property
    def rerank_model(self) -> str:
        """Get the OpenRouter rerank model id (empty string disables reranking)."""
        return self.RERANK_MODEL or "cohere/rerank-4-pro"

    @property
    def rerank_candidates(self) -> int:
        """How many hybrid-search candidates to fetch before reranking."""
        return self.RERANK_CANDIDATES or 30

    @property
    def rerank_top_n(self) -> int:
        """How many reranked documents to keep for the prompt context."""
        return self.RERANK_TOP_N or 8

    @property
    def supabase_secret(self) -> str:
        """Get the Supabase secret key."""
        return self.SUPABASE_SECRET_KEY or ""

settings = Settings()
