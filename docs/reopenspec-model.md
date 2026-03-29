# ReOpenSpec repository model

This document is the **architectural contract** for how we organize work in a ReOpenSpec-enabled repo. It borrows useful ideas from spec-in-repo workflows (including OpenSpec-style deltas) but is **not** a copy of any single tool: it is shaped around **ReOpenSpec** — baseline scanning, drift checks, `api-contracts.json`, and traceable change folders.

## Principles

| Principle | What it means here |
|-----------|-------------------|
| **Three layers, one story** | **docs** explain context and decisions; **specs** state observable behavior and contracts; **changes** carry a single unit of work and its delta until merged. |
| **Specs stay honest** | Domain specs in `reopenspec/specs/` are the behavioral source of truth. Code reality is cross-checked via `reo sync` / drift, not wishful markdown alone. |
| **Active vs completed** | After **`/reo-plan`** (and approval), work lands in **`reopenspec/changes/active/<slug>/`**. When implementation is done and specs are updated, that folder moves to **`reopenspec/changes/completed/`** with a **date prefix** — only **active** work sits under **`active/`**. |
| **Brownfield-first** | New systems and legacy systems both get the same model: describe what *is*, propose deltas for what *changes*. |
| **Lightweight by default** | Use short requirements and scenarios until risk justifies more rigor. |

## Big picture

All ReOpenSpec **project** artifacts live under **`reopenspec/`** at the repository root (alongside application code — not inside the npm package).

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Repository root                                                         │
│                                                                          │
│   reopenspec/                                                            │
│   ├── docs/           ← vision, ADRs, runbooks                           │
│   ├── specs/          ← domain specs, api-contracts.json, .meta/ baseline│
│   └── changes/                                                         │
│       ├── active/     ← in-flight plan, delta, tasks…                  │
│       └── completed/  ← date-prefixed completed work                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**`reopenspec/docs`** answer *why* and *how we run the project*. **`reopenspec/specs`** answer *what the system must do* (behavior + structured contracts). **`reopenspec/changes`** hold each change’s **delta** until it is merged into **`reopenspec/specs/`**.

---

## `reopenspec/docs/` — architecture and project narrative

**Purpose:** Material that is **not** the live behavioral contract: vision, high-level architecture descriptions, onboarding, runbooks, security policies, naming conventions, diagrams, and **ADRs that span domains**.

**Put here**

- System context diagrams, C4 views, deployment narratives.
- “How we work” — branching, review, release.
- Cross-cutting ADRs (standards, stacks).

**Do not use `reopenspec/docs/` for**

- Requirement-level behavior that must stay in sync with code — that belongs in **`reopenspec/specs/`** (and often in **`reopenspec/changes/active/.../delta.md`** while work is in flight).
- Per-ticket implementation detail — that belongs in **`reopenspec/changes/active/<slug>/`** (`design.md`, `tasks.md`, `implementation.md`).

Keeping this boundary clear stops “two truths” (pretty doc vs. tested reality).

---

## `reopenspec/specs/` — domain specifications (source of truth)

**Purpose:** The **canonical description of current intended behavior** for each domain area, plus **machine-checkable** links to code where ReOpenSpec applies.

### Layout (recommended)

Organize by **domain** — feature area, bounded context, or major component group:

```
reopenspec/specs/
├── .meta/
│   ├── arch-baseline.json      # from `reo sync` / scan
│   └── drift-report.json       # from `reo drift`
├── auth/
│   ├── overview.md             # optional narrative
│   ├── api-contracts.json      # maps public surface to baseline symbols
│   └── ...
├── payments/
│   └── ...
```

Use **`reo spec new <slug>`** to scaffold a feature folder when you want the standard files (`overview.md`, `architecture.md`, `api-contracts.json`, `tasks.md`, `decisions.md`, `.spec-meta.json`).

### What a domain spec should contain

- **Observable behavior** — inputs, outputs, errors, invariants users or other systems rely on.
- **Scenarios** — Given / When / Then (or equivalent) for acceptance and tests.
- **RFC 2119-style keywords** where helpful: MUST, SHOULD, MAY.

Avoid embedding **implementation trivia** that can change without changing behavior (framework names, class names) in the *behavior* sections; deeper technical notes can live in `architecture.md` inside the same domain folder or in `reopenspec/docs/` if cross-cutting.

### Contracts and drift

`reopenspec/specs/<domain>/api-contracts.json` ties public API claims to **exports** in the scanned baseline. **`reo sync`** and **`reo drift`** tell you when the codebase and specs disagree. That is the ReOpenSpec twist on “specs in git”: structure + verification, not prose alone.

---

## `reopenspec/changes/` — active work and completed history

**Purpose:** Everything needed to **understand, review, and implement** a single ticket or story **before** its behavior is folded into **`reopenspec/specs/`**.

### Folder layout

| Subfolder | Role |
|-----------|------|
| **`reopenspec/changes/active/`** | One folder per **in-flight** change — created after **`/reo-plan`** approval. |
| **`reopenspec/changes/completed/`** | Finished changes: same slug as in `active/`, but the directory name is **date-prefixed** when moved here after **`/reo-completed`**. |

The default **`change.root`** is **`reopenspec/changes`** (configurable in **`reopenspec.project.yaml`**).

### Naming the slug (after plan)

Use a **single folder name** that reads like a work-item id plus a short hint — paths are always **`reopenspec/changes/active/<slug>/`**, not a second arbitrary nesting under `active/`:

Examples:

- `task-azure-1234-make-login`
- `story-azure-authflow-setup`
- `bug-azure-5678-null-ref-checkout` (defects use the same **`reopenspec/changes/active/<slug>/`** layout)

Your tracker (Azure DevOps, Jira, etc.) + type (`task` / `story`) + id + optional slug is a common pattern; the important part is **one stable directory name** under **`active/`**.

### Active change (typical contents)

```
reopenspec/changes/active/<slug>/
├── change.yaml       # metadata / traceability (when using full workflow)
├── plan.md           # intent, scope, acceptance
├── design.md         # technical approach (how)
├── tasks.md          # checklist
├── delta.md          # human-readable delta vs current reopenspec/specs/
└── implementation.md # what was actually built (often filled during / after implement)
```

### Artifact flow

```
plan  →  delta  →  design  →  tasks  →  implement  →  merge into specs  →  move to completed/
```

Dependencies are **logical**, not bureaucratic: skip `design.md` for tiny fixes if the delta and tasks are enough.

### Delta contents (`delta.md`)

Deltas describe **what changes** relative to `reopenspec/specs/`, not the entire system. A practical structure (compatible with review and merge):

```markdown
## ADDED Requirements
### Requirement: …
#### Scenario: …

## MODIFIED Requirements
### Requirement: …
(What changes vs. current spec.)

## REMOVED Requirements
### Requirement: …
(Deprecation / removal.)
```

Two changes can proceed in parallel if they touch **different requirements** or domains; conflicts appear at merge time into `reopenspec/specs/`, same as code.

### Completing a change (move to `completed/`)

When implementation is done, use **`/reo-completed`**. The **human** verifies proceed-plan work first. The **agent proposes** how **`delta.md`** / **`implementation.md`** map into updates under **`reopenspec/specs/`**; the **user must confirm** before any **`reopenspec/specs/`** write, then confirm again (or once, if the team opts in) before archiving:

1. **Merge** the agreed delta and contract updates into the right files under **`reopenspec/specs/`** (only after confirmation).
2. **Move** the folder from **`reopenspec/changes/active/<slug>/`** to **`reopenspec/changes/completed/<YYYY-MM-DD>-<slug>/`** (only after confirmation).

The **date prefix** is the completion (or archive) date — **`YYYY-MM-DD`** sorts lexicographically by time. Example:

- Active: `reopenspec/changes/active/task-azure-1234-make-login/`
- Completed: `reopenspec/changes/completed/2026-02-06-task-azure-1234-make-login/`

If your team prefers another date format (e.g. `DD-MM-YYYY`), you can use it consistently — ISO dates are recommended for folder sorting.

Completed folders stay in **`reopenspec/changes/completed/`** for audit and postmortems; **`reopenspec/changes/active/`** only lists work that is still open.

---

## How this relates to OpenSpec-style ideas

| Idea | In ReOpenSpec |
|------|----------------|
| Main specs + delta changes | **`reopenspec/specs/`** + **`reopenspec/changes/active/<slug>/delta.md`** (optional extra `specs/` subtree under that change if you split deltas by domain). |
| Archive | **`reopenspec/changes/completed/`** (date-prefixed folder names). |
| Schemas / strict phases | Optional. Use **`reopenspec.project.yaml`** and slash commands for *your* team’s strictness; the CLI does not block commits on phases. |
| Verification | **`reo`** gives **baseline + drift**; tests and review complete the loop. |

---

## Traceability configuration

`reopenspec.project.yaml` (from **`reo init`**) can set:

- **`change.root`** — root for **`active/`** and **`completed/`** (default **`reopenspec/changes`**).
- **`traceability.main_specs_dir`** — usually **`reopenspec/specs`**.
- **`traceability.baseline_json`** — default **`reopenspec/specs/.meta/arch-baseline.json`**.

`reopenspec.json` controls **`specsDir`**, baseline path, and drift report path for the CLI.

---

## Glossary

| Term | Meaning |
|------|--------|
| **Domain spec** | A folder under `reopenspec/specs/<domain>/` describing behavior and contracts for that area. |
| **Delta** | The diff of behavior vs. current `reopenspec/specs/`, usually in `reopenspec/changes/active/<slug>/delta.md`. |
| **Baseline** | `arch-baseline.json` — structured snapshot of code exports used for drift. |
| **Completed change** | Former active folder under `reopenspec/changes/completed/<YYYY-MM-DD>-<slug>/`. |

---

## Next steps

- **CLI overview:** the root **`README.md`** in the `reopenspec` package (npm / clone).
- **Slash-command workflows:** packaged as **`commands/README.md`**; after **`reo init`** (without **`--skip-workflow`**), a copy lives at **`.cursor/commands/README.md`** in your repo for quick reference.
