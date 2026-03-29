# ReOpenSpec

**Spec-driven architecture baseline, drift checks, and context-aware IDE workflow injection.** 

ReOpenSpec an agentic workflow engine that scans your repository into `arch-baseline.json`, compares each feature’s `api-contracts.json` to that baseline (drift), and injects tailored IDE rules natively based on your environment (Cursor, Windsurf, or Roo). It grounds AI agents in firm architectural contracts and drastically reduces AI context pollution.

It sits in the same problem space as [OpenSpec](https://github.com/Fission-AI/OpenSpec) (specs in git, AI-assisted workflows) but introduces **native multi-IDE profile detection**, **categorized `.mdc` rule injection**, and **multi-language AST-grounded drift tracking**.

## Repository layout (`docs` / `specs` / `changes`)

ReOpenSpec assumes (and `reo init` creates) a strict, traceable three-tier architecture at the project root:

| Path | Role |
|------|------|
| **`reopenspec/docs/`** | Architecture narratives, ADRs, runbooks, team conventions — high-level context that is **not** the live behavioral contract. |
| **`reopenspec/specs/`** | Domain behavior, scenarios, and **`api-contracts.json`** — the **source of truth**, cross-checked against code via deterministic drift detection. |
| **`reopenspec/changes/active/`** | In-flight work: one folder per story, task, or bug (e.g. `task-azure-1234`) managed by a strict `change.yaml` scaffold and tracking `/reo-plan` deltas. |
| **`reopenspec/changes/completed/`** | Done work: Moved here automatically with a date prefix upon `/reo-completed` to cleanly archive context without polluting the agent's main memory. |

See **[`reopenspec/docs/reopenspec-model.md`](reopenspec/docs/reopenspec-model.md)** for the full architectural model.

## Requirements

- **Node.js 20+**

## Install

```bash
npm install -g reopenspec
```

Check: `reo --help`

## Quick start

### 1. Initialize the Workspace

In your project root:

```bash
reo init
```

This acts as your unified bootstrap. It creates the repository layout, writes `reopenspec.json`, runs an initial baseline scan, **auto-detects your IDE profile** (Cursor, Roo, or Windsurf), and strictly injects categorized `.mdc` rules and slash-command templates (`.cursor/commands/`, `.windsurf/`, etc.) based on your primary language and IDE. 

*(Use `reo init --skip-workflow` to only generate the baseline and config.)*

### 2. The 5-Step Traceable Feature Flow

ReOpenSpec enforces a predictable lifecycle for AI coding agents:
1. **`reo init`**: Establishes the workspace and syncs agent rule profiles.
2. **`/reo-blueprint`**: Generates architecture specs based on the baseline and contextually activates IDE rules.
3. **`/reo-plan`**: Connects via MCPs (Jira/Azure/Figma), parses dependencies, and provisions a heavily-traced scaffold under `reopenspec/changes/active/` driven by a concrete `change.yaml`.
4. **`/reo-proceed-plan`**: Reads the active change folder and executes the feature implementation in isolated steps.
5. **`/reo-completed`** (Human-run): Evaluates the proceed-plan work, proposes updates to `reopenspec/specs/`, and safely archives the work into `changes/completed/YYYY-MM-DD/` to lock the spec and erase short-term memory pollution.

### 3. Track Contracts & Compute Drift

Point contracts at real exports inside `reopenspec/specs/<feature>/api-contracts.json`:
```json
{
  "id": "user-login",
  "mapsTo": { "file": "src/services/LoginService.ts", "symbol": "LoginService", "kind": "export.class" }
}
```

Then synchronize and calculate drift:

```bash
reo sync --verbose
```
*(Outputs to `reopenspec/specs/.meta/arch-baseline.json` and `drift-report.json`)*.

---

## Commands

| Command                           | Purpose                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `reo init`                        | First-time: dirs, config, baseline scan, dynamic IDE profile detection, and contextual rule/workflow injection.                           |
| `reo init --skip-workflow`        | Core initialization without injecting `.mdc` rules or IDE templates.                                                                      |
| `reo sync`                        | Full workspace scan + structural drift report computation against active contracts.                                                       |
| `reo scan`                        | Generate and write `arch-baseline.json` only.                                                                                             |
| `reo drift` / `reo diff`          | Check codebase drift solely against `reopenspec/specs/*/api-contracts.json`.                                                              |
| `reo doctor`                      | Checks workspace health (validates config, directories, and spec contract references).                                                    |
| `reo spec new <slug>`             | Scaffold a fresh domain feature folder + `.spec-meta.json`.                                                                               |
| `reo inject`                      | Hard force re-apply of the latest dynamic categorised IDE rules.                                                                          |
| `reo config`                      | Show or create your `reopenspec.json`.                                                                                                    |
| `reo status`                      | Prints config paths + high-level baseline/drift summary.                                                                                  |
| `reo hooks install` / `uninstall` | Git pre-commit hook (`reo sync`) to ensure contracts are strictly enforced on commit.                                                     |

Run `reo <command> --help` for flags. *(Tip: Use `--verbose` on `reo scan` or `reo sync` for detailed node-extraction logs).*

## Languages

ReOpenSpec organically traverses multi-language workspaces using a unified Parser Adapter pattern.

- **TypeScript / TSX** — via [ast-grep](https://ast-grep.github.io/) (`@ast-grep/napi`): true AST parsing for exports and imports.
- **C# / .NET** — heuristic scan (namespaces, classes, interfaces, records, functions, and `using` module specs).
- **Python** — heuristic scan (classes, `def` functions, and aliased imports).
- **PHP** — heuristic scan (namespaces, classes, interfaces, traits, functions, and `use` aliases).
- **Dart / Flutter** — heuristic scan (imports + top-level declarations); `build/` and `.dart_tool/` are ignored.

## Under the Hood: The Rules Engine

ReOpenSpec's secret weapon is how it handles Context Pollution. During `reo init` and `reo inject`, the CLI doesn't just dump 5,000 lines of prompt into your agents. It detects the active profile (e.g. PHP + React) and strategically copies `.mdc` standard files into place, defining explicit activation triggers (e.g. "always-on" vs. "agent-requested"). 

## Configuration

`reopenspec.json` at the repo root (or `reopenspec/specs/.meta/reopenspec.json`) sets your project directives:
- `baselinePath`
- `driftReportPath`
- `specsDir`
- `strictUncovered`

## VS Code

A minimal extension lives under `editors/vscode/` (config editor + run sync). Build it with `npm run vscode:compile` from the repo.

## License

MIT — see [LICENSE](LICENSE).
