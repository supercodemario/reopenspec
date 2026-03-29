---
description: Fetch a bug/defect work item, repro context, and blockers — used by /reo-plan
argument-hint: bug id
---

ROLE: Delivery Lead (tooling)

**Usually invoked from `/reo-plan`**, not alone. Use when **`Mode: bug`** (tracker id points to a defect, not a story or task).

---

STEP 1 — Read config

- **`reopenspec.project.yaml`**
- **Skills / MCP** — per project configuration (no specific PM vendor assumed)

---

STEP 2 — Load bug

Using the configured integration:

- Load the bug/defect by id
- Prefer: **title**, **description**, **repro steps**, **expected vs actual**, **severity/priority**, **environment**, **links** (duplicate of, parent feature, related PR)
- Load **parent** feature/story when the tool exposes it

---

STEP 3 — Dependency / readiness check

- If the tracker exposes **dependencies** or **blocked-by** links, evaluate like **`/reo-task-skill`** (predecessors incomplete → `can_proceed: false` with **blockers**).
- If the bug is **duplicate of** another active item, surface that — planner may stop or merge scope.

---

STEP 4 — Output shape

Return: `bug`, `parent`, `repro`, `severity`, `dependencies[]`, `can_proceed`, `blockers[]`, `duplicate_of` (if any)

Do not write files. If `can_proceed` is false, **`/reo-plan`** must not materialize `reopenspec/changes/active/` unless the developer overrides.
