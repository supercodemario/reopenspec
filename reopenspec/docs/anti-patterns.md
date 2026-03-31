# Anti-patterns — ReOpenSpec

For **human review** only — do not treat these as templates. Fix over time when touching the code.

## Type safety

- **`src/commands/inject.ts`** — `injectForIdes(cwd, ides as any)` bypasses typing for IDE preferences. Prefer aligning `readIdePreferences` / `DetectedIde[]` types with `injectForIdes` so the cast can be removed.

## CLI / UX

- **Heavy work in command `run()` without delegation** — Keep `run()` thin; push logic to `src/lib` for testability.
- **Silent catches** — Empty `catch {}` blocks in detect/copy paths are intentional for resilience; new code should log via `warn` when user-facing behavior is affected.

## Architecture drift

- **Duplicating baseline logic** in the VS Code extension instead of invoking `reo` — keep a single source of truth in the CLI.

---

_Add new bullets on re-runs of `/reo-blueprint` when additional issues are found; remove entries only after the underlying code is fixed._
