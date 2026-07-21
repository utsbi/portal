"""Shared project-membership resolution for the Explore backend.

Both the document-upload endpoint and the live-data agent tools need to answer
the same question — "what projects does this caller belong to?" — by resolving
``profiles.uid == client_id`` -> ``profiles.id`` -> ``project_members.project_id``.
This module is the single implementation of that lookup so the two call sites
can't drift apart.

Every query runs on the CALLER'S RLS-scoped PostgREST client (``db``), so the
database enforces tenant isolation on top of these manual filters. The blocking
PostgREST calls are wrapped in ``asyncio.to_thread`` so they don't stall the
event loop, matching the rest of the backend.
"""

import asyncio
from typing import List, Optional

from supabase import Client

from app.explore.db.rows import json_rows


async def get_project_context(
    db: Client, client_id: str, project_id: int
) -> Optional[str]:
    """Return a short, authoritative project-context block for the system prompt.

    Resolves the active project's name and the caller's role on it, using the
    same ``profiles.uid -> profiles.id -> project_members`` lookup the rest of
    this module uses, so a caller can only ever see context for a project they
    actually belong to. Returns ``None`` when the caller is not a member of
    ``project_id`` (or the project can't be resolved), so nothing is injected.
    """
    if not client_id or not client_id.strip():
        return None

    def _query() -> Optional[str]:
        profile = (
            db.table("profiles").select("id").eq("uid", client_id).limit(1).execute()
        )
        profile_rows = json_rows(profile.data)
        if not profile_rows:
            return None
        profile_id = profile_rows[0]["id"]

        member = (
            db.table("project_members")
            .select("role")
            .eq("profile_id", profile_id)
            .eq("project_id", project_id)
            .limit(1)
            .execute()
        )
        member_rows = json_rows(member.data)
        if not member_rows:
            return None
        role = member_rows[0].get("role") or "member"

        project = (
            db.table("projects")
            .select("company_name")
            .eq("id", project_id)
            .limit(1)
            .execute()
        )
        project_rows = json_rows(project.data)
        if not project_rows:
            return None
        company_name = project_rows[0].get("company_name") or f"Project {project_id}"

        return (
            "Current project context (authoritative — the project the user is "
            "working in right now):\n"
            f"- Project: {company_name}\n"
            f"- The user's role on this project: {role}\n"
            "When the user asks which project they're in, answer with the "
            "project name above. All tool calls are already scoped to this "
            "project."
        )

    return await asyncio.to_thread(_query)


async def caller_project_ids(db: Client, client_id: str) -> List[int]:
    """Resolve the project ids the caller is a member of. Empty list if none.

    A blank ``client_id`` (which should never reach here for an authenticated
    request) yields ``[]`` so nothing is queried.
    """
    if not client_id or not client_id.strip():
        return []

    def _query() -> List[int]:
        profile = (
            db.table("profiles").select("id").eq("uid", client_id).limit(1).execute()
        )
        profile_rows = json_rows(profile.data)
        if not profile_rows:
            return []
        profile_id = profile_rows[0]["id"]

        members = (
            db.table("project_members")
            .select("project_id")
            .eq("profile_id", profile_id)
            .execute()
        )
        ids: List[int] = []
        for row in json_rows(members.data):
            pid = row.get("project_id")
            if pid is not None:
                ids.append(pid)
        return ids

    return await asyncio.to_thread(_query)


async def is_project_member(db: Client, client_id: str, project_id: int) -> bool:
    """True if the caller (uid=client_id) is a member of ``project_id``."""
    return project_id in await caller_project_ids(db, client_id)


async def scoped_project_ids(
    db: Client, client_id: str, project_id: Optional[int]
) -> List[int]:
    """The project ids a live-data tool may read for THIS turn.

    Starts from the caller's full membership set and, when the request carries
    an active ``project_id``, NARROWS the scope to just that project — but only
    after verifying the caller is actually a member of it. A ``project_id`` the
    caller does not belong to yields ``[]`` ("no data"), so a spoofed, stale, or
    cross-tenant id can never widen access or leak another project's rows. When
    no ``project_id`` is supplied, the caller's full set is used.
    """
    allowed = await caller_project_ids(db, client_id)
    if project_id is None:
        return allowed
    return [project_id] if project_id in allowed else []
