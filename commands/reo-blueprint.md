---
description: Blueprint the repository — project YAML, architecture, docs, and Cursor rules (greenfield or brownfield)
---

<!-- Slash: `/reo-blueprint` or copy file to `reo:blueprint.md` → `/reo:blueprint` (macOS/Linux). -->

## Traceable workflow (where this fits)

1. **`reo init`** — CLI lays down IDE rules + copies slash commands + `reopenspec.project.yaml` when missing (omit with **`reo init --skip-workflow`**). It also adds `.reopenspec.user.yaml` to `.gitignore`.
2. **`/reo:blueprint`** (this command) — **Initial** pass: classify greenfield vs brownfield, write **`reopenspec.project.yaml`**, architecture + guidelines, IDE rules (reading local `.reopenspec.user.yaml` for tool choice), gold-standard files.
3. **`/reo-plan`** — Pull story / task / bug via **configured** skills/MCP (see `reopenspec.project.yaml`), compute **delta vs `reopenspec/specs/`**, then after approval write **`reopenspec/changes/active/<change-domain-id>/`** (`plan.md`, `design.md`, `tasks.md`, `delta.md`).
4. **`/reo-proceed-plan`** — Start implementation for a traced change folder.

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

STEP 0 — Detect Project Type

If repository is empty or has minimal structure:

Classify as GREENFIELD project.

If GREENFIELD:

- Generate default architecture proposal
- Ask developer to select:
  - Backend stack
  - Frontend stack
  - Architecture style

Create initial:

Create initial:

(Target IDE rules path based on `.reopenspec.user.yaml`, e.g., `.cursor/rules/*` or `.windsurfrules/*`)
`reopenspec/docs/*`

Then proceed.

If BROWNFIELD:

Proceed with full analysis.

---

STEP 0.5 — Project workflow config (`reopenspec.project.yaml`)

At repository root, create **`reopenspec.project.yaml`** if it does not exist (or merge missing keys only).

Use this shape (fill values from discovery):

- `version`: `"1"`
- `project_type`: `greenfield` | `brownfield` (from STEP 0)
- `platforms.work_tracking`: `none` until the team wires an adapter — or a project-specific token (skills read this); prefer documenting integrations under optional `integrations` in this file or linked config
- `change.root`: `reopenspec/changes` (default; in-flight work lives under `reopenspec/changes/active/<change-domain-id>/`; completed moves to `reopenspec/changes/completed/<YYYY-MM-DD>-<change-domain-id>/`)
- `traceability.main_specs_dir`: `specs`
- `traceability.baseline_json`: path from `reopenspec.json` / defaults (`reopenspec/specs/.meta/arch-baseline.json`)

This file is the **single place** agents read for “where do changes go” and how work items are resolved (details delegated to skills + config — **no vendor lock-in in prose here**). Keep it valid YAML.

---

STEP 1 — Repository Analysis

Analyze the entire codebase.

Identify:

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

STEP 2 — Generate Base Documentation

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

STEP 3 — Identify Gold Standard Files

Analyze the entire repository and identify "Gold Standard" code files.

Definition of Gold Standard:
Files that best represent correct and high-quality implementation patterns in this codebase.

---

STEP 3.1 — Identify Candidate Files

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

STEP 3.2 — Evaluate Code Quality

For each candidate file, evaluate based on:

Architecture Adherence:
- Follows actual project architecture (layered, MVC, etc.)
- No layer violations

Readability & Maintainability:
- Clear naming conventions
- Small, focused functions
- Minimal complexity

Consistency:
- Matches patterns used across the repo
- Follows existing conventions

Separation of Concerns:
- Logic is not mixed across layers
- Clear responsibilities

Error Handling:
- Proper validation and exception handling

Testability:
- Code is testable and has corresponding tests (if applicable)

Avoidance of Anti-patterns:
- No God classes / overly large files
- No dead or unused code
- No inconsistent patterns

---

STEP 3.3 — Rank Files

Score each file from 1–10 based on overall quality.

Select:

- Top 2–3 Backend files
- Top 2–3 Frontend files (if applicable)
- Top 2–3 Test files

---

STEP 3.4 — Extract Patterns

For each selected file, extract:

- Key design patterns used
- Naming conventions
- Structural patterns (layer flow, file organization)
- API patterns (request/response handling)
- Testing patterns

---

STEP 3.5 — Output Format

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

---

STEP 3.6 — Guardrail

IMPORTANT:

- Do NOT select files just because they are large or central
- Avoid legacy or inconsistent files
- Prefer files that are clean, consistent, and easy to understand
- If multiple patterns exist, choose the most consistent and widely used one

---

STEP 3.7 — Identify Anti-Patterns

Detect:

- Files violating architecture
- Inconsistent implementations
- Overly complex or tightly coupled modules

Save to:

`reopenspec/docs/anti-patterns.md`

These must NOT be used as references.

---

STEP 4 — Generate IDE Rules

Read `.reopenspec.user.yaml` (at the workspace root) to detect the preferred `ide` (e.g., `cursor`, `windsurf`, `roo`).
If the file doesn't exist, create it with `{ide: "cursor"}` (and ensure it's in `.gitignore`).

Based on the `ide`, create or update the architectural rules in the corresponding directory:
- **Cursor**: `.cursor/rules/*.mdc`
- **Windsurf/Cascade**: `.windsurfrules/*.md` (or `.cascade/`)
- **Roo/Cline**: `.roo/*.md` (or `.cline/`)

Create the following core rules:

- `system-architecture`
- `backend-architecture`
- `backend-code-quality`
- `frontend-standards`
- `testing-standards`

Rules must:

- Reflect actual project architecture (NOT assumptions)
- Reference detected patterns and conventions
- Include Gold Standard file references
- Avoid introducing new patterns not present in codebase
- **Reference ReOpenSpec baseline/drift** when the repo uses `reo` / `reopenspec/specs/.meta/`

---

STEP 5 — Refactor Commands Compatibility

Scan workflow commands in:

`.cursor/commands/` (if present)  
or the repo’s `commands/` folder (e.g. ReOpenSpec’s bundled `reo-*.md` templates)

Replace hardcoded tech assumptions with:

“Follow project rules defined in `.cursor/rules/*` and ReOpenSpec baseline/contracts where applicable.”

Ensure compatibility with:

`/reo-plan`  
`/reo-story-skill` / `/reo-task-skill` / `/reo-bug-skill` (invoked from plan or standalone)  
`/reo-spec-work-item` (optional: fill `reopenspec/specs/…/overview.md` from external item)  
`/reo-proceed-plan`  
`/reo-implement` (legacy `reopenspec/specs/<feature>/` path)  
`/reo-review` · `/reo-test` · `/reo-pr`

---

STEP 6 — Validation

Validate that:

- Rules align with actual codebase
- No conflicting architecture instructions exist
- Commands are tech-agnostic aside from documented optional tools (MCP, etc.)

---

STEP 7 — Developer Review

Show:

- Architecture summary
- Generated docs
- Generated rules
- Gold standard references

Ask developer to:

Review  
Modify if needed  
Approve by typing:

`approved`

---

STEP 8 — Finalize

After approval:

- Save all generated files
- Commit changes

---

STEP 9 — Cursor Response

Status: `BLUEPRINT_COMPLETE`  
Details: Project analyzed, `reopenspec.project.yaml` ensured, rules generated  
Next: `/reo-plan` (with story/task/bug id or manual brief); optional `reo spec new <slug>` for main-line specs under `reopenspec/specs/`
