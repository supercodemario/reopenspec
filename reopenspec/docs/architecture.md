# Architecture — ReOpenSpec CLI

## Overview

ReOpenSpec is a **Node.js CLI** (`reo`, oclif v4) that scans repositories, builds an **architecture baseline** (JSON), detects **drift** vs feature specs, and **injects** IDE workflow files (Cursor rules, slash commands, MCP setup prompts).

## Pattern

- **Command–query separation (CLI shape):** Each user-facing capability is an **oclif command** under `src/commands/`. Shared logic lives in **`src/lib/`**.
- **Adapters:** Language-specific parsing via **`src/lib/parsers/*`** (TypeScript via `@ast-grep/napi`; Dart/C#/Python/PHP via lightweight scanners).
- **Configuration:** **`reopenspec.json`** at workspace root (resolved through **`src/lib/reopenspec-config.ts`**).
- **Artifacts:** Baseline and drift outputs under **`reopenspec/specs/.meta/`** (paths configurable in `reopenspec.json`).

## Key components

| Area | Responsibility |
|------|----------------|
| `src/commands/init.ts` | Scaffold `reopenspec/` tree, baseline scan, IDE inject, rules copy, optional MCP interactive setup |
| `src/commands/scan.ts` | Refresh baseline JSON |
| `src/commands/sync.ts` / `drift.ts` / `diff.ts` | Drift vs specs |
| `src/commands/doctor.ts` | Health check: config, dirs, language profile, contracts |
| `src/lib/baseline.ts` | Orchestrate globbing, parser selection, baseline assembly |
| `src/lib/detect-profile.ts` | Language/stack hints from manifests (`package.json`, `pubspec.yaml`, etc.) |
| `src/lib/mcp-interactive-setup.ts` | TTY prompts to merge MCP server entries into IDE config |

## Secondary surface

- **`editors/vscode/`** — Optional VS Code extension that shells out to the CLI (not the primary UI of the product).

## Spec-driven workflow

- **`reopenspec/specs/`** — Feature specs and `api-contracts.json` where teams document behavior.
- **`reopenspec/changes/active/<slug>/`** — Traceable plan/tasks for a change (`reopenspec.project.yaml` → `change.root`).

## Baseline as source of structural truth

For agents and `/reo-blueprint`, prefer **`reopenspec/specs/.meta/arch-baseline.json`** (see `reopenspec.json` → `baselinePath`) over guesswork when describing modules and exports.
