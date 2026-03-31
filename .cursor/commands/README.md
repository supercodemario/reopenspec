# Cursor workflow — ReOpenSpec (traceable)

Slash commands come from **filenames** in `.cursor/commands/` (e.g. `reo-blueprint.md` → `/reo-blueprint`). For **`/reo:blueprint`**, copy the file to **`reo:blueprint.md`** on macOS/Linux.

## 1 — CLI first

```bash
reo init
```

This (with your installed `reo`):

- Creates **`reopenspec/specs/.meta`**, baseline, **`reopenspec.json`**
- Injects Cursor rules (`.cursor/rules/reopenspec.md`, …)
- Copies **`reo-*.md`** templates into **`.cursor/commands/`**
- Adds **`reopenspec.project.yaml`** if missing

Use **`reo init --skip-workflow`** if you want baseline + config only (no command templates or project YAML).

## 2 — Blueprint (once per repo or when stack changes)

**`/reo:blueprint`** (or `/reo-blueprint`)

- Greenfield vs brownfield
- Writes/refines **`reopenspec.project.yaml`** (work-item integration hints, `reopenspec/changes/` root, traceability paths)
- Architecture docs, **`reopenspec/docs/*`**, **`.cursor/rules`**, gold-standard references

## 3 — Plan a change (traceable)

**`/reo-plan`** with arguments, e.g.:

- Story / task / bug: id format depends on your **configured** integration (skills + `reopenspec.project.yaml` / config)
- Optional **`-comments`** to pull discussion

Behavior:

- Reads **`reopenspec.project.yaml`** and project skills → uses whatever work-item adapter is configured (or **manual** if `none` / unavailable)
- **`/reo-story-skill`** / **`/reo-task-skill`** / **`/reo-bug-skill`** spell out fetch + **dependency / blocker** checks (including defects)
- Compares to **`reopenspec/specs/`** → builds **`delta.md`**
- After you type **`approved`**, creates **`reopenspec/changes/active/<change-domain-id>/`**: `plan.md`, `design.md`, `tasks.md`, `delta.md`, `meta.json`

## 4 — Implement that change

**`/reo-proceed-plan @reopenspec/changes/active/<change-domain-id>`**

Runs through **`tasks.md`**, writes **`implementation.md`**, then commit after approval.

## 5 — Complete (human-run; confirm spec sync)

After you verify proceed-plan work is done, run **`/reo-completed @reopenspec/changes/active/<id>`**.

- The agent **proposes** updates to **`reopenspec/specs/`** — you **confirm** before any write.
- Then you **confirm** again (or once, if you asked for a combined step) before moving the folder to **`reopenspec/changes/completed/…`**.

## 6 — Ship

**`/reo-review`** → **`/reo-test`** → **`/reo-pr`**

---

| File | Slash | Purpose |
|------|--------|---------|
| `reo-blueprint.md` | `/reo-blueprint` | Project YAML + docs + rules |
| `reo-plan.md` | `/reo-plan` | Work item + delta → `reopenspec/changes/active/…/` |
| `reo-story-skill.md` | `/reo-story-skill` | Story fetch helper (usually nested in plan) |
| `reo-task-skill.md` | `/reo-task-skill` | Task + deps helper |
| `reo-bug-skill.md` | `/reo-bug-skill` | Bug/defect fetch + repro (nested in plan) |
| `reo-proceed-plan.md` | `/reo-proceed-plan` | Implement a `reopenspec/changes/active/…/` folder |
| `reo-completed.md` | `/reo-completed` | Propose **`reopenspec/specs/`** sync + archive — **user confirms** before writes / move |
| `reo-implement.md` | `/reo-implement` | Legacy **`reopenspec/specs/<feature>/`** only |
| `reo-spec-work-item.md` | `/reo-spec-work-item` | External work item → `reopenspec/specs/…/overview.md` (optional; needs configured adapter) |
| `reo-review.md` | `/reo-review` | Checks |
| `reo-test.md` | `/reo-test` | E2E / load (optional) |
| `reo-pr.md` | `/reo-pr` | PR |

Example rule templates: **`rules/*.example.mdc`** (copy into `.cursor/rules/` and drop the `.example` from the filename when promoting to production rules, or merge content manually).
