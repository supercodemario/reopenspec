# Backend guidelines — ReOpenSpec CLI

This repository does **not** host a long-running HTTP API. Treat “backend” as **CLI runtime and library code** on **Node.js ≥20**.

## Layout

- **`src/commands/*.ts`** — oclif commands: parse flags/args, delegate to `src/lib`.
- **`src/lib/*.ts`** — Pure or IO-adjacent helpers (filesystem, config, baseline, drift).
- **Exports** — Emit **CommonJS** into `dist/`; import paths in source use **`.js` extensions** (Node16 resolution).

## Patterns

- **Strict TypeScript** (`strict: true` in `tsconfig.json`).
- **Filesystem:** `node:fs`, `node:path`; prefer `existsSync` / `readFileSync` for small CLI reads; avoid loading entire trees into memory without need.
- **Errors:** Throw `Error` with clear messages; oclif `this.error` / `this.warn` in commands for user-facing output.
- **No ORM / REST layer** — persistence is **JSON files** and user-level IDE config paths (e.g. MCP merge targets from `ide-mcp-config.ts`).

## Adding a command

1. Implement under `src/commands/<name>.ts` (or topic folder).
2. Register via oclif discovery (`commands` in `package.json` → `./dist/commands`).
3. Run `npm run build` to refresh `oclif.manifest.json`.
