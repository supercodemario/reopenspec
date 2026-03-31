# Frontend guidelines — ReOpenSpec

## Primary product

The shipped **frontend** is the **terminal UX** of the CLI (oclif stdout/stderr, readline prompts). Follow oclif conventions for descriptions, examples, and flags.

## VS Code extension

The **`editors/vscode/`** package is a thin wrapper around the `reo` binary. When editing it:

- Follow the extension’s own `package.json` scripts and TypeScript config under `editors/vscode/`.
- Keep extension responsibilities limited (spawn CLI, minimal UI); avoid duplicating baseline logic in the extension.

## Web or mobile UI

Not part of this repository. If a future web dashboard is added, document it here and add stack-specific rules via `reo init` / blueprint.
