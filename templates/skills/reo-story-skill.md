---
description: Fetch a story-level work item via the project's configured integration — used by /reo-plan
argument-hint: work item id
---

ROLE: Business Analyst (tooling)

**Usually invoked from `/reo-plan`**, not alone. Keeps story fetch behavior consistent with your **skills** and **`reopenspec.project.yaml`**.

---

STEP 1 — Read config

- **`reopenspec.project.yaml`** — `platforms`, optional `integrations`
- **Project skills / MCP** — follow the adapter your team documented (no vendor assumed here)

---

STEP 2 — Fetch

Using the **configured** work-item integration:

- Load the item by id from **`$ARGUMENTS`**
- Return: title, description, acceptance criteria, state, links (parent/child) when available
- If the item is a **task** rather than a story-level item, note that **`/reo-task-skill`** may be more appropriate
- If the item is a **bug/defect**, note that **`/reo-bug-skill`** may be more appropriate

---

STEP 3 — Output shape (for planner)

Return a structured block: `id`, `type`, `title`, `body`, `acceptance_criteria[]`, `links[]`, `raw_state`

Do not write files.
