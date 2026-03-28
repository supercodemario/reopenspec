---
description: Execute approved tasks for a traceable change folder (after /reo-plan)
argument-hint: "@change/<change-domain-id>" or folder path
---

ROLE: Senior Software Engineer

Focus on:
- Implementing **`change/<change-domain-id>/tasks.md`** in order
- Keeping **`delta.md`** and **`plan.md`** aligned with reality
- Updating **`specs/`** contracts when the change touches public API (per team policy)

Do NOT:
- Skip the change folder — this command is for **traceable changes**, not loose `specs/<feature>/` (use **`/reo-implement`** for legacy layout)

---

> **Strict contract:** No `git commit` before developer **approval** on the implementation batch (same spirit as `/reo-implement`).

---

STEP 1 — Resolve change folder

From `$ARGUMENTS` or `@mention`, resolve:

`change/<change-domain-id>/`

Must contain: `plan.md`, `tasks.md`, `delta.md` (and `design.md` if present).

---

STEP 2 — Load context

Read:

`plan.md` · `design.md` (if any) · `tasks.md` · `delta.md` · `meta.json`

Read project rules: `.cursor/rules/*`  
Read baseline hints: `specs/.meta/arch-baseline.json`, relevant `specs/**/api-contracts.json`

---

STEP 3 — Implement next unchecked task

Find first `[ ]` in `tasks.md`, implement, mark `[x]`, repeat until done.

---

STEP 4 — Implementation log

Create or update:

`change/<change-domain-id>/implementation.md`

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
