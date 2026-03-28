# ReOpenSpec

**Spec-driven development with a deterministic code snapshot.** ReOpenSpec is a small CLI (`reo`) that scans your repo into `arch-baseline.json`, compares each feature’s `api-contracts.json` to that baseline (drift), and injects short IDE rules so agents read those files instead of guessing from RAG alone.

It sits in the same problem space as [OpenSpec](https://github.com/Fission-AI/OpenSpec) (specs in git, AI-assisted workflows) and adds **AST-grounded structure + drift**. Narrative docs like `architecture.md` stay **author- and agent-written in the IDE**; `reo` assists with facts and structured checks.

## Requirements

- **Node.js 20+**

## Install

```bash
npm install -g reopenspec
```

Check: `reo --help`

From a clone of this repo:

```bash
npm install && npm run build
node bin/run.js --help
```

## Quick start

1. In your project root:

   ```bash
   reo init
   ```

   This creates `specs/` and `specs/.meta/`, writes `reopenspec.json` if missing, runs a scan, injects Cursor rules (or `.ai-context/AGENTS.md` as a fallback), copies **slash-command templates** to `.cursor/commands/`, and adds **`reopenspec.project.yaml`** when missing. Use **`reo init --skip-workflow`** if you only want baseline + config without those files.

2. **Traceable feature flow (IDE)** follows a true 5-step lifecycle:
   - **`reo init`**: Sets up folders, ignores your local IDE profile (`.reopenspec.user.yaml`), and copies IDE workflows.
   - **`/reo-blueprint`**: Generates architecture specs and rules native to your IDE choice (Cursor, Roo, Windsurf).
   - **`/reo-plan`**: Connects via Project Management MCPs (Azure/Jira), tracks dependencies, and provisions a traced scaffold like `change/story-1234-feature/` driven by a strict `change.yaml`.
   - **`/reo-proceed-plan`**: Reads the change folder and implements the feature.
   - **`/reo-completed`**: Carefully syncs your built delta back into the main `specs/` (your living source of truth) and safely archives the execution to `archive/YYYY-MM-DD-story.../`.
   
   See [`commands/README.md`](commands/README.md) for full context.

3. Add or scaffold main-line specs (optional if you only use `change/` folders):

   ```bash
   reo spec new my-feature
   ```

4. Point contracts at real exports in `specs/<feature>/api-contracts.json` (`mapsTo`: file path, symbol, kind).

5. Refresh baseline + drift:

   ```bash
   reo sync
   ```

   Outputs default to `specs/.meta/arch-baseline.json` and `specs/.meta/drift-report.json` (configurable in `reopenspec.json`).

## Commands

| Command                           | Purpose                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `reo init`                        | First-time: dirs, config, scan, inject IDE snippets, copy slash commands to `.cursor/commands/`, add `reopenspec.project.yaml` if missing |
| `reo init --skip-workflow`        | Same as above but without copying slash commands or adding `reopenspec.project.yaml`                                                      |
| `reo sync`                        | Full scan + drift report                                                                                                                  |
| `reo scan`                        | Baseline only                                                                                                                             |
| `reo drift` / `reo diff`          | Drift vs `specs/*/api-contracts.json`                                                                                                     |
| `reo spec new <slug>`             | Scaffold feature folder + `.spec-meta.json`                                                                                               |
| `reo inject`                      | Re-apply injected rules                                                                                                                   |
| `reo config`                      | Show or create `reopenspec.json`                                                                                                          |
| `reo status`                      | Config paths + baseline/drift summary                                                                                                     |
| `reo hooks install` / `uninstall` | Git pre-commit hook (`reo sync`)                                                                                                          |

Run `reo <command> --help` for flags.

## Languages

- **TypeScript / TSX** — via [ast-grep](https://ast-grep.github.io/) (`@ast-grep/napi`): exports and imports.
- **Dart** — heuristic scan (imports + top-level declarations); `build/` and `.dart_tool/` are ignored.

## Configuration

`reopenspec.json` at the repo root (or `specs/.meta/reopenspec.json`) can set `baselinePath`, `driftReportPath`, `specsDir`, and `strictUncovered`.

## VS Code

A minimal extension lives under `editors/vscode/` (config editor + run sync). Build it with `npm run vscode:compile` from the repo.

## Docs in this repo

- [`commands/README.md`](commands/README.md) — optional Cursor slash-command templates (`/reo-*`) aligned with `specs/`

## License

MIT — see [LICENSE](LICENSE).
