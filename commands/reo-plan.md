---
description: Plan a traceable change — work item + delta vs main specs → reopenspec/changes/active/<slug>/ (STRICT CONTRACT)
argument-hint: story|task|bug id, optional -comments, or freeform brief
---

ROLE: Software Architect / Technical Lead

Focus on:
- One **traceable change** folder under `reopenspec/changes/active/<change-domain-id>/`
- **Delta** against existing `reopenspec/specs/` and baseline (what is new vs what already exists)
- Correct **dependency order** before implementation

Do NOT:
- Write `reopenspec/changes/active/**` files on disk before developer **approval**
- Invent work-item fields; fetch via MCP when configured

---

## Flow

1. Load **`reopenspec.project.yaml`** (if missing, stop and ask user to run **`/reo-blueprint`** or `reo init` — or **`reo init --skip-workflow`** was used and they need the YAML template).
2. Resolve **work-item integration** from **`reopenspec.project.yaml`**, **`.cursor/config.json`**, and any **skills** the project added (no hard-coded vendor — adapters are config- and skill-driven).
3. Depending on input, follow **Story**, **Task**, or **Bug** path (see `templates/skills/reo-story-skill.md`, `templates/skills/reo-task-skill.md`, `templates/skills/reo-bug-skill.md` — this command orchestrates them).
4. Load **main-line specs** (`reopenspec/specs/**`, `reopenspec.json`, `reopenspec/specs/.meta/arch-baseline.json`) and summarize **delta** (scope added/changed vs baseline).
5. Show **plan + design + tasks + delta** in chat; After you type **`approved`**, creates **`reopenspec/changes/active/<change-domain-id>/`**: `change.yaml`, `plan.md`, `design.md`, `tasks.md`, `delta.md`.

---

> **Strict contract:** No files under `reopenspec/changes/active/` until STEP 6 approval.

---

STEP 0 — Load project config

Read:

`reopenspec.project.yaml`  
`reopenspec.json` (paths)

Extract:

- `change.root` (default `changes`)
- `platforms.work_tracking`
- `traceability.main_specs_dir` (default `specs`)

If `reopenspec.project.yaml` is missing: **stop** with `Status: CONFIG_REQUIRED` and instructions to run **`/reo-blueprint`**, or re-run **`reo init`** (without **`--skip-workflow`**) to add the template.

---

STEP 1 — Parse arguments

Resolve from `$ARGUMENTS` and conversation:

- **Mode**: `story` | `task` | `bug` | `manual` (no external id — user describes work in chat)
- **Work item id** (format depends on your integration — numeric id, key string, etc.)
- Optional **`-comments`** flag: include latest discussion/comments in extraction

Derive **`change-domain-id`**: stable filesystem-safe slug in the format `<work-item-type>-<id>-<short-slug>` (e.g. `story-1232-user-auth-system`, `task-6568-implement-login-form`, or `bug-9012-login-redirect-loop`).

---

STEP 2 — Fetch work item (if not manual)

**If** the project has a configured work-item path (`platforms.work_tracking` not `none`, and skills/MCP available):

- **Story / feature-level item**: use **`templates/skills/reo-story-skill.md`** behavior — load title, description, acceptance criteria, links.
- **Task-level item**: use **`templates/skills/reo-task-skill.md`** behavior — load task, parent context, predecessors/dependencies, blocked state.
- **Bug / defect item**: use **`templates/skills/reo-bug-skill.md`** behavior — load repro, severity, environment, parent feature, dependencies/duplicates, blocked state.

**If `none` or integration unavailable:** switch to **manual** mode — ask the user to paste title, AC, and scope; still produce delta vs `reopenspec/specs/`.

Detailed fetch steps are aligned with **`templates/skills/reo-story-skill.md`**, **`templates/skills/reo-task-skill.md`**, and **`templates/skills/reo-bug-skill.md`**; do not skip dependency checks for **tasks** or **bugs** when the tracker exposes them.

---

STEP 3 — Gate: can we proceed?

For **tasks**:

- If a **blocking** dependency exists (incomplete predecessor or parent story not ready), **stop** with `Status: BLOCKED` and list blockers — do **not** create `reopenspec/changes/active/` yet unless developer explicitly overrides with a written reason in chat.

For **bugs**:

- Same as tasks when **dependencies / blocked-by** exist; if **duplicate of** an open item, **stop** with `Status: DUPLICATE_OR_BLOCKED` unless the user overrides — **reo-bug-skill** output drives this.
- Carry **repro** and **severity** into **`plan.md`** and **`delta.md`** (fix behavior vs current spec).

For **stories**:

- Proceed unless product explicitly marks blocked; note risks in plan.

---

STEP 4 — Delta vs main specs

Scan **`reopenspec/specs/`** (overviews, architecture, `api-contracts.json` per feature) and baseline summary.

Produce **`delta.md` content** (in chat first):

- **Unchanged baseline** (what we rely on)
- **New or modified contracts/surface** this change introduces
- **Open questions** for the developer

---

STEP 5 — Generate plan, design, tasks (chat only)

Produce:

1. **Implementation plan** (backend / frontend / infra as applicable)
2. **Design notes** (API, UI, data) — Figma links if present in work item
3. **tasks.md** checklist with `[ ]` items
4. **delta.md** full text

Do **not** write files yet.

---

STEP 6 — Developer approval (BLOCKING)

Ask developer to reply with **`approved`** to materialize the change folder.

Until then: **no** `reopenspec/changes/active/**` writes.

---

STEP 7 — After `approved` (write files)

Create:

`<change.root>/active/<change-domain-id>/change.yaml` — rich traceability schema:

```yaml
version: "1"
change_id: "<change-domain-id>"
work_item:
  type: "story|task|bug|manual"
  id: "<id or null>"
  title: "<title parsed or provided>"
  url: "<link to system, if any>"
integration: "<adapter id from config/skills, or null>"
state:
  status: "planned"
  dependencies: [] # listed blockers or precursors
created_at: "<ISO8601>"
```

`<change.root>/active/<change-domain-id>/plan.md`  
`<change.root>/active/<change-domain-id>/design.md`  
`<change.root>/active/<change-domain-id>/tasks.md`  
`<change.root>/active/<change-domain-id>/delta.md`

Optionally update or reference **`reopenspec/specs/`** only if the team wants main-line spec updated in the same commit (default: **change folder is source of truth for this branch** until merged).

---

STEP 8 — Commit (optional)

Commit only these files if the user wants a checkpoint; otherwise leave uncommitted. Do not bundle unrelated changes.

---

STEP 9 — Cursor response

- Status: `PLAN_MATERIALIZED`
- Details: Path to `reopenspec/changes/active/<change-domain-id>/` and summary
- Next: **`/reo-proceed-plan @reopenspec/changes/active/<change-domain-id>`** (or full path)
