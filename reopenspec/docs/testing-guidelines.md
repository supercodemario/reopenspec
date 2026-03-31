# Testing guidelines — ReOpenSpec

## Current state

`package.json` does **not** define a unit-test runner (no Jest/Vitest/Mocha dependency). Validation is primarily **manual** plus **`npm run build`** (`tsc` + `oclif manifest`).

## Recommendations (if the team adopts automated tests)

- **Unit:** Vitest or Node test runner targeting **`src/lib/**`** (pure functions: config resolution, drift rules, argument parsing helpers). Mock `fs` where needed.
- **Integration:** Invoke **`node bin/run.js <command>`** with temp directories for `init`/`scan`/`doctor` smoke paths.
- **Contracts:** If parsers change, add snapshot or fixture tests for small code samples per language.

## Expectations

- New non-trivial logic in `src/lib/` should prefer **testable** pure functions with IO at the edges.
- Do not block releases on coverage until a runner is adopted; document chosen framework here when introduced.
