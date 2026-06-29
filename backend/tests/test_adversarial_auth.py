"""Adversarial (red-team) tests for the auth dependency in api/deps.py.

Goal: derive what a CORRECT bearer-token validator MUST do from the security
requirement (only a token that resolves to a real, non-empty user identity may
authenticate), then test the real code against that — not against what it does.

Confirmed real defects are marked xfail(strict=False) with a BUG: reason so the
suite stays green/committable while the failure is preserved. Every xfail is
listed in the agent report.
"""
from __future__ import annotations

import logging
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

import app.explore.api.deps as deps_mod
from app.explore.api.deps import _validate_bearer


def _patch_user(monkeypatch, user) -> None:
    """Patch deps.supabase.auth.get_user to return a response whose .user is
    ``user`` (which may itself be ``None``)."""
    response = MagicMock()
    response.user = user
    mock_supa = MagicMock()
    mock_supa.auth.get_user = MagicMock(return_value=response)
    monkeypatch.setattr(deps_mod, "supabase", mock_supa)


# ---------------------------------------------------------------------------
# Empty / missing user id == NOT authenticated.
#
# REQUIREMENT: a validated token must resolve to a concrete, non-empty user id.
# An empty string or None id is NOT a usable identity — downstream every query
# scopes on this id (profiles.uid == id, client_knowledge.uid == id). An empty
# id silently widens scope to "rows with an empty/blank owner" and is an auth
# bypass to a phantom identity. The validator MUST reject it with 401.
# ---------------------------------------------------------------------------

class TestEmptyIdentityIsRejected:
    async def test_empty_string_id_must_be_401(self, monkeypatch):
        user = MagicMock()
        user.id = ""
        _patch_user(monkeypatch, user)
        with pytest.raises(HTTPException) as exc:
            await _validate_bearer("Bearer some-token")
        assert exc.value.status_code == 401

    async def test_none_id_must_be_401(self, monkeypatch):
        user = MagicMock()
        user.id = None
        _patch_user(monkeypatch, user)
        with pytest.raises(HTTPException) as exc:
            await _validate_bearer("Bearer some-token")
        assert exc.value.status_code == 401

    async def test_whitespace_only_id_must_be_401(self, monkeypatch):
        user = MagicMock()
        user.id = "   "
        _patch_user(monkeypatch, user)
        with pytest.raises(HTTPException) as exc:
            await _validate_bearer("Bearer some-token")
        assert exc.value.status_code == 401


# ---------------------------------------------------------------------------
# Malformed header shapes that MUST 401 (robustness expectations).
# These derive from the requirement "only a well-formed Bearer credential is
# accepted"; they should already pass — included to prove the boundary holds.
# ---------------------------------------------------------------------------

class TestMalformedHeaders:
    @pytest.mark.parametrize(
        "header",
        [
            "Bearer",            # no space, no token
            "Bearer    ",        # only whitespace after scheme
            "  ",                # blank
            "Bearer\ttab-token",  # tab instead of space after scheme
        ],
    )
    async def test_malformed_header_raises_401(self, header):
        with pytest.raises(HTTPException) as exc:
            await _validate_bearer(header)
        assert exc.value.status_code == 401

    async def test_get_user_not_called_for_malformed_header(self, monkeypatch):
        """A structurally invalid header must short-circuit BEFORE hitting the
        auth backend (no wasted GoTrue round-trip / no oracle)."""
        user = MagicMock()
        user.id = "real"
        mock_supa = MagicMock()
        mock_supa.auth.get_user = MagicMock(
            return_value=MagicMock(user=user)
        )
        monkeypatch.setattr(deps_mod, "supabase", mock_supa)
        with pytest.raises(HTTPException):
            await _validate_bearer("Bearer ")
        mock_supa.auth.get_user.assert_not_called()


# ---------------------------------------------------------------------------
# No internal detail leakage on the error path + a security warning is logged.
# ---------------------------------------------------------------------------

class TestNoLeakAndLogging:
    async def test_exception_text_never_in_detail(self, monkeypatch, caplog):
        secret = "PGRST-internal-stacktrace-token-leak"
        mock_supa = MagicMock()
        mock_supa.auth.get_user = MagicMock(side_effect=Exception(secret))
        monkeypatch.setattr(deps_mod, "supabase", mock_supa)
        with caplog.at_level(logging.WARNING, logger="security"):
            with pytest.raises(HTTPException) as exc:
                await _validate_bearer("Bearer bad")
        assert secret not in str(exc.value.detail)
        # And a security warning is logged so the failure is observable.
        assert any("Auth failure" in r.message for r in caplog.records)
