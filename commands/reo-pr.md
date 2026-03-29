---
description: Push branch and open pull request (STRICT CONTRACT)
argument-hint: work item id or key (optional; for message/title)
---

ROLE: DevOps Engineer

Focus on:
- Stage & commit remaining changes
- Pull request creation

Do NOT:
- Commit directly to `master` or `main`

---

> This command is for **final integration**.  
> Run after `/reo-review` and `/reo-test` have passed (or after explicit team agreement to skip).  
> If there is **nothing new to commit** since the last feature commit, skip staging/commit and only push + open PR.

---

## ReOpenSpec layout

**Traceable flow:** primary docs under **`reopenspec/changes/active/<change-domain-id>/`** (`tasks.md`, `implementation.md`, `delta.md`).  
**Legacy:** **`reopenspec/specs/<feature-id>/`**.

---

STEP 0 — Definition of Done Validation

Ensure:

- All tasks in **`reopenspec/changes/active/.../tasks.md`** or **`reopenspec/specs/.../tasks.md`** (depending on branch) are completed
- No **blocking** TODOs remain in code (tracked `TODO`s with a ticket reference may be acceptable per team policy)
- Artifacts updated (`implementation.md`, `api-contracts.json` if contracts changed, etc.)
- Test coverage meets project standards (or gaps are documented)
- No failing tests from the last review/test runs

If not:

Fail with actionable items.

---

STEP 1 — Stage Changes

- Stage only changes that belong to this feature branch:
  - Backend and frontend code for the feature
  - Updated tests
  - Updated files under `reopenspec/changes/active/<CHANGE_ID>/` and/or `reopenspec/specs/<FEATURE_ID>/`

Avoid `git add .` if it would include unrelated files (local config, build artifacts).

---

STEP 2 — Commit (if needed)

If there are staged changes, use a descriptive commit message, including the work item id/key when `$ARGUMENTS` is provided:

`"$ARGUMENTS - finalize feature"`

If the working tree for this feature is already committed, omit this step.

---

STEP 3 — Push Branch

Push the current feature branch (adjust remote/branch naming to match the repo):

`git push -u origin HEAD`

Use the actual branch name (e.g. `feature/PROJ-100-user-profile`).

---

STEP 4 — Create Pull Request

Create a PR that includes:

- Work item / ticket link (when applicable)
- Concise feature summary
- Key implementation notes
- Testing notes (what was run, results)

Reference documentation (as applicable):

**If using traceable changes:** `reopenspec/changes/active/$CHANGE_ID/plan.md`, `tasks.md`, `delta.md`, `design.md`, `implementation.md`, `meta.json`

**If using `reopenspec/specs/`:** `reopenspec/specs/$FEATURE_ID/overview.md`, `plan.md`, `tasks.md`, `design.md`, `implementation.md`, `api-contracts.json`

---

STEP 5 — Cursor Response

- Status: `PR_CREATED`
- Details: Pull request created (include PR URL if available)
- Next: Await code review by TL/PM
