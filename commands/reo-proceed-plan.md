---
description: Execute approved tasks for a traceable change folder (after /reo-plan)
argument-hint: "@reopenspec/changes/active/<change-domain-id>" or folder path
---

ROLE: Senior Software Engineer

Focus on:
- Implementing **`reopenspec/changes/active/<change-domain-id>/tasks.md`** in order
- Keeping **`delta.md`** and **`plan.md`** aligned with reality
- Updating **`reopenspec/specs/`** contracts when the change touches public API (per team policy)

Do NOT:
- Skip the change folder — this command is for **traceable changes**, not loose `reopenspec/specs/<feature>/` (use **`/reo-implement`** for legacy layout)

---

> **Strict contract:** No `git commit` before developer **approval** on the implementation batch (same spirit as `/reo-implement`).

---

STEP 1 — Resolve change folder

From `$ARGUMENTS` or `@mention`, resolve:

`reopenspec/changes/active/<change-domain-id>/`

Must contain: `plan.md`, `tasks.md`, `delta.md` (and `design.md` if present).

---

STEP 2 — Load context

Read:

`plan.md` · `design.md` (if any) · `tasks.md` · `delta.md` · `meta.json`

Read project rules: `.cursor/rules/*`  
Read baseline hints: `reopenspec/specs/.meta/arch-baseline.json`, relevant `reopenspec/specs/**/api-contracts.json`

---

STEP 3 — Implement next unchecked task

Find first `[ ]` in `tasks.md`, implement, mark `[x]`, repeat until done.

---

STEP 4 — Implementation log

Create or update:

`reopenspec/changes/active/<change-domain-id>/implementation.md`

Sections: files touched, decisions, deviations from plan, follow-ups for **`reo sync`**.

---

STEP 5 — Approval before commit (BLOCKING)

Show summary; wait for **`approved`** before `git add`/`commit`.

---

STEP 6 — After `approved`

Commit change folder + code with a message referencing `change-domain-id` and work item id from `meta.json`.

---

STEP 7 — Response

- Status: `CHANGE_IMPLEMENTATION_COMMITTED`
- Next: `/reo-review` → `/reo-test` → `/reo-pr`
