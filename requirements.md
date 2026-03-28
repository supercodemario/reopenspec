# ReOpenSpec — Full System Specification
**Version**: 0.2-draft  
**Status**: Partial implementation (see §8)  
**Author**: Ajith (@ajithnow)

---

## 1. Overview

ReOpenSpec is a **small, optional layer** on top of normal development: an npm CLI (and a thin VS Code wrapper) that **scans** the codebase into a compact **`arch-baseline.json`**, runs **drift** checks against machine-readable contracts, and **injects** short rules so IDE agents know to trust those files. It is not a full spec authoring suite and does not replace your IDE.

**Most spec content is written in the IDE.** Narrative and design docs — **`overview.md`**, **`architecture.md`**, **`decisions.md`**, task lists — are produced by **developers and IDE agents** using your **slash commands, rules, and workflows**. ReOpenSpec’s job is to run **first** (or on demand) so the scan **assists** those sessions with **facts from the repo**, and to keep **structured** pieces (`api-contracts.json`, drift) aligned with what the code actually exports. The CLI does not need to “write architecture.md for you”; agents do, grounded by the baseline and your workflows.

The core problem it addresses: AI IDEs often rely on RAG and guesswork for structure. A **deterministic** slice of reality from the AST (plus drift vs declared contracts) reduces hallucination **where you wire it in** — it complements agent-written prose rather than replacing the agent workflow.

### Design Principles

- **Thin product surface.** Scanner + baseline JSON + drift + inject + light scaffolding. Heavy narrative specs stay in the IDE agent loop.
- **CLI owns all CLI logic.** The VS Code extension is a thin UI wrapper. Zero scanner logic lives in the extension.
- **AST assists the IDE.** The baseline informs agents and checks contracts; it is not the only source of architectural intent (that lives in markdown and team process).
- **Deterministic where it matters.** For structured checks, AST-extracted facts win over LLM inference; prose remains human- and agent-authored.
- **Language-agnostic scanner path.** ast-grep handles languages; ts-morph is an optional TypeScript enhancement only.
- **Local-first.** No cloud dependency in the core.
- **Composable.** ReOpenSpec does not replace Jira, Figma, or GitHub; optional links are separate.

### Relationship to OpenSpec

[OpenSpec](https://github.com/Fission-AI/OpenSpec) (`@fission-ai/openspec`) is a **lightweight spec-driven development (SDD)** framework for AI coding assistants: specs live in the repo, workflows use slash commands, and the focus is aligning humans and assistants **before** implementation. ReOpenSpec sits in the **same problem space** and can be thought of as an **extended** take on that idea: it keeps **IDE- and agent-authored** markdown specs and feature folders, and **adds** a deterministic **`arch-baseline.json`** from AST scan, **drift** checks against declared contracts, **`reopenspec.json`**, and **injection** of small rule files so agents read the baseline and specs consistently.

ReOpenSpec is **not** a fork of the OpenSpec CLI; it is a **separate package** with its own commands and JSON shapes. Teams do not have to install both; use ReOpenSpec when you want **code-derived ground truth + drift** layered on top of the same SDD habits OpenSpec popularized.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Developer                            │
│              (terminal or VS Code extension)                │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      CLI Core                               │
│  reo init / reo sync / reo diff / reo inject / reo status …  │
└──┬──────────────┬──────────────┬──────────────┬────────────┘
   │              │              │              │
   ▼              ▼              ▼              ▼
Scanner      Spec Engine    Delta Tracker   Injector
(ast-grep     (schema +      (drift         (IDE-aware
+ ts-morph*)  versioning)    detection)     file writer)
   │              │              │              │
   └──────────────┴──────┬───────┴──────────────┘
                         │
              arch-baseline.json
              /specs/{feature}/
```

\*ts-morph pass is specified below; not yet implemented in the current CLI.

The VS Code extension wraps the CLI. It invokes CLI commands via `child_process` and streams output to an Output Channel. **CodeLens drift annotations** and **incremental rescan on save** are specified here but not yet implemented in the extension (see §3.8).

---

## 3. Component Specifications

### 3.1 AST Scanner

**Purpose**: Traverse the project workspace and extract a **compact, deterministic** meta-model for **assisting IDE agents** and **powering drift checks** — not to replace agent-authored documents like `architecture.md`.

**Primary tool**: `ast-grep` via `@ast-grep/napi`  
**Enhancement layer**: `ts-morph` for TypeScript-only type resolution pass

#### Language Detection

On `reo init` or `reo sync`, the scanner inspects:

- File extensions across the workspace (`.ts`, `.js`, `.py`, `.go`, `.java`, `.rs`, `.php`, `.rb`)
- Manifest files (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `composer.json`, `Gemfile`)
- Lock files for secondary confirmation

Multiple languages are supported simultaneously (monorepo scenario).

#### Extraction Targets

For each detected language, ast-grep rules extract:

| Target | Description |
|--------|-------------|
| Module boundaries | File-level export surfaces, public API entry points |
| Service interfaces | Class and interface declarations with their method signatures |
| Exported functions | Name, parameters, return type hint where available |
| Inter-module dependencies | Import/require statements, dependency edges between modules |
| API entry points | Route handlers, controller methods, decorated endpoints |
| State mutation points | State setters, store mutations, repository write operations |

#### TypeScript Enhancement Pass

After the ast-grep pass on `.ts` files, ts-morph runs a second pass to resolve:

- Actual resolved types on function parameters and return values (not just syntactic annotations)
- Interface shapes for API contract extraction
- Generic type resolutions

This data enriches the corresponding nodes in `arch-baseline.json`. The ts-morph pass is skipped entirely if no TypeScript files are detected.

#### Incremental Rescan

Full rescan runs on `reo sync`. Incremental rescan runs on file save (triggered by the VS Code extension with 300ms debounce).

Incremental strategy:
1. Read last sync git commit hash from `arch-baseline.json` metadata
2. Run `git diff --name-only <last_hash> HEAD` to get changed files
3. Run ast-grep only on changed files
4. Merge updated nodes back into `arch-baseline.json`
5. Update the commit hash in metadata

#### Output: `arch-baseline.json`

Stored at `/specs/.meta/arch-baseline.json`. Human-readable, version-controlled.

```json
{
  "meta": {
    "version": "1",
    "generated_at": "2026-03-28T08:00:00Z",
    "commit_hash": "abc1234",
    "languages": ["typescript", "python"]
  },
  "modules": [
    {
      "id": "src/services/order-service",
      "path": "src/services/OrderService.ts",
      "language": "typescript",
      "exports": ["OrderService"],
      "depends_on": [
        "src/repositories/order-repository",
        "src/services/inventory-service"
      ]
    }
  ],
  "interfaces": [
    {
      "id": "OrderService",
      "module": "src/services/order-service",
      "methods": [
        {
          "name": "createOrder",
          "params": [{ "name": "payload", "type": "CreateOrderDTO" }],
          "returns": "Promise<Order>",
          "mutates": ["src/repositories/order-repository"]
        }
      ]
    }
  ],
  "api_entry_points": [
    {
      "id": "POST /orders",
      "handler": "OrderController.create",
      "module": "src/controllers/order-controller",
      "calls": ["OrderService.createOrder"]
    }
  ],
  "dependency_graph": {
    "nodes": ["src/controllers/order-controller", "src/services/order-service", "src/repositories/order-repository"],
    "edges": [
      { "from": "src/controllers/order-controller", "to": "src/services/order-service" },
      { "from": "src/services/order-service", "to": "src/repositories/order-repository" }
    ]
  }
}
```

---

### 3.2 Spec Engine

**Purpose**: Manage the feature-scoped spec folder structure. Create, update, and version spec files.

#### Spec Folder Structure

```
/specs/
  .meta/
    arch-baseline.json        ← generated by scanner
    reopenspec.json           ← project config
  {feature-slug}/
    overview.md               ← feature summary, scope, goals
    architecture.md           ← design decisions, component interactions
    api-contracts.json        ← typed API shapes, request/response schemas
    tasks.md                  ← implementation checklist, subtasks
    decisions.md              ← ADR-style decision log
    .spec-meta.json           ← version, commit hash, baseline node refs
```

#### `.spec-meta.json`

Links the spec to specific nodes in `arch-baseline.json` for precise drift detection.

```json
{
  "version": "2",
  "last_synced_commit": "abc1234",
  "baseline_refs": [
    "src/services/order-service",
    "src/controllers/order-controller",
    "POST /orders"
  ],
  "status": "in-sync"
}
```

#### `api-contracts.json`

```json
{
  "endpoints": [
    {
      "id": "POST /orders",
      "request": {
        "body": {
          "product_id": "string",
          "quantity": "number"
        }
      },
      "response": {
        "200": {
          "order_id": "string",
          "status": "string"
        },
        "400": {
          "error": "string"
        }
      }
    }
  ]
}
```

#### Spec Versioning

Every spec file carries a version number and last-synced commit hash in `.spec-meta.json`. On each `reo sync`, the engine checks whether the referenced baseline nodes have changed since last sync. If yes, it marks the spec status as `drift-detected`.

---

### 3.3 Delta Tracker

**Purpose**: Detect drift between the declared specs and the actual codebase state represented in `arch-baseline.json`.

#### Drift Categories

| Category | Description |
|----------|-------------|
| `missing_implementation` | Spec declares a method or endpoint not found in baseline |
| `interface_mismatch` | Method signature in baseline differs from api-contracts.json |
| `undocumented_side_effect` | Baseline shows a mutation not declared in the spec |
| `deprecated_contract_in_use` | Spec references a baseline node that no longer exists |
| `unspecced_code` | Baseline contains modules/endpoints with no corresponding spec |

#### Drift Report Output

The CLI outputs a structured JSON drift report to `specs/.meta/drift-report.json`. This file is consumed by both the CLI (for printed output) and the VS Code extension (for CodeLens annotations).

```json
{
  "generated_at": "2026-03-28T08:00:00Z",
  "commit_hash": "abc1234",
  "drift_items": [
    {
      "id": "drift-001",
      "category": "interface_mismatch",
      "spec_ref": "specs/order-management/api-contracts.json",
      "baseline_ref": "src/services/order-service#createOrder",
      "file": "src/services/OrderService.ts",
      "line": 42,
      "message": "createOrder returns Promise<OrderResponse> in spec but Promise<Order> in code",
      "severity": "error"
    }
  ],
  "summary": {
    "total": 3,
    "errors": 1,
    "warnings": 2
  }
}
```

#### Refresh Lifecycle

| Trigger | Scope | Command |
|---------|-------|---------|
| `reo sync` | Full rescan + full drift check | Manual CLI |
| File save (VS Code extension) | Incremental rescan of changed file + targeted drift check | Automatic with 300ms debounce |
| `reo diff` | Drift check only, no rescan | Manual CLI |
| Git pre-commit hook (optional) | Full rescan + drift check, fail on error-severity drift | Opt-in via `reo hooks install` |

---

### 3.4 CLI

**Purpose**: All intelligence. Scanner, spec engine, delta tracker, injector. Optional **third-party** MCP configuration (§3.7) is separate from the core. There is **no** bundled ReOpenSpec MCP server and none is planned.

#### Tech Stack

- **Framework (current implementation)**: `@oclif/core` (command routing, help, flags)
- **Language**: TypeScript → JavaScript (CommonJS `require` for the published CLI today)
- **Distribution**: npm package (`reopenspec`; scoped name optional)
- **Runtime**: Node.js 20+

*Note: A future refactor may move to `citty` + ESM as originally sketched; behavior and command surface stay the source of truth.*

#### Command Surface

Implemented commands (names are stable):

```
reo init              Scan codebase, generate arch-baseline.json,
                      create /specs/.meta and /specs/, detect IDE, inject workflow files
reo sync              Full rescan, update arch-baseline.json, run drift check
reo scan              Baseline scan only (write arch-baseline.json)
reo drift             Compare baseline to specs/*/api-contracts.json → drift-report.json
reo diff              Alias of reo drift (same behavior)
reo spec new <slug>   Scaffold a feature spec folder (overview, architecture, contracts, …)
reo spec update       [Not yet implemented] Re-sync a specific spec against current baseline
reo inject            Re-inject workflow markdown for detected IDE(s)
reo config            Print path to / create reopenspec.json
reo hooks install     Install git pre-commit hook (runs reo sync)
reo hooks uninstall   Remove ReOpenSpec block from pre-commit
reo status            Print baseline metadata, config paths, drift summary
```

#### `reo init` Flow

```
1. Detect languages (file extensions + manifests)
2. Run ast-grep full scan → generate arch-baseline.json
3. [Planned] Run ts-morph pass if TypeScript detected → enrich baseline
4. Scaffold /specs/.meta/ and /specs/ structure; write reopenspec.json if missing
5. Detect active AI IDE (check for .cursor/, .windsurf/, .roo/, etc.)
6. Inject appropriate workflow files for detected IDE (markdown rules)
7. [Optional / future] Write third-party MCP snippets to IDE config when integrations are configured
8. Print summary: N modules scanned, N interfaces extracted, IDE detected
```

---

### 3.5 Multi-IDE Injector

**Purpose**: Write the right files to the right directories for each AI IDE so that workflow files are auto-discovered as slash commands or agent procedures without manual configuration.

#### IDE Detection Strategy

Check for presence of these markers in order:

```
.cursor/              → Cursor
.windsurf/            → Windsurf  
.roo/                 → Roo Code
.clinerules           → Cline
.vscode/extensions.json (inspect for specific extension IDs) → fallback
None found            → universal fallback
```

Multiple IDEs can be detected simultaneously (developer uses both Cursor and Windsurf). Injector writes to all detected locations.

#### Injection Targets

**Cursor**
```
.cursor/rules/reopenspec.md          ← global project rules
.cursor/rules/reo-start-feature.md   ← start feature workflow
.cursor/rules/reo-sync-spec.md       ← sync spec workflow
.cursor/mcp.json                     ← optional: third-party MCP servers only (not written by core inject today)
```

**Windsurf**
```
.windsurf/workflows/reo-start-feature.md
.windsurf/workflows/reo-sync-spec.md
~/.codeium/windsurf/mcp_config.json  ← optional third-party MCP registration (global)
```

**Roo Code / Cline**
```
.roo/rules/reopenspec.md
.clinerules/reopenspec.md
```

**Universal Fallback**
```
.ai-context/AGENTS.md                ← spec-aware context for any agent
.ai-context/arch-baseline-summary.md ← human-readable baseline summary
```

---

### 3.6 Agent Workflow Files

**Purpose**: Pre-program AI agent behavior for spec-aligned development. These are markdown files injected into the IDE's workflow directory. When a developer types a slash command, the IDE reads the injected markdown as a system prompt for the agent session.

**Division of labor:** The CLI produces **`arch-baseline.json`** and optional **scaffolds**; **full prose** in `overview.md`, `architecture.md`, and similar is **authored here** (agent + developer) via these workflows — not generated end-to-end by `reo` alone.

#### Core Principle

Every workflow that involves architectural reasoning must include this instruction:

> Do not infer architecture from the codebase. Read `/specs/.meta/arch-baseline.json` and use only what is declared there. If a module or interface you need is not in the baseline, flag it as an open question — do not assume it.

This is the hallucination firewall. The agent is explicitly instructed to use the deterministic ground truth rather than RAG-retrieved guesses.

#### `/reo-start-feature` Workflow

```markdown
# ReOpenSpec: Start Feature

## Description
Initialise a new feature from a Jira ticket through to a reviewed spec, 
ready for implementation.

## Steps

### 1. Pull story
Query the Jira MCP server for the active sprint ticket assigned to the current user.
Extract: ticket ID, title, acceptance criteria, linked components, story points.
If Jira MCP is not configured, ask the developer to paste the ticket details.

### 2. Pull design context
If Figma MCP is configured, search for frames tagged with the ticket ID.
Extract: component names, annotated states, edge cases from design notes.
If Figma MCP is not configured, ask the developer to describe UI requirements.

### 3. Load architectural context
Read /specs/.meta/arch-baseline.json.
Identify which modules, interfaces, and API entry points are directly 
relevant to this feature based on the ticket requirements.
DO NOT infer architecture from the codebase. Use only the baseline.
List the relevant baseline nodes explicitly before proceeding.

### 4. Pre-spec drift check
Check /specs/.meta/drift-report.json.
If any drift items reference the modules identified in step 3, 
STOP and present the drift to the developer. Do not proceed until 
the developer confirms the drift is understood or resolved.

### 5. Generate spec
Create /specs/{feature-slug}/ with the following files:
- overview.md: feature summary, scope, goals, acceptance criteria from ticket
- architecture.md: how this feature interacts with the identified baseline modules
- api-contracts.json: typed request/response shapes for any new or modified endpoints
- tasks.md: implementation checklist derived from acceptance criteria
- decisions.md: empty ADR template, pre-filled with the feature context
- .spec-meta.json: version "1", current commit hash, baseline_refs from step 3

### 6. PAUSE — human review
Present the generated spec to the developer.
Summarise: scope, affected modules, open questions, and any risks identified.
Do NOT write any implementation code until the developer explicitly approves 
or amends the spec and types a confirmation message.

### 7. On approval
Begin implementation strictly within the scope defined in the approved spec.
Update tasks.md as each task is completed.
After implementation, run: reo sync
```

#### `/reo-sync-spec` Workflow

```markdown
# ReOpenSpec: Sync Spec

## Description
Re-synchronise an existing spec against the current codebase state.

## Steps

### 1. Load baseline
Read /specs/.meta/arch-baseline.json.
Read /specs/.meta/drift-report.json.

### 2. Identify target spec
Ask the developer which feature spec to sync, or detect from the currently 
open file in the editor.

### 3. Compare
Read /specs/{feature-slug}/.spec-meta.json to get baseline_refs.
For each referenced node, compare the current baseline state against the 
declared spec (api-contracts.json, architecture.md).
List every discrepancy explicitly.

### 4. Present diff
Show the developer a clear before/after for each discrepancy.
For each: explain what changed in the code and what the spec currently says.

### 5. PAUSE — developer decision
For each discrepancy, ask: should the spec be updated to match the code, 
or should the code be fixed to match the spec?
Do not make this decision autonomously.

### 6. Apply updates
Based on developer decisions, either update the spec files or generate 
implementation tasks to bring the code into alignment.
Update .spec-meta.json with the new commit hash and version.
```

---

### 3.7 MCP Integration Layer (third-party only)

**Purpose**: Optionally configure **third-party** MCP servers (Jira, Figma, …) so agent workflows can pull tickets, designs, or repo context. ReOpenSpec **does not** ship a local MCP server; architectural ground truth stays in **files** (`arch-baseline.json`, specs, drift report) referenced by injected rules.

**Priority**: Core workflows use on-disk baseline + specs. Third-party MCP is additive when you want Jira/Figma/etc. in the loop.

#### Supported Integrations

| Integration | MCP Server | Data Extracted |
|-------------|-----------|----------------|
| Jira | `@atlassian/jira-mcp` | Active sprint tickets, acceptance criteria, linked components |
| Linear | `@linear/mcp` | Issues, cycles, project context |
| Figma | `@figma/mcp` | Frame details, component annotations, design notes |
| GitHub | `@github/mcp` | PRs, issues, commit context |
| Azure DevOps | `@azure/devops-mcp` | Work items, pipelines, PRs |
| Context7 | `@context7/mcp` | Library documentation, API references |

#### Configuration Flow

On `reo init`, if integrations are detected (e.g., `.jira` config file, `figma.json`, etc.), the CLI prompts the developer to configure each integration interactively. Credentials are stored in the developer's system keychain via the `keytar` package, never in the repository.

When implemented, the CLI may write third-party entries to the IDE-specific MCP config. Example:

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "jira": {
      "command": "npx",
      "args": ["-y", "@atlassian/jira-mcp"],
      "env": {
        "JIRA_BASE_URL": "https://yourcompany.atlassian.net",
        "JIRA_API_TOKEN": "${JIRA_API_TOKEN}"
      }
    }
  }
}
```

---

### 3.8 VS Code Extension

**Purpose**: Thin UI wrapper over the CLI. Zero logic. All behavior is delegated to CLI commands via `child_process`.

#### Extension Responsibilities

| Feature | Implementation |
|---------|---------------|
| Run CLI commands | `child_process.spawn('reo', args)`, output streamed to Output Channel |
| Sidebar panel | `WebviewViewProvider` — config management UI (**baseline status / MCP toggle: planned**) |
| Drift annotations | `CodeLensProvider` reads `drift-report.json` (**planned**) |
| File save trigger | `FileSystemWatcher` — incremental rescan (**planned**) |
| Status bar | Shows last sync time, drift count (**planned**) |

**Current extension (minimal):** `reopenspec.json` editor in a webview + command to run **`reo sync`**. Everything else in the table above is still specified but not yet built.

#### CodeLens Provider

On file open and file save, the extension:

1. Reads `specs/.meta/drift-report.json`
2. Filters items where `file` matches the active document
3. For each matching item, registers a CodeLens at the item's `line`
4. Label: `⚠ Spec drift: {message} — click to view` (error severity) or `◦ Spec note: {message}` (warning)
5. On click: opens the corresponding spec file at the relevant section

The extension never runs the AST scanner itself. It calls `reo diff` on file save and reads the output JSON.

#### Sidebar Panel (Webview)

Built with plain HTML/CSS/JS inside a `WebviewViewProvider`. Sections:

- **Baseline status**: last sync time, commit hash, module count
- **Drift summary**: count by severity, link to full report
- **MCP connections**: toggle on/off per integration, auth status
- **Quick actions**: Sync Now, New Feature Spec, View Baseline

All actions invoke CLI commands. The webview posts a message to the extension host, which spawns the CLI command and streams the result back to the webview.

#### Coordinated Release

The extension and CLI are released together from a monorepo. The extension declares a `peerDependency` on `reopenspec` CLI. On activation, the extension checks that the CLI is installed and on the correct version. If not, it prompts the developer to run `npm install -g reopenspec`.

---

## 4. Data Flow

### Full `reo init` Flow

```
Developer runs: reo init
       │
       ▼
Detect languages from workspace
       │
       ▼
Run ast-grep full scan
       │
       ├── TypeScript detected?
       │         │ Yes
       │         ▼
       │   Run ts-morph type resolution pass
       │         │
       │         └──→ Merge enriched types into nodes
       │
       ▼
Write /specs/.meta/arch-baseline.json
       │
       ▼
Scaffold /specs/ directory structure
       │
       ▼
Detect AI IDE(s) in workspace
       │
       ▼
Inject workflow markdown files into IDE directories
       │
       ▼
[Optional] Write third-party MCP entries to IDE config (Jira, Figma, …) — §3.7
       │
       ▼
Print init summary
```

### Agent Feature Development Flow

```
Developer types: /reo-start-feature
       │
       ▼
Agent reads injected workflow markdown
       │
       ▼
Query Jira MCP → extract ticket + AC
       │
       ▼
Query Figma MCP → extract design context
       │
       ▼
Read arch-baseline.json → identify relevant modules
(NO codebase inference — baseline only)
       │
       ▼
Check drift-report.json → surface any blocking drift
       │
       ▼
Generate spec files in /specs/{feature-slug}/
       │
       ▼
PAUSE — present spec to developer for review
       │
       ▼  (developer approves)
Implement strictly within spec scope
       │
       ▼
Run: reo sync → update baseline + drift report
```

---

## 5. Project Structure

### Repository Layout

**Target:** monorepo with `packages/cli` and `packages/vscode-extension` (pnpm workspaces), as below.

**Current:** a single npm package may host the CLI (`src/commands/`, `src/lib/`) with the VS Code extension under `editors/vscode/` until the split. Behavior matches this layout logically even when folders differ.

```
reopenspec/
  packages/                     ← target monorepo layout
    cli/                        ← npm package: reopenspec
      src/
        commands/               ← oclif (or future citty) command modules
          init.ts
          sync.ts
          scan.ts
          drift.ts
          diff.ts
          spec/new.ts
          inject.ts
          config.ts
          hooks/
          status.ts
        lib/                    ← scanner, drift, injector helpers
        …
      package.json
      tsconfig.json

    vscode-extension/           ← VS Code extension
      src/
        extension.ts
        …
      package.json
      tsconfig.json

  editors/vscode/               ← current extension location (when not yet in packages/)
  docs/                         ← documentation site (VitePress) — optional
  .changeset/                   ← changesets — optional
  package.json                  ← monorepo root (pnpm) or single package
```

---

## 6. Spec Schema Reference

### `overview.md` — template

```markdown
# {Feature Name}

**Ticket**: {JIRA-XXX}  
**Status**: draft | in-review | approved | implemented  
**Last updated**: {date}

## Summary
{One paragraph description of the feature and why it exists}

## Scope
{What is included. What is explicitly out of scope.}

## Acceptance Criteria
{Copied from Jira ticket, structured as a checklist}
- [ ] AC 1
- [ ] AC 2

## Open Questions
{Questions that must be resolved before implementation begins}
```

### `architecture.md` — template

```markdown
# Architecture: {Feature Name}

## Affected Modules
{List of module IDs from arch-baseline.json that this feature touches}

## Component Interactions
{Describe how the feature moves through the system — which module calls which}

## Design Decisions
{High-level decisions made, with brief rationale}
```

### `decisions.md` — ADR template

```markdown
# ADR-{N}: {Decision Title}

**Date**: {date}  
**Status**: proposed | accepted | deprecated | superseded  

## Context
{What is the situation that requires a decision?}

## Decision
{What was decided?}

## Consequences
{What are the tradeoffs? What becomes easier, what becomes harder?}
```

---

## 7. Open Source Strategy

### License

MIT for the core (CLI, scanner, spec schema, agent workflows). This maximises adoption and contribution.

### Open Core Model

| Layer | Open Source | Paid (future) |
|-------|-------------|---------------|
| CLI core | ✓ | |
| ast-grep scanner | ✓ | |
| Spec schema + engine | ✓ | |
| Agent workflow files | ✓ | |
| VS Code extension | ✓ | |
| Third-party MCP config (Jira, Figma, …) | Planned OSS when implemented | — |
| Cloud baseline sync | | ✓ |
| Team drift dashboard | | ✓ |
| CI drift enforcement | | ✓ |
| Spec analytics | | ✓ |

### Repository Structure

Single public GitHub repo: `github.com/ajithnow/reopenspec`

- `main` branch is always the latest stable release
- Feature branches → PRs → squash merge
- Changesets (`@changesets/cli`) for coordinated CLI + extension versioning
- GitHub Actions: lint, typecheck, unit tests on every PR
- Release workflow: changeset publish to npm + VS Code marketplace on merge to `main`

### Documentation Site

**VitePress** — fast, markdown-first, Vue-powered, easy to self-host. Sections:

- Getting Started (install, init, first spec)
- Concepts (baseline, specs, drift, agent workflows)
- CLI Reference
- IDE Integration Guides (Cursor, Windsurf, Roo, Cline)
- MCP Integration Guides (Jira, Figma, GitHub)
- Spec Schema Reference
- Contributing Guide

---

## 8. Recommended Build Order (v0.1)

The smallest possible surface area to ship something useful and testable.

**As of v0.2-draft spec:** Phases 1–5 are partially implemented (TypeScript ast-grep baseline, `specs/.meta/` defaults, drift vs `api-contracts.json`, `reo init` / `sync` / `inject` / `spec new`, minimal VS Code wrapper). **ts-morph**, **incremental rescan**, **`reo spec update`**, and **full extension UX** remain future work — see `IMPLEMENTATION.md` in-repo for a living checklist.

### Phase 1 — Core Scanner (Week 1–2)
Build the ast-grep scanner for TypeScript/JavaScript only. Produce a working `arch-baseline.json` from a real project. Get the data model right before building anything on top of it. This is the foundation everything else depends on.

### Phase 2 — Spec Scaffold + Spec Engine (Week 3)
Build `reo spec new` — interactive scaffolding of a feature spec folder. Build the `.spec-meta.json` linking mechanism so spec files know which baseline nodes they reference.

### Phase 3 — Delta Tracker (Week 4)
Build `reo diff` — read the baseline, read the spec, output a drift report JSON. No IDE integration yet. Just the core detection logic and the report format.

### Phase 4 — CLI Commands + Init Flow (Week 5)
Wire up `reo init` and `reo sync` as the primary entry points. This is when the tool becomes usable end-to-end on a real project.

### Phase 5 — IDE Injector + Workflow Files (Week 6)
Build the Cursor injector first (highest usage). Write the workflow markdown files. Test the full `/reo-start-feature` loop manually in Cursor.

### Phase 6 — Third-party MCP integrations (optional)
Wire up Jira, Figma, GitHub, etc. via IDE MCP config and credentials (`keytar`), per §3.7. Independent of the core baseline/drift loop.

### Phase 7 — VS Code Extension (incremental)
Ship a **minimal** wrapper first (config + run `reo sync`), then add CodeLens, file save trigger, status bar, and richer sidebar as the CLI contracts stabilize.

### Phase 8 — Additional Languages + IDE coverage (Post v0.1)
Extend the scanner to Python, Go, etc. Complete Windsurf, Roo Code injectors. Deepen third-party MCP integration UX where needed.

---

## 9. Key Design Decisions

**Why ast-grep over raw Tree-sitter?**  
ast-grep provides a declarative pattern-matching layer on top of Tree-sitter. Writing extraction rules is significantly simpler than imperative Tree-sitter traversal. It is also faster (Rust-based) and handles multi-language workspaces natively via `@ast-grep/napi`.

**Why ts-morph as an enhancement layer, not primary?**  
ts-morph requires TypeScript. ReOpenSpec must be language-agnostic. ts-morph adds genuine value for type resolution that ast-grep cannot provide syntactically, so it earns its place — but only as an opt-in second pass on TypeScript files.

**Why is all logic in the CLI and not the extension?**  
Maintainability. One implementation, one test surface. The extension is a distribution mechanism for developers who prefer GUI. Logic in the extension would require maintaining two implementations in sync indefinitely.

**Why is architectural context file-based (baseline JSON) rather than a ReOpenSpec-hosted MCP server?**  
Ground truth lives in the repo: versioned, diffable, and readable without a sidecar process. **Third-party** MCP (Jira, Figma, …) is only for external product data, not for serving the baseline.

**How does ReOpenSpec relate to OpenSpec?**  
[OpenSpec](https://github.com/Fission-AI/OpenSpec) provides a minimal SDD loop (repo specs, assistant workflows, propose → implement → archive style flows). ReOpenSpec **extends** that direction with **AST scanning**, **`arch-baseline.json`**, **drift vs `api-contracts.json`**, and **multi-IDE inject** — concerns OpenSpec does not standardize. The two projects are independent codebases; ReOpenSpec adopts the **same philosophy** (specs in git, agents in the IDE) with extra machinery to tie specs to **what the code actually exports**.