---
description: Fetch a task work item, parent context, and dependencies — block if not ready (used by /reo-plan)
argument-hint: task id
---

ROLE: Delivery Lead (tooling)

**Usually invoked from `/reo-plan`**, not alone.

---

STEP 1 — Read config

- **`reopenspec.project.yaml`**
- **Skills / MCP** — per project configuration (no specific PM vendor assumed)

---

STEP 2 — Load task and parent

Using the configured integration:

- Load the task by id
- Load **parent** story/feature (or equivalent) when the tool exposes it

---

STEP 3 — Dependency check

- List predecessor / dependency links your process uses
- For each: resolved state (complete vs not)
- If any blocking item is incomplete → **`can_proceed: false`** and list **blockers**

---

STEP 4 — Output shape

Return: `task`, `parent`, `dependencies[]`, `can_proceed`, `blockers[]`

Do not write files. If `can_proceed` is false, **`/reo-plan`** must not materialize `reopenspec/changes/active/` unless the developer overrides.

For **bugs/defects** (separate work-item type in many trackers), prefer **`templates/skills/reo-bug-skill.md`**.
