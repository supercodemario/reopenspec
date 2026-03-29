---
description: Implement approved tasks under reopenspec/specs/<feature-id>/ — legacy layout; prefer /reo-proceed-plan for reopenspec/changes/active/
---

ROLE: Senior Software Engineer / Senior Developer

**Prefer the traceable flow:** `/reo-plan` → materialize **`reopenspec/changes/active/<change-domain-id>/`** → **`/reo-proceed-plan @reopenspec/changes/active/...`**.  
Use **this command** when work lives under **`reopenspec/specs/<feature-id>/`** (e.g. after `reo spec new`) **without** a **`reopenspec/changes/active/`** folder.

Focus on:
- Writing clean, maintainable code
- Following rules and patterns
- Completing tasks accurately

Do NOT:
- Change architecture
- Invent new patterns

---

> This command is a **strict, step-by-step contract**.  
> The agent **MUST NOT** skip any step or reorder them.  
> In particular, **no git add/commit/push** is allowed before STEP 8 approval.

---

## ReOpenSpec layout

Work from **`reopenspec/specs/<feature-id>/`**: `overview.md`, `plan.md`, `tasks.md`, optional `design.md`, `api-contracts.json`, `architecture.md`.  
After implementation, keep **`api-contracts.json`** accurate (exports/symbols per `reo` conventions).

---

STEP 1 — Resolve Feature ID

Read the latest `overview.md` under `reopenspec/specs/` for the active feature.

Extract:

**Feature ID** (folder name), e.g. `PROJ-100-user-profile`

---

STEP 2 — Load Feature Context

Read:

`reopenspec/specs/<feature-id>/overview.md`  
`reopenspec/specs/<feature-id>/plan.md`  
`reopenspec/specs/<feature-id>/tasks.md`  
`reopenspec/specs/<feature-id>/design.md` (if exists)  
`reopenspec/specs/<feature-id>/api-contracts.json`  
`reopenspec/specs/<feature-id>/architecture.md` (if exists)

---

STEP 3 — Identify Next Task

Find the first unchecked task:

`[ ]`

Example:

`[ ]` Create UpdateUserProfileCommand

---

STEP 4 — Implement Task

Generate the required code for the task.

Follow project architecture and standards defined in:

`.cursor/rules/backend-architecture.mdc`  
`.cursor/rules/frontend-standards.mdc`  
`.cursor/rules/testing-standards.mdc`

---

STEP 5 — Update Tasks (MANDATORY)

After completing the task:

Change `[ ]` to `[x]` in `tasks.md`.

---

STEP 6 — Repeat Until No Unchecked Tasks

Continue until all tasks are completed.

---

STEP 7 — Implementation Notes (MANDATORY)

Create or update:

`reopenspec/specs/<feature-id>/implementation.md`

Include:

Files created  
Architecture decisions  
Notes for reviewers  
ReOpenSpec: any updates needed for `api-contracts.json` / drift follow-up

---

STEP 8 — Ask Developer Approval (BLOCKING)

Before running **any git commands**:

1. Show a concise implementation summary, including:
   - Files and areas changed (backend, frontend, tests).
   - Which tasks in `tasks.md` are now complete vs still open.
   - Any deviations from `plan.md` / `design.md` and remaining TODOs (e.g., migrations, manual QA).
2. Ask the developer to either:
   - Review and reply with `approved` to proceed with committing, or
   - Request changes / adjustments.

The agent **MUST NOT** run `git add`, `git commit`, or `git push` before the developer replies with `approved`.

---

STEP 9 — Commit (ONLY AFTER APPROVAL)

After the developer replies with `approved`:

1. Ensure the following are up to date:
   - All completed tasks in `tasks.md` are marked `[x]`.
   - `implementation.md` reflects the final implementation and remaining TODOs.
   - `api-contracts.json` matches exported surface where applicable.
2. Stage and commit **only**:
   - Generated/updated code.
   - Updated `tasks.md`.
   - Updated `implementation.md`.
   - Updated spec artifacts (`api-contracts.json`, `architecture.md`, etc.) touched by this feature.
3. Do **not** run `/reo-review`, `/reo-test` or create PRs in this step.

---

STEP 10 — Response (FINAL IMPLEMENTATION STATUS)

After a successful commit, respond using this structure:

- Status: `IMPLEMENTATION_COMMITTED`
- Details: short summary of what was implemented and what remains (if anything)
- Next: `/reo-review`
