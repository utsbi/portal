"""Tests for app.explore.services.membership.

Covers:
  - scoped_project_ids: non-member project_id yields []
  - scoped_project_ids: member project_id is allowed
  - scoped_project_ids: None project_id returns full membership set
  - caller_project_ids: blank client_id returns []
  - is_project_member: True/False cases
  - get_project_context: non-member returns None; member returns context string
"""
from __future__ import annotations

from unittest.mock import MagicMock


from app.explore.services.membership import (
    caller_project_ids,
    get_project_context,
    is_project_member,
    scoped_project_ids,
)


# ---------------------------------------------------------------------------
# Helper: build a mock Supabase client that simulates DB responses
# ---------------------------------------------------------------------------

def _make_db(profile_id=None, project_ids=None, role=None, company_name=None):
    """Build a mock ``db`` (supabase.Client) with configurable query results.

    - profile_id: the numeric id returned for profiles.uid == client_id
    - project_ids: list of ints returned from project_members
    - role: role string returned from project_members for a specific project
    - company_name: string returned from projects table
    """
    db = MagicMock()

    def _table(name):
        chain = MagicMock()

        def _execute():
            result = MagicMock()
            if name == "profiles":
                if profile_id is not None:
                    result.data = [{"id": profile_id}]
                else:
                    result.data = []
            elif name == "project_members":
                if project_ids is not None:
                    # For caller_project_ids queries (select project_id)
                    result.data = [{"project_id": pid} for pid in project_ids]
                    # For get_project_context membership check (select role)
                    if role is not None:
                        result.data = [{"role": role}]
                else:
                    result.data = []
            elif name == "projects":
                if company_name is not None:
                    result.data = [{"company_name": company_name}]
                else:
                    result.data = []
            else:
                result.data = []
            return result

        chain.execute = _execute
        chain.select.return_value = chain
        chain.eq.return_value = chain
        chain.in_.return_value = chain
        chain.limit.return_value = chain
        return chain

    db.table.side_effect = _table
    return db


# ---------------------------------------------------------------------------
# caller_project_ids
# ---------------------------------------------------------------------------

class TestCallerProjectIds:
    async def test_blank_client_id_returns_empty(self):
        db = _make_db()
        result = await caller_project_ids(db, "")
        assert result == []

    async def test_whitespace_client_id_returns_empty(self):
        db = _make_db()
        result = await caller_project_ids(db, "   ")
        assert result == []

    async def test_no_profile_found_returns_empty(self):
        db = _make_db(profile_id=None)
        result = await caller_project_ids(db, "uid-abc")
        assert result == []

    async def test_member_of_projects_returns_ids(self):
        """A client who is a member of projects [1, 2] gets those ids back."""
        # We need the db to return profile first then project_members
        # This requires a more nuanced mock since table() is called twice.
        db = MagicMock()

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.in_.return_value = chain
            chain.limit.return_value = chain

            if name == "profiles":
                chain.execute.return_value = MagicMock(data=[{"id": 99}])
            elif name == "project_members":
                chain.execute.return_value = MagicMock(
                    data=[{"project_id": 1}, {"project_id": 2}]
                )
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = _table
        result = await caller_project_ids(db, "uid-abc")
        assert set(result) == {1, 2}


# ---------------------------------------------------------------------------
# is_project_member
# ---------------------------------------------------------------------------

class TestIsProjectMember:
    async def test_member_returns_true(self):
        db = MagicMock()

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.limit.return_value = chain
            if name == "profiles":
                chain.execute.return_value = MagicMock(data=[{"id": 10}])
            elif name == "project_members":
                chain.execute.return_value = MagicMock(
                    data=[{"project_id": 5}]
                )
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = _table
        assert await is_project_member(db, "uid-member", 5) is True

    async def test_non_member_returns_false(self):
        db = MagicMock()

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.limit.return_value = chain
            if name == "profiles":
                chain.execute.return_value = MagicMock(data=[{"id": 10}])
            elif name == "project_members":
                chain.execute.return_value = MagicMock(
                    data=[{"project_id": 7}]  # project 7, not 5
                )
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = _table
        assert await is_project_member(db, "uid-member", 5) is False


# ---------------------------------------------------------------------------
# scoped_project_ids
# ---------------------------------------------------------------------------

class TestScopedProjectIds:
    async def _db_with_projects(self, project_ids):
        db = MagicMock()

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.limit.return_value = chain
            if name == "profiles":
                chain.execute.return_value = MagicMock(data=[{"id": 1}])
            elif name == "project_members":
                chain.execute.return_value = MagicMock(
                    data=[{"project_id": pid} for pid in project_ids]
                )
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = _table
        return db

    async def test_none_project_id_returns_all_memberships(self):
        db = await self._db_with_projects([1, 2, 3])
        result = await scoped_project_ids(db, "uid", None)
        assert set(result) == {1, 2, 3}

    async def test_member_project_id_narrows_to_that_project(self):
        db = await self._db_with_projects([1, 2, 3])
        result = await scoped_project_ids(db, "uid", 2)
        assert result == [2]

    async def test_non_member_project_id_yields_empty(self):
        """A project_id the caller doesn't belong to must yield []."""
        db = await self._db_with_projects([1, 2])
        result = await scoped_project_ids(db, "uid", 99)
        assert result == []

    async def test_spoofed_project_id_yields_empty(self):
        """Spoofing a project_id that isn't in the caller's membership → []."""
        db = await self._db_with_projects([10])
        result = await scoped_project_ids(db, "uid", 42)
        assert result == []


# ---------------------------------------------------------------------------
# get_project_context
# ---------------------------------------------------------------------------

class TestGetProjectContext:
    async def test_blank_client_id_returns_none(self):
        db = MagicMock()
        result = await get_project_context(db, "", 1)
        assert result is None

    async def test_non_member_returns_none(self):
        """If the caller is not a member of project_id, context must be None."""
        db = MagicMock()

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.limit.return_value = chain
            if name == "profiles":
                chain.execute.return_value = MagicMock(data=[{"id": 10}])
            elif name == "project_members":
                # No membership row
                chain.execute.return_value = MagicMock(data=[])
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = _table
        result = await get_project_context(db, "uid-abc", 99)
        assert result is None

    async def test_member_returns_context_string_with_project_name(self):
        """A project member gets a context string containing the project name."""
        db = MagicMock()

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.limit.return_value = chain

            if name == "profiles":
                chain.execute.return_value = MagicMock(data=[{"id": 10}])
            elif name == "project_members":
                chain.execute.return_value = MagicMock(
                    data=[{"role": "client"}]
                )
            elif name == "projects":
                chain.execute.return_value = MagicMock(
                    data=[{"company_name": "Acme Corp"}]
                )
            else:
                chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = _table
        result = await get_project_context(db, "uid-abc", 5)
        assert result is not None
        assert "Acme Corp" in result
        assert "client" in result

    async def test_no_profile_returns_none(self):
        db = MagicMock()

        def _table(name):
            chain = MagicMock()
            chain.select.return_value = chain
            chain.eq.return_value = chain
            chain.limit.return_value = chain
            chain.execute.return_value = MagicMock(data=[])
            return chain

        db.table.side_effect = _table
        result = await get_project_context(db, "uid-no-profile", 1)
        assert result is None
