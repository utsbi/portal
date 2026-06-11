"""Tool definitions and dispatch for the Explore agent tool-calling loop.

Exposes these tools to the model:
  - ``search_documents`` — RAG over the client's uploaded project documents.
  - ``search_sbi_knowledge`` — curated org knowledge about SBI and the portal.
  - ``get_lifecycle_status`` — live lifecycle task status for the caller's project(s).
  - ``get_questionnaire_status`` — live questionnaire/form status for the caller.
  - ``get_reports`` — live project reports for the caller's project(s).
  - ``get_finance_summary`` — live budget/spend summary for the caller's project(s).
  - ``get_requests`` — live client requests (``tickets`` with ``ticket_type='request'``).
  - ``get_calendar_events`` — upcoming Google Calendar events for the caller (see note).

``TOOLS`` is the OpenAI function-calling schema list passed to the chat
completion. ``execute_tool`` dispatches a single tool call and returns the tool
result text plus any citation sources (only ``search_documents`` yields sources).

SECURITY — multi-tenant isolation
----------------------------------
The live-data tools below read cross-tenant-sensitive rows. EVERY query is
scoped strictly to the authenticated caller, using the same identity the rest
of the backend uses: the ``client_id`` (the Supabase ``auth.users`` uid) that
the chat endpoint derives from the bearer token and threads through
``execute_tool``. A caller's accessible projects are resolved server-side via
``profiles.uid = client_id`` -> ``profiles.id`` -> ``project_members.project_id``;
no project id ever comes from the model/user input. If a caller belongs to no
project, the tools return an empty/"no data" summary rather than an unscoped
query, so another tenant's rows can never be returned.

DEFENSE-IN-DEPTH — RLS. In addition to the manual scoping above, the live-data
tools now run their PostgREST queries under the CALLER'S row-level-security
context: ``execute_tool`` builds a per-request client from the caller's
validated JWT (``user_client(access_token)``) so Supabase enforces tenant
isolation in the database itself, independent of (and on top of) the manual
``project_id`` / ``user_id`` filters. The service-role ``supabase`` client is no
longer used by these tools.
"""

import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, List, Tuple

from supabase import Client

from app.explore.agents.nodes import rag_service
from app.explore.db.supabase import user_client

logger = logging.getLogger(__name__)


# --- Curated SBI knowledge (loaded once at import) ---------------------------

def _load_sbi_knowledge() -> str:
    """Load the curated SBI knowledge markdown bundled with the package."""
    path = Path(__file__).resolve().parent.parent / "knowledge" / "sbi.md"
    try:
        return path.read_text(encoding="utf-8").strip()
    except Exception as e:  # pragma: no cover - defensive; file is bundled
        logger.warning(f"Failed to load SBI knowledge from {path}: {e}")
        return (
            "The Sustainable Building Initiative (SBI) is a student-led "
            "sustainable-building consultancy founded at the University of Texas "
            "at Austin in 2024."
        )


SBI_KNOWLEDGE: str = _load_sbi_knowledge()


# --- Tool schemas ------------------------------------------------------------

TOOLS: List[Dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "search_documents",
            "description": (
                "Search the client's uploaded project documents for relevant "
                "passages. Use this for any question about the client's specific "
                "project: facts, figures, dates, budgets, specs, meeting notes, "
                "deliverables, or document contents."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "A focused, self-contained search query describing the "
                            "project information to retrieve."
                        ),
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_sbi_knowledge",
            "description": (
                "Look up general info about SBI (Sustainable Building Initiative): "
                "what it is, its mission, services, team/leadership, departments, "
                "and how the portal works. Use this for 'what is SBI' or 'who is "
                "SBI' style questions, not for the client's own project documents."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": (
                            "What to look up about SBI (e.g. 'mission', "
                            "'leadership', 'departments', 'how the portal works')."
                        ),
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_lifecycle_status",
            "description": (
                "Get the LIVE status of the client's project lifecycle tasks "
                "(progress, what's done, in progress, blocked, or pending "
                "approval, and upcoming due dates). Use this for questions like "
                "'how is my project going?', 'what's left to do?', 'what's "
                "blocked?', or 'what's due next?'. This reads live database "
                "status, not documents."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_questionnaire_status",
            "description": (
                "Get the LIVE status of the client's questionnaires/intake forms: "
                "which forms are assigned, which are still pending, drafted, or "
                "already submitted. Use this for 'do I have any forms to fill "
                "out?', 'did I submit the questionnaire?', or 'what's left for me "
                "to complete?'."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_reports",
            "description": (
                "Get the LIVE list of reports filed for the client's project(s), "
                "including their subject and current status. Use this for 'what "
                "reports do I have?', 'what's the status of my report?', or "
                "'any updates on my reports?'."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_finance_summary",
            "description": (
                "Get the LIVE budget/finance summary for the client's project(s): "
                "total budgeted amount, total spent, remaining balance, and a few "
                "recent transactions. Use this for 'what's my budget?', 'how much "
                "have we spent?', 'what's left in the budget?', or 'any recent "
                "expenses?'. This reads live financial records, not documents."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_requests",
            "description": (
                "Get the LIVE list of requests the client has submitted to their "
                "SBI team (support/change requests — NOT reports), including each "
                "request's subject, status, and date. Use this for 'what requests "
                "have I made?', 'is my request still open?', or 'what's the status "
                "of my request?'."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_calendar_events",
            "description": (
                "Get the client's upcoming calendar events (meetings) scheduled "
                "with their SBI team. Use this for 'what meetings do I have?', "
                "'when is my next meeting?', or 'what's on my calendar?'."
            ),
            "parameters": {"type": "object", "properties": {}},
        },
    },
]


# --- Tool implementations ----------------------------------------------------

async def _search_documents(query: str, client_id: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Run RAG retrieval; return (context_text, sources) for citations."""
    if not query or not query.strip():
        return "No search query was provided.", []

    docs = await rag_service.retrieve_relevant(query=query, client_id=client_id)
    if not docs:
        return (
            "No matching passages were found in the client's project documents "
            "for this query.",
            [],
        )

    context_text = rag_service.build_context_string(retrieved_docs=docs)

    sources: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for doc in docs:
        metadata = doc.get("metadata", {})
        filename = metadata.get("filename", "Unknown")
        page = metadata.get("page_number")
        key = f"{filename}:{page}" if page else filename
        if key in seen:
            continue
        seen.add(key)
        rerank_score = doc.get("rerank_score")
        relevance = (
            rerank_score if rerank_score is not None else doc.get("similarity_score", 0.0)
        )
        sources.append({
            "content": (doc.get("content", "") or "")[:500],
            "filename": filename,
            "page_number": page,
            "relevance_score": relevance,
        })

    return context_text, sources


def _search_sbi_knowledge(query: str) -> Tuple[str, List[Dict[str, Any]]]:
    """Return the curated SBI knowledge text. No document sources."""
    # The curated knowledge is small, so returning it whole gives the model the
    # full picture; the ``query`` is accepted for interface symmetry and logging.
    return SBI_KNOWLEDGE, []


# --- Live-data tools (read-only, strictly scoped to the caller) --------------
#
# Ownership model (verified against the live schema):
#   client_id (auth uid, uuid)
#     -> profiles.uid == client_id          -> profiles.id (bigint)
#     -> project_members.profile_id == id   -> project_members.project_id[] (the
#                                              ONLY projects this caller may read)
# Domain tables then scope to those project ids:
#   lifecycle:      lifecycle_projects.project_id IN (ids)
#                     -> lifecycle_tasks.lifecycle_project_id IN (lifecycle ids)
#   questionnaire:  custom_form_submissions.project_id IN (ids)
#                     AND user_id == client_id   (the caller's own submissions)
#                   custom_form_assignments.project_id IN (ids)  (forms assigned)
#   reports:        tickets.ticket_type == 'report' AND project_id IN (ids)
#   requests:       tickets.ticket_type == 'request' AND project_id IN (ids)
#   finance:        project_budgets.project_id IN (ids)
#                     -> budget_categories.budget_id IN (budget ids)  (the budget)
#                     -> budget_transactions.budget_id IN (budget ids)  (the spend)
#   calendar:       Google Calendar (OAuth), not Supabase — see _get_calendar_events
#
# No project id is ever taken from model/user input; an empty project list short
# -circuits to a "no data" summary so an unscoped (cross-tenant) query is
# impossible.


async def _caller_project_ids(db: Client, client_id: str) -> List[int]:
    """Resolve the project ids the caller is a member of. Empty list if none.

    This is the single source of tenant scoping for every live-data tool. A
    blank ``client_id`` (which should never reach here for an authenticated
    request) yields ``[]`` so nothing is queried. Queries run on ``db`` (the
    caller's RLS-scoped client), so RLS applies on top of the manual filters.
    """
    if not client_id or not client_id.strip():
        return []

    def _query() -> List[int]:
        profile = (
            db.table("profiles")
            .select("id")
            .eq("uid", client_id)
            .limit(1)
            .execute()
        )
        if not profile.data:
            return []
        profile_id = profile.data[0]["id"]

        members = (
            db.table("project_members")
            .select("project_id")
            .eq("profile_id", profile_id)
            .execute()
        )
        ids: List[int] = []
        for row in members.data or []:
            pid = row.get("project_id")
            if pid is not None:
                ids.append(pid)
        return ids

    return await asyncio.to_thread(_query)


def _summarize_counts(label: str, counts: Dict[str, int]) -> str:
    """Render ``label: a=1, b=2`` for non-zero buckets, in a stable order."""
    parts = [f"{k.replace('_', ' ')}: {v}" for k, v in counts.items() if v]
    return f"{label} — " + (", ".join(parts) if parts else "none") + "."


async def _get_lifecycle_status(db: Client, client_id: str) -> str:
    """Summarize the caller's lifecycle tasks, scoped to their project(s)."""
    project_ids = await _caller_project_ids(db, client_id)
    if not project_ids:
        return (
            "No project is associated with your account, so there is no "
            "lifecycle status to report."
        )

    def _query() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        lifecycle = (
            db.table("lifecycle_projects")
            .select("id, title, completed")
            .in_("project_id", project_ids)
            .execute()
        )
        lifecycle_rows = lifecycle.data or []
        lifecycle_ids = [row["id"] for row in lifecycle_rows]
        if not lifecycle_ids:
            return lifecycle_rows, []
        tasks = (
            db.table("lifecycle_tasks")
            .select("title, status, due_date, tentative")
            .in_("lifecycle_project_id", lifecycle_ids)
            .order("due_date")
            .execute()
        )
        return lifecycle_rows, tasks.data or []

    lifecycle_rows, tasks = await asyncio.to_thread(_query)

    if not lifecycle_rows:
        return (
            "Your project does not have a lifecycle plan set up yet, so there "
            "are no lifecycle tasks to report."
        )
    if not tasks:
        return "Your project lifecycle has no tasks yet."

    # Count by status across the known enum buckets (extra/unknown statuses are
    # still counted so a schema change never silently drops data).
    order = ["not_started", "in_progress", "pending_approval", "blocked", "completed"]
    counts: Dict[str, int] = {s: 0 for s in order}
    for t in tasks:
        status = str(t.get("status") or "unknown")
        counts[status] = counts.get(status, 0) + 1

    total = len(tasks)
    done = counts.get("completed", 0)
    lines = [
        _summarize_counts(f"Lifecycle progress ({done}/{total} tasks completed)", counts)
    ]

    blocked = [t for t in tasks if t.get("status") == "blocked"]
    if blocked:
        names = ", ".join(str(t.get("title") or "untitled") for t in blocked[:5])
        lines.append(f"Blocked: {names}.")

    # Upcoming (not-yet-completed) tasks by due date, soonest first.
    upcoming = [
        t for t in tasks if t.get("status") != "completed" and t.get("due_date")
    ]
    if upcoming:
        nxt = upcoming[:3]
        items = "; ".join(
            f"{t.get('title') or 'untitled'} (due {t.get('due_date')}"
            + (", tentative" if t.get("tentative") else "")
            + ")"
            for t in nxt
        )
        lines.append(f"Next up: {items}.")

    return "\n".join(lines)


async def _get_questionnaire_status(db: Client, client_id: str) -> str:
    """Summarize the caller's questionnaire/form status, scoped to them.

    Submissions are scoped to BOTH the caller's project(s) and the caller's own
    ``user_id`` so one client never sees another client's answers on a shared
    project. Assignments are scoped to the caller's project(s).
    """
    project_ids = await _caller_project_ids(db, client_id)
    if not project_ids:
        return (
            "No project is associated with your account, so there are no "
            "questionnaires to report."
        )

    def _query() -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        assignments = (
            db.table("custom_form_assignments")
            .select("form_id, custom_form_schemas(title)")
            .in_("project_id", project_ids)
            .execute()
        )
        submissions = (
            db.table("custom_form_submissions")
            .select("form_id, status, submitted_at, custom_form_schemas(title)")
            .in_("project_id", project_ids)
            .eq("user_id", client_id)
            .execute()
        )
        return assignments.data or [], submissions.data or []

    assignments, submissions = await asyncio.to_thread(_query)

    if not assignments and not submissions:
        return "You have no questionnaires assigned and none submitted."

    def _title(row: Dict[str, Any]) -> str:
        schema = row.get("custom_form_schemas")
        if isinstance(schema, dict) and schema.get("title"):
            return str(schema["title"])
        return f"form #{row.get('form_id')}"

    # Status of the caller's own submissions, keyed by form.
    sub_by_form: Dict[Any, Dict[str, Any]] = {}
    for s in submissions:
        sub_by_form[s.get("form_id")] = s

    assigned_titles = {row.get("form_id"): _title(row) for row in assignments}
    # Fall back to submission titles for any form submitted but not in assignments.
    for s in submissions:
        assigned_titles.setdefault(s.get("form_id"), _title(s))

    submitted: List[str] = []
    draft: List[str] = []
    pending: List[str] = []
    for form_id, title in assigned_titles.items():
        sub = sub_by_form.get(form_id)
        status = (sub or {}).get("status")
        if status == "submitted":
            submitted.append(title)
        elif status == "draft":
            draft.append(title)
        else:
            pending.append(title)

    counts = {
        "submitted": len(submitted),
        "draft (in progress)": len(draft),
        "not started": len(pending),
    }
    lines = [_summarize_counts("Questionnaires", counts)]
    if pending:
        lines.append("Not started: " + ", ".join(pending[:5]) + ".")
    if draft:
        lines.append("In progress (draft): " + ", ".join(draft[:5]) + ".")
    if submitted:
        lines.append("Submitted: " + ", ".join(submitted[:5]) + ".")
    return "\n".join(lines)


async def _get_reports(db: Client, client_id: str) -> str:
    """Summarize reports filed for the caller's project(s).

    Reports are ``tickets`` rows with ``ticket_type = 'report'``. Scoped to the
    caller's project(s); a report with no project is never returned to avoid any
    cross-tenant leak.
    """
    project_ids = await _caller_project_ids(db, client_id)
    if not project_ids:
        return (
            "No project is associated with your account, so there are no "
            "reports to report."
        )

    def _query() -> List[Dict[str, Any]]:
        result = (
            db.table("tickets")
            .select("subject, title, status, created_at")
            .eq("ticket_type", "report")
            .in_("project_id", project_ids)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    reports = await asyncio.to_thread(_query)
    if not reports:
        return "There are no reports filed for your project(s)."

    counts: Dict[str, int] = {}
    for r in reports:
        status = str(r.get("status") or "unknown")
        counts[status] = counts.get(status, 0) + 1

    lines = [_summarize_counts(f"Reports ({len(reports)} total)", counts)]
    recent = reports[:5]
    for r in recent:
        subject = r.get("subject") or r.get("title") or "(no subject)"
        status = r.get("status") or "unknown"
        lines.append(f"- {subject} — status: {status}")
    return "\n".join(lines)


def _fmt_money(amount: float, currency: str = "USD") -> str:
    """Render a numeric amount as a currency string (e.g. ``$1,234.50``)."""
    symbol = "$" if currency.upper() == "USD" else ""
    return f"{symbol}{amount:,.2f}" + ("" if symbol else f" {currency}")


async def _get_finance_summary(db: Client, client_id: str) -> str:
    """Summarize the caller's project budget(s), scoped to their project(s).

    Reads ``project_budgets`` (one per project), the ``budget_categories``
    expected amounts (the "budget"), and ``budget_transactions`` (the "spend").
    Every query is scoped to budgets whose ``project_id`` is in the caller's
    project list, so another tenant's finances can never be returned.
    """
    project_ids = await _caller_project_ids(db, client_id)
    if not project_ids:
        return (
            "No project is associated with your account, so there is no "
            "finance summary to report."
        )

    def _query() -> Tuple[
        List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]
    ]:
        budgets = (
            db.table("project_budgets")
            .select("id, currency")
            .in_("project_id", project_ids)
            .execute()
        )
        budget_rows = budgets.data or []
        budget_ids = [row["id"] for row in budget_rows]
        if not budget_ids:
            return budget_rows, [], []
        categories = (
            db.table("budget_categories")
            .select("budget_id, expected_amount")
            .in_("budget_id", budget_ids)
            .execute()
        )
        transactions = (
            db.table("budget_transactions")
            .select("description, amount, occurred_on")
            .in_("budget_id", budget_ids)
            .order("occurred_on", desc=True)
            .execute()
        )
        return budget_rows, categories.data or [], transactions.data or []

    budgets, categories, transactions = await asyncio.to_thread(_query)

    if not budgets:
        return (
            "Your project does not have a budget set up yet, so there is no "
            "finance summary to report."
        )

    currency = str(budgets[0].get("currency") or "USD")
    total_budget = sum(float(c.get("expected_amount") or 0) for c in categories)
    total_spent = sum(float(t.get("amount") or 0) for t in transactions)
    remaining = total_budget - total_spent

    lines = [
        "Finance summary — "
        f"total budget: {_fmt_money(total_budget, currency)}, "
        f"spent: {_fmt_money(total_spent, currency)}, "
        f"remaining: {_fmt_money(remaining, currency)}."
    ]

    if transactions:
        lines.append("Recent transactions:")
        for t in transactions[:5]:
            desc = t.get("description") or "(no description)"
            amount = _fmt_money(float(t.get("amount") or 0), currency)
            on = t.get("occurred_on")
            lines.append(f"- {desc}: {amount}" + (f" ({on})" if on else ""))
    else:
        lines.append("No transactions recorded yet.")

    return "\n".join(lines)


async def _get_requests(db: Client, client_id: str) -> str:
    """Summarize the caller's submitted requests, scoped to their project(s).

    Requests are ``tickets`` rows with ``ticket_type = 'request'`` (the
    non-report ticket type, mirroring the dashboard's ``fetchRequests`` filter).
    Scoped to the caller's project(s); a request with no project is never
    returned to avoid any cross-tenant leak.
    """
    project_ids = await _caller_project_ids(db, client_id)
    if not project_ids:
        return (
            "No project is associated with your account, so there are no "
            "requests to report."
        )

    def _query() -> List[Dict[str, Any]]:
        result = (
            db.table("tickets")
            .select("subject, title, status, created_at")
            .eq("ticket_type", "request")
            .in_("project_id", project_ids)
            .order("created_at", desc=True)
            .execute()
        )
        return result.data or []

    requests = await asyncio.to_thread(_query)
    if not requests:
        return "You have not submitted any requests for your project(s)."

    counts: Dict[str, int] = {}
    for r in requests:
        status = str(r.get("status") or "unknown")
        counts[status] = counts.get(status, 0) + 1

    lines = [_summarize_counts(f"Requests ({len(requests)} total)", counts)]
    for r in requests[:5]:
        subject = r.get("subject") or r.get("title") or "(no subject)"
        status = r.get("status") or "unknown"
        created = r.get("created_at")
        suffix = f" (submitted {str(created)[:10]})" if created else ""
        lines.append(f"- {subject} — status: {status}{suffix}")
    return "\n".join(lines)


async def _get_calendar_events(client_id: str) -> str:
    """Upcoming Google Calendar events for the caller.

    Calendar data lives in Google Calendar (OAuth), not Supabase: the frontend
    route ``/api/contact/calendar/client-events`` refreshes a connected
    director's Google token (stored in ``profiles.config.google``) and matches
    events to the client by attendee email. The backend does not currently carry
    the Google OAuth client credentials (``GOOGLE_CLIENT_ID``/``_SECRET``) in its
    settings, so the token-refresh + Calendar API path cannot be performed here
    safely without guessing config. Until that is wired up, this returns a clear
    not-available message rather than broken/guessed Google code.
    """
    # TODO(confirm): wire Google Calendar — add GOOGLE_CLIENT_ID/SECRET to the
    # backend settings, resolve the caller's project + a connected director's
    # refresh_token from profiles.config.google, exchange it for an access token,
    # and call the Calendar v3 events.list API (httpx) filtered to the caller's
    # attendee email, mirroring frontend/app/api/contact/calendar/client-events.
    return (
        "Calendar access isn't wired up yet, so I can't pull your upcoming "
        "meetings here. You can view your scheduled events on the Calendar page "
        "of the portal."
    )


async def execute_tool(
    name: str, args: Dict[str, Any], client_id: str, access_token: str
) -> Tuple[str, List[Dict[str, Any]]]:
    """Dispatch a single tool call.

    Returns ``(result_text, sources)``. Never raises: a tool failure is returned
    as an error string so the agent loop can continue the turn.

    The five live-data tools build a single RLS-scoped PostgREST client from the
    caller's ``access_token`` (``user_client``) so their queries run under the
    caller's row-level-security context (defense-in-depth on top of the manual
    ``project_id`` / ``user_id`` filters). ``search_documents`` (RAG RPC is
    param-scoped + SECURITY DEFINER), ``search_sbi_knowledge`` (static), and
    ``get_calendar_events`` (stub) need no database client.
    """
    try:
        if name == "search_documents":
            query = str(args.get("query", "")) if args else ""
            return await _search_documents(query, client_id)
        if name == "search_sbi_knowledge":
            query = str(args.get("query", "")) if args else ""
            return _search_sbi_knowledge(query)
        if name == "get_lifecycle_status":
            db = user_client(access_token)
            return await _get_lifecycle_status(db, client_id), []
        if name == "get_questionnaire_status":
            db = user_client(access_token)
            return await _get_questionnaire_status(db, client_id), []
        if name == "get_reports":
            db = user_client(access_token)
            return await _get_reports(db, client_id), []
        if name == "get_finance_summary":
            db = user_client(access_token)
            return await _get_finance_summary(db, client_id), []
        if name == "get_requests":
            db = user_client(access_token)
            return await _get_requests(db, client_id), []
        if name == "get_calendar_events":
            return await _get_calendar_events(client_id), []
        logger.warning(f"Unknown tool requested: {name}")
        return f"Unknown tool '{name}'. No action taken.", []
    except Exception:
        logger.exception(f"Tool '{name}' failed")
        return f"The tool '{name}' encountered an error and returned no results.", []
