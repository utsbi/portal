<!--
Title: use a conventional-commit style summary, e.g.
  feat(explore): project-locked chats
  fix(files): cascade RAG index on delete
  perf(explore): single streaming tool-call loop
-->

## What & why
<!-- The problem and the decision. One or two sentences of context, not just a
     restatement of the diff. Link the issue if there is one (Closes #123). -->

## Changes
<!-- Bullet the notable changes, grouped by area when it spans the stack. -->
- **Frontend:**
- **Backend (FastAPI):**
- **Database (Supabase):**

## Deploy checklist
<!-- Tick what applies. The frontend auto-deploys via Vercel; backend and DB do NOT. -->
- [ ] **Backend redeploy required** — this PR changes `backend/**` (FastAPI does not auto-deploy)
- [ ] **Migration to apply** — this PR adds files under `supabase/migrations/`; apply each migration individually via Supabase MCP after merge
- [ ] **New env var(s)** — added to `.env.example` and the deployment environment
- [ ] **New dependency** — `bun.lock` / `backend/pyproject.toml` updated and committed
- [ ] None of the above — frontend-only, ships with the Vercel deploy

## Verification
<!-- Evidence, not assertions. What did you actually run / click? -->
- [ ] Frontend lint, standalone typecheck, coverage, production build, and Playwright pass
- [ ] Backend pytest coverage, Ruff lint/format, and Pyright pass
- [ ] pgTAP RLS suite passes (`bash supabase/tests/run.sh`)
- [ ] Manually tested the change locally — describe the flow:

## Screenshots / recordings
<!-- For any UI change. Before / after if it's a fix. -->

## Notes / follow-ups
<!-- Known gaps, deliberate scope cuts, or things to do in a later PR. -->
