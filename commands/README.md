# Cursor workflow — ReOpenSpec (traceable)

Slash commands come from **filenames** in `.cursor/commands/` (e.g. `reo-blueprint.md` → `/reo-blueprint`). For **`/reo:blueprint`**, copy the file to **`reo:blueprint.md`** on macOS/Linux.

## 1 — CLI first

```bash
reo init
```

This (with your installed `reo`):

- Creates **`specs/.meta`**, baseline, **`reopenspec.json`**
- Injects Cursor rules (`.cursor/rules/reopenspec.md`, …)
- Copies **`reo-*.md`** templates into **`.cursor/commands/`**
- Adds **`reopenspec.project.yaml`** if missing

Use **`reo init --skip-workflow`** if you want baseline + config only (no command templates or project YAML).

## 2 — Blueprint (once per repo or when stack changes)

**`/reo:blueprint`** (or `/reo-blueprint`)

- Greenfield vs brownfield
- Writes/refines **`reopenspec.project.yaml`** (work-item integration hints, `change/` root, traceability paths)
- Architecture docs, **`docs/*`**, **`.cursor/rules`**, gold-standard references

## 3 — Plan a change (traceable)

**`/reo-plan`** with arguments, e.g.:

- Story / task: id format depends on your **configured** integration (skills + `reopenspec.project.yaml` / config)
- Optional **`-comments`** to pull discussion

Behavior:

- Reads **`reopenspec.project.yaml`** and project skills → uses whatever work-item adapter is configured (or **manual** if `none` / unavailable)
- **`/reo-story-skill`** / **`/reo-task-skill`** spell out fetch + **task dependency / blocker** checks
- Compares to **`specs/`** → builds **`delta.md`**
- After you type **`approved`**, creates **`change/<change-domain-id>/`**: `plan.md`, `design.md`, `tasks.md`, `delta.md`, `meta.json`

## 4 — Implement that change

**`/reo-proceed-plan @change/<change-domain-id>`**

Runs through **`tasks.md`**, writes **`implementation.md`**, then commit after approval.

## 5 — Ship

**`/reo-review`** → **`/reo-test`** → **`/reo-pr`**

---

| File | Slash | Purpose |
|------|--------|---------|
| `reo-blueprint.md` | `/reo-blueprint` | Project YAML + docs + rules |
| `reo-plan.md` | `/reo-plan` | Work item + delta → `change/…/` |
| `reo-story-skill.md` | `/reo-story-skill` | Story fetch helper (usually nested in plan) |
| `reo-task-skill.md` | `/reo-task-skill` | Task + deps helper |
| `reo-proceed-plan.md` | `/reo-proceed-plan` | Implement a `change/` folder |
| `reo-implement.md` | `/reo-implement` | Legacy **`specs/<feature>/`** only |
| `reo-spec-work-item.md` | `/reo-spec-work-item` | External work item → `specs/…/overview.md` (optional; needs configured adapter) |
| `reo-review.md` | `/reo-review` | Checks |
| `reo-test.md` | `/reo-test` | E2E / load (optional) |
| `reo-pr.md` | `/reo-pr` | PR |

Example rule templates: **`rules/*.example.mdc`** (copy into `.cursor/rules/` and drop the `.example` from the filename when promoting to production rules, or merge content manually).
