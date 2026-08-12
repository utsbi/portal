from typing import List, Optional, Self
from urllib.parse import urlparse

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings from environment variables."""

    SUPABASE_URL: str
    SUPABASE_PUBLIC_KEY: str
    SUPABASE_SECRET_KEY: Optional[str] = None
    OPEN_ROUTER_KEY: Optional[str] = None
    THINK_MODEL: Optional[str] = None
    FAST_MODEL: Optional[str] = None
    # OpenRouter reasoning effort for the two chat modes. DeepSeek V4 Flash
    # currently exposes low/high/max (not medium), so the fast default is low;
    # a Luna-only deployment can set FAST_REASONING_EFFORT=medium.
    FAST_REASONING_EFFORT: Optional[str] = None
    THINK_REASONING_EFFORT: Optional[str] = None
    FAST_INPUT_PRICE_PER_M: Optional[float] = None
    FAST_OUTPUT_PRICE_PER_M: Optional[float] = None
    THINK_INPUT_PRICE_PER_M: Optional[float] = None
    THINK_OUTPUT_PRICE_PER_M: Optional[float] = None
    TITLE_MODEL: Optional[str] = None
    EMBEDDING_MODEL: Optional[str] = None
    EMBEDDING_DIMENSIONS: Optional[int] = None
    RERANK_MODEL: Optional[str] = None
    RERANK_CANDIDATES: Optional[int] = None
    RERANK_TOP_N: Optional[int] = None

    # Security / hardening settings
    ENV: str = "development"
    CORS_ORIGINS: str = "http://localhost:3000"
    ALLOWED_HOSTS: str = "*"
    MAX_UPLOAD_BYTES: int = 10 * 1024 * 1024  # 10 MB

    # Base URL of the Next.js frontend (used to proxy project calendar lookups).
    PORTAL_BASE_URL: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @model_validator(mode="after")
    def validate_production_security(self) -> Self:
        """Reject development defaults when the service runs in production."""
        if self.ENV != "production":
            return self

        if not self.allowed_hosts_list or "*" in self.allowed_hosts_list:
            raise ValueError("ALLOWED_HOSTS must be explicit in production")
        if not self.cors_origins_list or "*" in self.cors_origins_list:
            raise ValueError("CORS_ORIGINS must be explicit in production")
        if any(urlparse(origin).scheme != "https" for origin in self.cors_origins_list):
            raise ValueError("CORS_ORIGINS must use HTTPS in production")

        portal_url = (self.PORTAL_BASE_URL or "").strip()
        if not portal_url:
            raise ValueError("PORTAL_BASE_URL is required in production")
        if urlparse(portal_url).scheme != "https":
            raise ValueError("PORTAL_BASE_URL must use HTTPS in production")
        return self

    @property
    def cors_origins_list(self) -> List[str]:
        """Split the comma-separated CORS_ORIGINS into a list."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def allowed_hosts_list(self) -> List[str]:
        """Split the comma-separated ALLOWED_HOSTS into a list."""
        return [h.strip() for h in self.ALLOWED_HOSTS.split(",") if h.strip()]

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
    def fast_reasoning_effort(self) -> str:
        """Reasoning effort for fast turns."""
        return self.FAST_REASONING_EFFORT or "low"

    @property
    def think_reasoning_effort(self) -> str:
        """Reasoning effort for thinking turns."""
        return self.THINK_REASONING_EFFORT or "xhigh"

    @property
    def fast_input_price_per_m(self) -> float:
        """Estimated fast-model input price in USD per million tokens."""
        return self.FAST_INPUT_PRICE_PER_M or 0.08

    @property
    def fast_output_price_per_m(self) -> float:
        """Estimated fast-model output price in USD per million tokens."""
        return self.FAST_OUTPUT_PRICE_PER_M or 0.18

    @property
    def think_input_price_per_m(self) -> float:
        """Estimated thinking-model input price in USD per million tokens."""
        return self.THINK_INPUT_PRICE_PER_M or 0.10

    @property
    def think_output_price_per_m(self) -> float:
        """Estimated thinking-model output price in USD per million tokens."""
        return self.THINK_OUTPUT_PRICE_PER_M or 0.60

    @property
    def title_model(self) -> str:
        """Model used for conversation-title generation.

        Dedicated knob so titles can run on the cheapest/fastest available
        model independently of the fast-chat path. Falls back to FAST_MODEL
        when TITLE_MODEL is unset, so existing deployments are unchanged.
        """
        return self.TITLE_MODEL or self.fast_model

    @property
    def embedding_model(self) -> str:
        """Get embedding model name.

        Defaults to qwen3-embedding-8b, requested at 1536 dims via Matryoshka
        (MRL) truncation — see ``embedding_dimensions`` below.
        """
        return self.EMBEDDING_MODEL or "qwen/qwen3-embedding-8b"

    @property
    def embedding_dimensions(self) -> int:
        """Embedding vector dimensions (must match ``client_knowledge.embedding``,
        typed ``vector(1536)``).

        1536 is qwen3-embedding-8b's native 4096 MRL-truncated + renormalized,
        which keeps the column under pgvector's 2000-dim HNSW limit so vector
        search is index-backed instead of a sequential scan. Verified 2026-07-02:
        OpenRouter honors ``dimensions=1536`` and returns unit-norm vectors
        identical (cos ≈ 0.9999) to l2_normalize(subvector(4096-dim, 1, 1536)).
        """
        return self.EMBEDDING_DIMENSIONS or 1536

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
    def portal_base_url(self) -> str:
        """Base URL of the Next.js frontend for proxied calendar lookups.

        The Explore ``get_upcoming_events`` tool forwards the caller's JWT to the
        frontend's ``/api/contact/calendar/client-events`` route, which reads
        from the native ``project_events`` table under the caller's RLS. Defaults
        to local dev.
        """
        return (self.PORTAL_BASE_URL or "http://localhost:3000").rstrip("/")

    @property
    def supabase_secret(self) -> str:
        """Get the Supabase secret key."""
        return self.SUPABASE_SECRET_KEY or ""


# BaseSettings supplies required fields from environment/settings sources at
# runtime; its generated static signature cannot express that dynamic input.
settings = Settings()  # pyright: ignore[reportCallIssue]
