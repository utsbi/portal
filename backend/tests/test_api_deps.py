"""Tests for app.explore.api.deps — authentication dependencies."""

from __future__ import annotations

import logging
from unittest.mock import MagicMock

import pytest

from app.explore.api.deps import (
    AuthContext,
    _validate_bearer,
    get_auth_context,
    get_current_user_id,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_good_user(monkeypatch, user_id: str = "user-uuid-abc") -> MagicMock:
    """Patch supabase.auth.get_user to return a valid user.

    deps.py uses ``from app.explore.db.supabase import supabase`` so the name
    ``supabase`` in the deps module namespace is what needs patching — not the
    supabase_module attribute.
    """
    import app.explore.api.deps as deps_mod

    user = MagicMock()
    user.id = user_id
    response = MagicMock()
    response.user = user

    mock_supa = MagicMock()
    mock_supa.auth.get_user = MagicMock(return_value=response)
    monkeypatch.setattr(deps_mod, "supabase", mock_supa)
    return mock_supa


def _mock_bad_user_exception(monkeypatch) -> MagicMock:
    """Patch supabase.auth.get_user to raise (simulates expired/invalid JWT)."""
    import app.explore.api.deps as deps_mod

    mock_supa = MagicMock()
    mock_supa.auth.get_user = MagicMock(side_effect=Exception("invalid_jwt"))
    monkeypatch.setattr(deps_mod, "supabase", mock_supa)
    return mock_supa


def _mock_null_user(monkeypatch) -> MagicMock:
    """Patch supabase.auth.get_user to return a response with user=None."""
    import app.explore.api.deps as deps_mod

    response = MagicMock()
    response.user = None
    mock_supa = MagicMock()
    mock_supa.auth.get_user = MagicMock(return_value=response)
    monkeypatch.setattr(deps_mod, "supabase", mock_supa)
    return mock_supa


# ---------------------------------------------------------------------------
# _validate_bearer — missing / malformed header
# ---------------------------------------------------------------------------


class TestValidateBearer:
    async def test_none_authorization_raises_401(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await _validate_bearer(None)
        assert exc_info.value.status_code == 401

    async def test_empty_string_raises_401(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await _validate_bearer("")
        assert exc_info.value.status_code == 401

    async def test_missing_bearer_prefix_raises_401(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await _validate_bearer("Token some-value")
        assert exc_info.value.status_code == 401

    async def test_bearer_with_empty_token_raises_401(self):
        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc_info:
            await _validate_bearer("Bearer ")
        assert exc_info.value.status_code == 401

    async def test_valid_token_returns_user_id_and_token(self, monkeypatch):
        _mock_good_user(monkeypatch, user_id="uid-xyz")
        user_id, token = await _validate_bearer("Bearer my-token-123")
        assert user_id == "uid-xyz"
        assert token == "my-token-123"


# ---------------------------------------------------------------------------
# _validate_bearer — token validation failures → 401 + security log warning
# ---------------------------------------------------------------------------


class TestValidateBearerTokenFailures:
    async def test_invalid_token_raises_401(self, monkeypatch):
        from fastapi import HTTPException

        _mock_bad_user_exception(monkeypatch)
        with pytest.raises(HTTPException) as exc_info:
            await _validate_bearer("Bearer bad-token")
        assert exc_info.value.status_code == 401
        assert exc_info.value.detail == "Invalid or expired token"

    async def test_invalid_token_logs_security_warning(self, monkeypatch, caplog):
        from fastapi import HTTPException

        _mock_bad_user_exception(monkeypatch)
        with caplog.at_level(logging.WARNING, logger="security"):
            with pytest.raises(HTTPException):
                await _validate_bearer("Bearer bad-token")
        assert any("Auth failure" in r.message for r in caplog.records)

    async def test_null_user_raises_401(self, monkeypatch):
        from fastapi import HTTPException

        _mock_null_user(monkeypatch)
        with pytest.raises(HTTPException) as exc_info:
            await _validate_bearer("Bearer valid-but-no-user")
        assert exc_info.value.status_code == 401

    async def test_null_user_logs_security_warning(self, monkeypatch, caplog):
        from fastapi import HTTPException

        _mock_null_user(monkeypatch)
        with caplog.at_level(logging.WARNING, logger="security"):
            with pytest.raises(HTTPException):
                await _validate_bearer("Bearer valid-but-no-user")
        assert any("Auth failure" in r.message for r in caplog.records)

    async def test_detail_does_not_leak_internal_error(self, monkeypatch):
        """The 401 detail must be generic, not the GoTrue exception message."""
        from fastapi import HTTPException

        _mock_bad_user_exception(monkeypatch)
        with pytest.raises(HTTPException) as exc_info:
            await _validate_bearer("Bearer bad-token")
        # The raw exception text "invalid_jwt" must not appear in the detail.
        assert "invalid_jwt" not in exc_info.value.detail


# ---------------------------------------------------------------------------
# get_auth_context dependency
# ---------------------------------------------------------------------------


class TestGetAuthContext:
    async def test_valid_token_returns_auth_context(self, monkeypatch):
        _mock_good_user(monkeypatch, user_id="uid-ctx")
        ctx = await get_auth_context(authorization="Bearer ctx-token")
        assert isinstance(ctx, AuthContext)
        assert ctx.user_id == "uid-ctx"
        assert ctx.access_token == "ctx-token"

    async def test_invalid_token_raises_401(self, monkeypatch):
        from fastapi import HTTPException

        _mock_bad_user_exception(monkeypatch)
        with pytest.raises(HTTPException) as exc_info:
            await get_auth_context(authorization="Bearer bad")
        assert exc_info.value.status_code == 401

    async def test_missing_header_raises_401(self, monkeypatch):
        from fastapi import HTTPException

        _mock_good_user(monkeypatch)
        with pytest.raises(HTTPException) as exc_info:
            await get_auth_context(authorization=None)
        assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# get_current_user_id dependency
# ---------------------------------------------------------------------------


class TestGetCurrentUserId:
    async def test_returns_user_id_string(self, monkeypatch):
        _mock_good_user(monkeypatch, user_id="uid-simple")
        uid = await get_current_user_id(authorization="Bearer token-abc")
        assert uid == "uid-simple"

    async def test_missing_header_raises_401(self, monkeypatch):
        from fastapi import HTTPException

        _mock_good_user(monkeypatch)
        with pytest.raises(HTTPException):
            await get_current_user_id(authorization=None)
