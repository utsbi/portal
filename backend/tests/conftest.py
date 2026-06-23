"""Shared pytest fixtures for the Explore backend test suite.

All external I/O is mocked here:
  - Supabase client (service-role + user-scoped) patched before the app module
    imports it, so Settings validation is satisfied without a live .env.
  - The AsyncOpenAI client (OpenRouter) patched on nodes.openrouter_client.
  - The RAGService patched on agents.nodes.rag_service.

Environment variables are injected via os.environ before any app module is
imported so pydantic-settings picks them up without reading a .env file.
"""
from __future__ import annotations

import os
from typing import AsyncGenerator
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient

# ---------------------------------------------------------------------------
# Inject required env vars BEFORE any app module is imported.
# This satisfies pydantic-settings (SUPABASE_URL, SUPABASE_PUBLIC_KEY are
# non-Optional fields on Settings) without touching a real .env file.
# ---------------------------------------------------------------------------
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_PUBLIC_KEY", "test-anon-key")
os.environ.setdefault("SUPABASE_SECRET_KEY", "test-secret-key")
os.environ.setdefault("OPEN_ROUTER_KEY", "test-openrouter-key")
os.environ.setdefault("FAST_MODEL", "openai/gpt-4o-mini")
os.environ.setdefault("THINK_MODEL", "openai/o3-mini")
os.environ.setdefault("TITLE_MODEL", "openai/gpt-4o-mini")
os.environ.setdefault("EMBEDDING_MODEL", "qwen/qwen3-embedding-8b")
os.environ.setdefault("ENV", "development")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("ALLOWED_HOSTS", "*")


# ---------------------------------------------------------------------------
# Mock the Supabase client before it is instantiated at import time.
# db/supabase.py calls create_client() at module level, so we must patch
# supabase.create_client before that module is first imported.
# ---------------------------------------------------------------------------
def _make_mock_supabase() -> MagicMock:
    """Return a MagicMock that loosely resembles a supabase.Client."""
    client = MagicMock()
    # auth.get_user returns a response with a user by default
    user = MagicMock()
    user.id = "test-user-uuid-1234"
    user_response = MagicMock()
    user_response.user = user
    client.auth.get_user = MagicMock(return_value=user_response)
    # Table/query chain: .table(...).select(...).eq(...).execute()
    chain = MagicMock()
    chain.execute.return_value = MagicMock(data=[])
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.in_.return_value = chain
    chain.or_.return_value = chain
    chain.limit.return_value = chain
    chain.order.return_value = chain
    chain.ilike.return_value = chain
    chain.delete.return_value = chain
    chain.insert.return_value = chain
    chain.text_search.return_value = chain
    client.table.return_value = chain
    # rpc
    rpc_chain = MagicMock()
    rpc_chain.execute.return_value = MagicMock(data=[])
    client.rpc.return_value = rpc_chain
    # storage
    storage_chain = MagicMock()
    storage_chain.download = MagicMock(return_value=b"fake bytes")
    client.storage.from_.return_value = storage_chain
    # postgrest auth (for user_client)
    client.postgrest = MagicMock()
    client.postgrest.auth = MagicMock(return_value=None)
    return client


# Patch create_client at the supabase package level so every call returns our
# mock regardless of which key is passed.
_mock_supabase_instance = _make_mock_supabase()
_supabase_patch = patch(
    "supabase.create_client", return_value=_mock_supabase_instance
)
_supabase_patch.start()


# Now it is safe to import app modules.
from app.explore.main import app  # noqa: E402  (import after env/patch setup)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session")
def mock_supabase() -> MagicMock:
    """The shared Supabase mock instance. Session-scoped for efficiency."""
    return _mock_supabase_instance


@pytest.fixture()
def reset_supabase_mock(mock_supabase: MagicMock):
    """Reset the supabase mock's call history between tests.

    Does NOT reset return_value so helpers that configure specific return
    values must do so themselves within the test.
    """
    mock_supabase.reset_mock(return_value=False, side_effect=False)
    # Re-attach table chain with clean call counts
    yield mock_supabase


@pytest.fixture(scope="session")
def client() -> TestClient:
    """Synchronous test client (used for simple non-streaming endpoints)."""
    return TestClient(app, raise_server_exceptions=True)


@pytest.fixture()
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Async HTTPX client for testing async endpoints."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.fixture()
def valid_auth_header() -> dict:
    """Authorization header carrying a fake-but-valid-shape bearer token."""
    return {"Authorization": "Bearer test-valid-token"}


@pytest.fixture()
def mock_auth_user(mock_supabase: MagicMock):
    """Configure supabase mock to return a specific user on auth.get_user."""
    user = MagicMock()
    user.id = "test-user-uuid-1234"
    user_response = MagicMock()
    user_response.user = user
    mock_supabase.auth.get_user = MagicMock(return_value=user_response)
    return user


@pytest.fixture()
def mock_auth_failure(mock_supabase: MagicMock):
    """Configure supabase mock so auth.get_user raises (simulates bad token)."""
    mock_supabase.auth.get_user = MagicMock(
        side_effect=Exception("invalid_jwt")
    )
    yield
    # Restore success behaviour after the test
    user = MagicMock()
    user.id = "test-user-uuid-1234"
    user_response = MagicMock()
    user_response.user = user
    mock_supabase.auth.get_user = MagicMock(return_value=user_response)


@pytest.fixture()
def mock_auth_null_user(mock_supabase: MagicMock):
    """Configure supabase mock so auth.get_user returns a response with no user."""
    null_response = MagicMock()
    null_response.user = None
    mock_supabase.auth.get_user = MagicMock(return_value=null_response)
    yield
    # Restore
    user = MagicMock()
    user.id = "test-user-uuid-1234"
    user_response = MagicMock()
    user_response.user = user
    mock_supabase.auth.get_user = MagicMock(return_value=user_response)
