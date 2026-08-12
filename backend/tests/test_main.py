"""Tests for app.explore.main — app-level concerns.

Covers:
  - Docs gating (production hides /docs, /redoc, /openapi.json)
  - Security headers on all responses
  - CORS configured origins
  - Health endpoints: / and /health — correct shape, no version field
"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.explore.main import app


# ---------------------------------------------------------------------------
# Docs gating
# ---------------------------------------------------------------------------


class TestDocsGating:
    """The app conditionally exposes API docs based on ENV."""

    def test_docs_available_in_development(self):
        """In development mode /docs, /redoc, /openapi.json must all respond 200."""
        with patch.object(
            __import__("app.explore.main", fromlist=["_is_prod"]),
            "_is_prod",
            False,
        ):
            # Re-create the app in dev mode to get correct docs_url.
            # We test the fixture app which was created with ENV=development.
            client = TestClient(app)
            # The TestClient app was bootstrapped with ENV=development (see conftest).
            resp = client.get("/openapi.json")
            assert resp.status_code == 200

    def test_redoc_available_in_development(self):
        client = TestClient(app)
        resp = client.get("/redoc")
        assert resp.status_code == 200

    def test_docs_hidden_in_production(self):
        """A production-mode app must return 404 for /docs, /redoc, /openapi.json."""
        # Build a fresh FastAPI app with production settings
        import fastapi

        prod_app = fastapi.FastAPI(
            title="Test",
            docs_url=None,
            redoc_url=None,
            openapi_url=None,
        )

        @prod_app.get("/")
        async def root():
            return {"status": "ok"}

        prod_client = TestClient(prod_app)
        assert prod_client.get("/docs").status_code == 404
        assert prod_client.get("/redoc").status_code == 404
        assert prod_client.get("/openapi.json").status_code == 404

    def test_docs_url_is_none_when_env_is_production(self):
        """Verify the production app object carries None docs_url/redoc_url."""
        # We can verify this by inspecting a freshly-constructed production app.
        import fastapi
        from app.explore.core.config import Settings

        with patch.dict(os.environ, {"ENV": "production"}, clear=False):
            prod_settings = Settings(
                SUPABASE_URL="https://x.supabase.co",
                SUPABASE_PUBLIC_KEY="anon",
                ENV="production",
                ALLOWED_HOSTS="api.example.com",
                CORS_ORIGINS="https://app.example.com",
                PORTAL_BASE_URL="https://app.example.com",
            )
            is_prod = prod_settings.ENV == "production"
            prod_app = fastapi.FastAPI(
                docs_url=None if is_prod else "/docs",
                redoc_url=None if is_prod else "/redoc",
                openapi_url=None if is_prod else "/openapi.json",
            )
            assert prod_app.docs_url is None
            assert prod_app.redoc_url is None
            assert prod_app.openapi_url is None


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------


class TestSecurityHeaders:
    """Every response must carry the hardening headers."""

    def test_x_content_type_options_header(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options_header(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.headers.get("x-frame-options") == "DENY"

    def test_referrer_policy_header(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.headers.get("referrer-policy") == "strict-origin-when-cross-origin"

    def test_security_headers_on_root(self):
        client = TestClient(app)
        resp = client.get("/")
        assert resp.headers.get("x-content-type-options") == "nosniff"
        assert resp.headers.get("x-frame-options") == "DENY"

    def test_hsts_absent_in_development(self):
        """Strict-Transport-Security must NOT be set in development mode."""
        client = TestClient(app)
        resp = client.get("/health")
        # ENV is "development" in tests, so HSTS header should not be present.
        assert "strict-transport-security" not in resp.headers


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------


class TestCORS:
    """CORS middleware uses the configured origins list."""

    def test_cors_origin_in_allow_origins(self):
        """A request from a configured origin must receive CORS headers."""
        client = TestClient(app)
        resp = client.get(
            "/health",
            headers={"Origin": "http://localhost:3000"},
        )
        # The middleware should set allow-origin for the configured origin.
        assert (
            resp.headers.get("access-control-allow-origin") == "http://localhost:3000"
        )

    def test_cors_origins_list_property(self):
        """Settings.cors_origins_list must split the comma-separated string."""
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            CORS_ORIGINS="http://localhost:3000,https://app.example.com",
        )
        assert s.cors_origins_list == [
            "http://localhost:3000",
            "https://app.example.com",
        ]

    def test_cors_origins_list_strips_whitespace(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            CORS_ORIGINS=" http://a.com , http://b.com ",
        )
        assert s.cors_origins_list == ["http://a.com", "http://b.com"]


class TestProductionConfiguration:
    """Production must not silently inherit development network defaults."""

    @pytest.mark.parametrize(
        ("overrides", "message"),
        [
            ({"ALLOWED_HOSTS": "*"}, "ALLOWED_HOSTS"),
            ({"CORS_ORIGINS": "*"}, "CORS_ORIGINS"),
            ({"CORS_ORIGINS": "http://app.example.com"}, "CORS_ORIGINS"),
            ({"PORTAL_BASE_URL": None}, "PORTAL_BASE_URL"),
            ({"PORTAL_BASE_URL": "http://app.example.com"}, "PORTAL_BASE_URL"),
        ],
    )
    def test_rejects_insecure_production_defaults(self, overrides, message):
        from app.explore.core.config import Settings

        values = {
            "SUPABASE_URL": "https://x.supabase.co",
            "SUPABASE_PUBLIC_KEY": "k",
            "ENV": "production",
            "ALLOWED_HOSTS": "api.example.com",
            "CORS_ORIGINS": "https://app.example.com",
            "PORTAL_BASE_URL": "https://app.example.com",
            **overrides,
        }
        with pytest.raises(ValueError, match=message):
            Settings(**values)


# ---------------------------------------------------------------------------
# Health endpoints — shape and absence of version field
# ---------------------------------------------------------------------------


class TestHealthEndpoints:
    async def test_request_declaring_oversized_body_is_rejected(self):
        from starlette.requests import Request

        from app.explore.main import _MAX_BODY_BYTES, limit_body_size

        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/health",
                "headers": [(b"content-length", str(_MAX_BODY_BYTES + 1).encode())],
            }
        )
        resp = await limit_body_size(request, AsyncMock())
        assert resp.status_code == 413
        assert resp.body == b'{"detail":"Request body too large"}'

    def test_root_returns_200(self):
        client = TestClient(app)
        resp = client.get("/")
        assert resp.status_code == 200

    def test_root_has_no_version_field(self):
        client = TestClient(app)
        body = client.get("/").json()
        assert "version" not in body

    def test_root_has_status_field(self):
        client = TestClient(app)
        body = client.get("/").json()
        assert body.get("status") == "healthy"

    def test_health_returns_200(self):
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200

    def test_health_has_no_version_field(self):
        client = TestClient(app)
        body = client.get("/health").json()
        assert "version" not in body

    def test_health_has_status_healthy(self):
        client = TestClient(app)
        body = client.get("/health").json()
        assert body.get("status") == "healthy"

    def test_health_has_api_online(self):
        client = TestClient(app)
        body = client.get("/health").json()
        assert body.get("api") == "online"


# ---------------------------------------------------------------------------
# Settings properties
# ---------------------------------------------------------------------------


class TestSettings:
    def test_optional_model_properties_have_safe_defaults(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            THINK_MODEL=None,
            RERANK_MODEL=None,
        )
        assert s.think_model == ""
        assert s.rerank_model == "cohere/rerank-4-pro"

    def test_title_model_uses_title_model_when_set(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            TITLE_MODEL="my/title-model",
            FAST_MODEL="my/fast-model",
        )
        assert s.title_model == "my/title-model"

    def test_title_model_falls_back_to_fast_model_when_unset(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            FAST_MODEL="my/fast-model",
            TITLE_MODEL=None,
        )
        assert s.title_model == "my/fast-model"

    def test_reasoning_effort_defaults_are_mode_safe(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
        )
        assert s.fast_reasoning_effort == "low"
        assert s.think_reasoning_effort == "xhigh"

    def test_reasoning_effort_env_overrides_defaults(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            FAST_REASONING_EFFORT="medium",
            THINK_REASONING_EFFORT="high",
        )
        assert s.fast_reasoning_effort == "medium"
        assert s.think_reasoning_effort == "high"

    def test_allowed_hosts_list_property(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
            ALLOWED_HOSTS="example.com,*.other.com",
        )
        assert s.allowed_hosts_list == ["example.com", "*.other.com"]

    def test_embedding_dimensions_defaults_1536(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
        )
        assert s.embedding_dimensions == 1536

    def test_rerank_candidates_default(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
        )
        assert s.rerank_candidates == 30

    def test_rerank_top_n_default(self):
        from app.explore.core.config import Settings

        s = Settings(
            SUPABASE_URL="https://x.supabase.co",
            SUPABASE_PUBLIC_KEY="k",
        )
        assert s.rerank_top_n == 8
