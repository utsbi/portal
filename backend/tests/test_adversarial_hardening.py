"""Adversarial tests for app-level hardening: docs gating in production, CORS
reflection, the rate-limiter key function, and error leakage on list endpoints.
"""
from __future__ import annotations

import importlib
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

import app.explore.api.deps as deps_mod


# ---------------------------------------------------------------------------
# Production docs gating: /docs, /redoc, /openapi.json must all be unreachable.
#
# conftest pins ENV=development at import, and main.py reads ENV at import time,
# so we build a SEPARATE app instance with ENV=production by reloading the module
# under a patched env. This exercises the real production code path.
# ---------------------------------------------------------------------------

@pytest.fixture()
def prod_app(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    import app.explore.core.config as config_mod
    import app.explore.main as main_mod

    # Rebuild settings + app under ENV=production.
    importlib.reload(config_mod)
    # main.py imports `settings` by value and reads it at import; reload it too.
    main_mod = importlib.reload(main_mod)
    try:
        yield main_mod.app
    finally:
        # Restore the development-built modules for the rest of the suite.
        monkeypatch.setenv("ENV", "development")
        importlib.reload(config_mod)
        importlib.reload(main_mod)


class TestProductionDocsGating:
    @pytest.mark.parametrize("path", ["/openapi.json", "/docs", "/redoc"])
    def test_docs_endpoints_unreachable_in_production(self, prod_app, path):
        c = TestClient(prod_app, raise_server_exceptions=False)
        resp = c.get(path)
        assert resp.status_code == 404, (
            f"{path} must be 404 in production, got {resp.status_code}"
        )

    def test_schema_not_reachable_via_trailing_slash_trick(self, prod_app):
        c = TestClient(prod_app, raise_server_exceptions=False)
        # A common bypass attempt: alternate casing / trailing slash.
        for path in ["/openapi.json/", "/Docs", "/openapi"]:
            resp = c.get(path)
            assert resp.status_code != 200 or "openapi" not in resp.text.lower()


# ---------------------------------------------------------------------------
# CORS: a non-allowlisted Origin must NOT be reflected while credentials are
# allowed (reflecting an arbitrary origin + allow_credentials is a serious
# cross-origin credential-theft hole).
# ---------------------------------------------------------------------------

class TestCorsReflection:
    def test_disallowed_origin_not_reflected(self):
        from app.explore.main import app

        c = TestClient(app, raise_server_exceptions=False)
        evil = "https://evil.attacker.example"
        resp = c.options(
            "/api/v1/chat/health",
            headers={
                "Origin": evil,
                "Access-Control-Request-Method": "GET",
            },
        )
        acao = resp.headers.get("access-control-allow-origin")
        assert acao != evil, (
            "a non-allowlisted Origin must not be reflected in "
            f"Access-Control-Allow-Origin (got {acao!r})"
        )
        assert acao != "*", "wildcard ACAO with credentials is forbidden"

    def test_allowed_origin_is_reflected(self):
        from app.explore.main import app

        c = TestClient(app, raise_server_exceptions=False)
        good = "http://localhost:3000"
        resp = c.options(
            "/api/v1/chat/health",
            headers={
                "Origin": good,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.headers.get("access-control-allow-origin") == good


# ---------------------------------------------------------------------------
# Rate limiter must key per-authenticated-user, NOT per-IP. Behind the single
# Next.js proxy, EVERY authenticated user shares one source IP, so a per-IP
# bucket would be a GLOBAL limit shared across all tenants — one noisy user could
# throttle everyone. The key derives from the Bearer credential, falling back to
# the remote address only for unauthenticated requests.
# ---------------------------------------------------------------------------

class TestRateLimiterKeying:
    def test_unauthenticated_request_falls_back_to_remote_address(self):
        from slowapi.util import get_remote_address

        from app.explore.core.limiter import limiter

        # With no Bearer credential there is no user identity, so the key falls
        # back to the remote address (slowapi's default behavior).
        req = MagicMock()
        req.client = MagicMock()
        req.client.host = "10.0.0.1"
        req.headers = {}
        assert limiter._key_func(req) == get_remote_address(req)

    def test_two_users_one_ip_should_not_share_bucket(self):
        from app.explore.core.limiter import limiter

        # Build two fake requests: same client IP, different bearer/user.
        def _req(ip, token):
            r = MagicMock()
            r.client = MagicMock()
            r.client.host = ip
            r.headers = {"Authorization": f"Bearer {token}"}
            return r

        key_user_a = limiter._key_func(_req("10.0.0.1", "user-a-token"))
        key_user_b = limiter._key_func(_req("10.0.0.1", "user-b-token"))
        # A correct (per-user) key function would differ for different users.
        assert key_user_a != key_user_b, (
            "two distinct authenticated users on one IP must not share a "
            "rate-limit bucket"
        )


# ---------------------------------------------------------------------------
# Error leakage on /documents/list: a backend failure must return a generic
# message, never the raw exception text.
# ---------------------------------------------------------------------------

class TestListEndpointErrorLeakage:
    def test_list_documents_does_not_leak_exception_text(self, monkeypatch):
        from app.explore.main import app

        user = MagicMock()
        user.id = "test-user-uuid-1234"
        mock_supa = MagicMock()
        mock_supa.auth.get_user = MagicMock(return_value=MagicMock(user=user))
        monkeypatch.setattr(deps_mod, "supabase", mock_supa)

        # Force the list query to blow up with a secret-bearing exception.
        # list_documents does `from app.explore.db.supabase import supabase`
        # INSIDE the function, so the live module attribute is what's resolved.
        secret = "SECRET-DB-DSN-postgres://user:pw@host/db"
        import app.explore.db.supabase as db_mod

        boom = MagicMock()
        boom.table.side_effect = Exception(secret)
        monkeypatch.setattr(db_mod, "supabase", boom)

        c = TestClient(app, raise_server_exceptions=False)
        resp = c.get(
            "/api/v1/documents/list", headers={"Authorization": "Bearer t"}
        )
        assert resp.status_code == 500
        assert secret not in resp.text, "raw exception text leaked to client"
