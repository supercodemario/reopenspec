---
description: Blueprint the repository — project YAML, architecture, docs, and IDE rules (greenfield or brownfield)
---

<!-- Slash: `/reo-blueprint` or copy file to `reo:blueprint.md` → `/reo:blueprint` (macOS/Linux). -->

## Traceable workflow (where this fits)

1. **`reo init`** — CLI lays down IDE rules + copies slash commands + `reopenspec.project.yaml` when missing (omit with **`reo init --skip-workflow`**). It also adds `.reopenspec.user.yaml` to `.gitignore`.
2. **`/reo-blueprint`** (this command) — **Initial** pass: classify greenfield vs brownfield, write **`reopenspec.project.yaml`**, architecture + guidelines, IDE rules (reading local `.reopenspec.user.yaml` for tool choice), gold-standard files.
3. **`/reo-plan`** — Pull story / task / bug via **configured** skills/MCP (see `reopenspec.project.yaml`), compute **delta vs `reopenspec/specs/`**, then after approval write **`reopenspec/changes/active/<change-domain-id>/`** (`change.yaml`, `plan.md`, `design.md`, `tasks.md`, `delta.md`).
4. **`/reo-proceed-plan`** — Start implementation for a traced change folder.
5. **`/reo-review`** → **`/reo-test`** → **`/reo-pr`** — Quality gates before merge.
6. **`/reo-completed`** — Propose spec sync to `reopenspec/specs/`, archive change folder to `reopenspec/changes/completed/YYYY-MM-DD-<slug>/`.

ROLE: System Analyst / Technical Analyst

You are analyzing an existing codebase.

Focus on:
- Understanding architecture deeply
- Identifying patterns (not changing them)
- Extracting conventions

Do NOT:
- Suggest improvements unless asked
- Introduce new architecture

---

## ReOpenSpec context

If the repo uses ReOpenSpec, treat **`reopenspec/specs/.meta/arch-baseline.json`** (or paths in `reopenspec.json`) as the source of structural truth for modules and contracts. Blueprint output (docs and rules) should **align** with that baseline, not contradict it.

---

## Re-run (idempotency) policy

When `/reo-blueprint` is run **again** on a repo that was already blueprinted:

- **`reopenspec.project.yaml`**: merge missing keys only — **never** overwrite values the developer has set.
- **`reopenspec/docs/*`**: regenerate sections that are clearly outdated (compare against current codebase); preserve manual edits and author additions (check `git blame` when available).
- **IDE rules**: overwrite — rules should always reflect the latest analysis.
- **Gold standards** (`reopenspec/docs/gold-standards.md`): re-evaluate — codebase evolves between runs.
- **`reopenspec/docs/anti-patterns.md`**: append newly found items; do not remove previously flagged entries unless the code was fixed.

---

## STEP 0 — Detect Project Type

Classify the repository as **GREENFIELD** or **BROWNFIELD** using these heuristics:

**GREENFIELD** if **any** of the following are true:
- Fewer than 5 source files (excluding config, lock files, and dotfiles)
- No `src/`, `app/`, `lib/`, or equivalent source directory exists
- Total lines of code < 200

**BROWNFIELD** otherwise.

---

### If GREENFIELD

1. Generate a default architecture proposal.
2. Ask the developer to select:
   - Backend stack (e.g. Node/Express, .NET, Java/Spring, Go, Python/FastAPI)
   - Frontend stack (e.g. React, Vue, Angular, Next.js, none)
   - Architecture style (e.g. Layered, Clean, Hexagonal, Modular Monolith)
3. After selection, create:
   - `reopenspec.project.yaml` (with `project_type: greenfield`)
   - IDE rules (path based on `.reopenspec.user.yaml` — see STEP 4)
   - `reopenspec/docs/architecture.md` (from selected stack)
   - `reopenspec/docs/backend-guidelines.md` (stub from selected backend stack)
   - `reopenspec/docs/frontend-guidelines.md` (stub from selected frontend stack, skip if `none`)
   - `reopenspec/docs/testing-guidelines.md` (stub with recommended framework for chosen stack)
   - `reopenspec/specs/.meta/` directory structure
4. **Skip** STEP 3 entirely (Gold Standard + Anti-Patterns) — there is no existing code to evaluate.
5. Proceed to STEP 4 (IDE Rules), then STEP 7 (Developer Review).

---

### If BROWNFIELD

Proceed with full analysis (STEP 0.5 onward).

---

## STEP 0.5 — Project workflow config (`reopenspec.project.yaml`)

At repository root, create **`reopenspec.project.yaml`** if it does not exist (or merge missing keys only — never overwrite existing values).

Use this shape (fill values from discovery — must match the [template](../templates/reopenspec.project.yaml)):

```yaml
version: "1"

# greenfield | brownfield
project_type: <from STEP 0>

# How work items are fetched: set by your team (skills + config read this)
# Examples: none | configured (see integrations below)
platforms:
  work_tracking: none

# Optional: document integration endpoints for agents (no secrets in git — use env / IDE)
# integrations:
#   work_items:
#     provider: "<your-adapter-id>"
#     config_ref: ".cursor/config.json"

change:
  root: reopenspec/changes

traceability:
  main_specs_dir: reopenspec/specs
  reopenspec_config: reopenspec.json
  baseline_json: reopenspec/specs/.meta/arch-baseline.json
```

This file is the **single place** agents read for "where do changes go" and how work items are resolved (details delegated to skills + config — **no vendor lock-in in prose here**). Keep it valid YAML.

---

## STEP 1 — Repository Analysis

Analyze the codebase.

### Complexity gate

If the repo has **> 500 source files**:
- Start with **directory-level analysis** (folder structure + key entry points) rather than reading every file.
- **Sample 3–5 representative files per module** for pattern detection.
- Focus gold-standard search on **recently modified files** (`git log --diff-filter=M --name-only -n 100`).
- Note in the output which modules were sampled vs fully analyzed.

### Identify

- Architecture pattern (Layered, Clean, Hexagonal, MVC, Microservices, etc.)
- Backend tech stack (Node, .NET, Java, etc.)
- Frontend tech stack (React, Vue, Angular, etc.)
- Folder structure and module organization
- API patterns (REST, GraphQL, etc.)
- Data access patterns
- Testing frameworks and strategy
- Build and deployment setup
- Coding conventions and naming patterns
- **ReOpenSpec**: presence of `reopenspec/specs/`, `reopenspec.json`, baseline/drift artifacts

Generate a structured analysis summary.

---

## STEP 2 — Generate Base Documentation

Create the following files (when missing or clearly outdated):

`reopenspec/docs/architecture.md`  
`reopenspec/docs/backend-guidelines.md`  
`reopenspec/docs/frontend-guidelines.md`  
`reopenspec/docs/testing-guidelines.md`

Each file should include:

Architecture:
- High-level system design
- Key components and interactions
- Identified architecture pattern with justification

Backend Guidelines:
- Layer structure
- Coding patterns
- Data access approach
- API conventions

Frontend Guidelines:
- Component structure
- State management
- Styling approach
- API integration pattern

Testing Guidelines:
- Testing frameworks used
- Unit/integration/e2e strategy
- Coverage expectations

---

## STEP 3 — Identify Gold Standard Files

> **Skip this step entirely for GREENFIELD projects** (no existing code to evaluate).

Analyze the entire repository and identify "Gold Standard" code files.

Definition of Gold Standard:
Files that best represent correct and high-quality implementation patterns in this codebase.

---

### STEP 3.1 — Identify Candidate Files

Scan the repository and shortlist files across:

Backend:
- Controllers / API handlers
- Services / business logic
- Repositories / data access

Frontend (if applicable):
- Pages / views
- Reusable components
- State management modules

Testing:
- Unit tests
- Integration tests
- E2E tests

---

### STEP 3.2 — Evaluate Code Quality

For each candidate file, evaluate based on these dimensions in **priority order** (descending):

1. **Architecture Adherence** (critical):
   - Follows actual project architecture (layered, MVC, etc.)
   - No layer violations

2. **Consistency** (high):
   - Matches patterns used across the repo
   - Follows existing conventions

3. **Separation of Concerns** (high):
   - Logic is not mixed across layers
   - Clear responsibilities

4. **Readability & Maintainability** (medium):
   - Clear naming conventions
   - Small, focused functions
   - Minimal complexity

5. **Error Handling** (medium):
   - Proper validation and exception handling

6. **Testability** (medium):
   - Code is testable and has corresponding tests (if applicable)

7. **Avoidance of Anti-patterns** (baseline):
   - No God classes / overly large files
   - No dead or unused code
   - No inconsistent patterns

---

### STEP 3.3 — Rank Files

Score each file from 1–10 based on the weighted dimensions above (Architecture Adherence and Consistency carry the most weight).

Select:

- Top 2–3 Backend files
- Top 2–3 Frontend files (if applicable)
- Top 2–3 Test files

---

### STEP 3.4 — Extract Patterns

For each selected file, extract:

- Key design patterns used
- Naming conventions
- Structural patterns (layer flow, file organization)
- API patterns (request/response handling)
- Testing patterns

---

### STEP 3.5 — Output & Persist

Return results in this structure:

## Gold Standard Files

### Backend
1. <file-path>
   - Score: X/10
   - Why selected:
   - Patterns observed:

### Frontend
...

### Testing
...

## Common Patterns Identified

- Architecture pattern:
- Naming conventions:
- Error handling strategy:
- Testing strategy:

**Save results to:** `reopenspec/docs/gold-standards.md`

This file is referenced by IDE rules and downstream commands. Keep it updated on re-runs.

---

### STEP 3.6 — Guardrail

IMPORTANT:

- Do NOT select files just because they are large or central
- Avoid legacy or inconsistent files
- Prefer files that are clean, consistent, and easy to understand
- If multiple patterns exist, choose the most consistent and widely used one

---

### STEP 3.7 — Identify Anti-Patterns

Detect:

- Files violating architecture
- Inconsistent implementations
- Overly complex or tightly coupled modules

Save to:

`reopenspec/docs/anti-patterns.md`

These must NOT be used as references. Do NOT inject anti-pattern file paths or content into IDE rules — this file is for **human review only** to guide refactoring priorities.

---

## STEP 4 — Review & Refine IDE Rules

> **`reo init` copies categorized rules** (generic always, specific per detected/requested stack). This step **reviews** what was placed and refines it against the actual analysis — it does NOT generate all rules from scratch.

Read `.reopenspec.user.yaml` (at the workspace root) to detect the preferred `ide` (e.g., `cursor`, `windsurf`, `roo`).
If the file doesn't exist, create it with `{ide: "cursor"}` (and ensure it's in `.gitignore`).

IDE rules directory:
- **Cursor**: `.cursor/rules/*.mdc`
- **Windsurf/Cascade**: `.windsurfrules/*.md` (or `.cascade/`)
- **Roo/Cline**: `.roo/*.md` (or `.cline/`)
- **Unknown / unsupported `ide` value**: fall back to `.ai-context/AGENTS.md`

### 4.1 — Inventory placed rules

List all rule files `reo init` already placed in the IDE rules directory. Categorize them:

- **Generic** (always present): `ai-generation-guardrails`, `command-workflow`, `command-plan-guidelines`, `command-implement-guidelines`, `command-review-guidelines`
- **Stack-specific** (present only if the matching stack was detected or requested): `backend-architecture`, `backend-code-quality`, `backend-security`, `frontend-standards`, `frontend-design-guidelines`, `frontend-figma-guidelines`, `database-sql-standards`, `testing-standards`, `deploy-ci-cd-standards`

### 4.2 — Validate rules against analysis

Compare each placed stack-specific rule against the STEP 1 analysis:

- Do backend rules match the actual backend stack and architecture? (e.g., rules say "Clean Architecture + CQRS" but analysis found "Layered MVC")
- Do frontend rules match the actual frontend framework? (e.g., Vue rules but project uses React)
- Are there missing rules for a stack that was detected but not covered?

### 4.3 — Ask the user

Present a summary:

> "The following rules were placed by `reo init`. Based on my analysis, here is the alignment status:"
>
> | Rule file | Status | Notes |
> |-----------|--------|-------|
> | `backend-architecture.mdc` | ✅ Aligned | Matches Clean Architecture found in codebase |
> | `frontend-standards.mdc` | ⚠️ Mismatched | Rule is for Vue but project uses React |
> | `database-sql-standards.mdc` | ❌ Missing | Database detected but no rule was placed |
>
> "Do you want me to update any rules, add missing ones, or remove mismatched ones?"

Wait for the user's response before modifying any rule files.

### 4.4 — Generate project-specific context rules (from analysis)

These are **NOT from templates** — they are generated from the STEP 1–3 analysis:

#### `system-architecture` (or `repo-context`)
Must include: project type (greenfield/brownfield), primary language, framework, folder structure convention, architecture pattern, baseline path (`reopenspec/specs/.meta/arch-baseline.json`).

#### Gold-standard references
Update any rule that references gold-standard files to include the actual paths from `reopenspec/docs/gold-standards.md`.

### 4.5 — Apply updates (after user confirmation only)

Update, add, or remove rule files per the user's instructions.

Rules must:

- Reflect actual project architecture (NOT assumptions)
- Reference detected patterns and conventions
- Include Gold Standard file references (from `reopenspec/docs/gold-standards.md`) where applicable
- Avoid introducing new patterns not present in codebase
- **Reference ReOpenSpec baseline/drift** when the repo uses `reo` / `reopenspec/specs/.meta/`

---

## STEP 5 — Refactor Commands Compatibility

Scan workflow commands in:

`.cursor/commands/` (if present)  
or the repo's `commands/` folder (e.g. ReOpenSpec's bundled `reo-*.md` templates)

Replace hardcoded tech assumptions with:

"Follow project rules defined in IDE rules and ReOpenSpec baseline/contracts where applicable."

Ensure compatibility with the full command chain:

- `/reo-plan` (orchestrates story/task/bug skills from `templates/skills/` internally)
- `/reo-spec-work-item` (optional: fill `reopenspec/specs/…/overview.md` from external item)
- `/reo-proceed-plan`
- `/reo-implement` (legacy `reopenspec/specs/<feature>/` path)
- `/reo-review` · `/reo-test` · `/reo-pr`
- `/reo-completed` (spec sync + archive to `reopenspec/changes/completed/`)

---

## STEP 6 — Validation

Validate that:

- Rules align with actual codebase
- No conflicting architecture instructions exist
- Commands are tech-agnostic aside from documented optional tools (MCP, etc.)
- `reopenspec.project.yaml` schema matches the [template](../templates/reopenspec.project.yaml)

---

## STEP 7 — Developer Review

Show:

- Architecture summary
- Generated docs
- Generated rules
- Gold standard references (if brownfield)

Ask developer to:

Review  
Modify if needed  
Approve by typing:

`approved`

---

## STEP 8 — Finalize

After approval:

- Save all generated files
- Commit changes

---

## STEP 9 — Response

Status codes:

| Status | Meaning |
|--------|---------|
| `BLUEPRINT_COMPLETE` | Full analysis done, docs + rules generated, approved |
| `BLUEPRINT_PARTIAL` | Docs generated but some steps skipped (e.g. IDE unknown, no frontend) |
| `BLUEPRINT_ANALYSIS_FAILED` | Could not determine architecture (too few signals) |
| `CONFIG_REQUIRED` | Missing `.reopenspec.user.yaml` or critical config |

Details: Project analyzed, `reopenspec.project.yaml` ensured, rules generated  
Next: `/reo-plan` (with story/task/bug id or manual brief); optional `reo spec new <slug>` for main-line specs under `reopenspec/specs/`
