---
name: reopenspec
description: ReOpenSpec — use arch-baseline.json only; do not infer architecture from source.
---

# ReOpenSpec

Do not infer architecture from the codebase. Read `/reopenspec/specs/.meta/arch-baseline.json` (or the path in `reopenspec.json`) and use only what is declared there. If a module or interface you need is not in the baseline, flag it as an open question — do not assume it.


# ReOpenSpec: Start Feature

Load architectural context from the baseline JSON only (see `reopenspec.json` paths). Traceable workflow: `reo init` → `/reo-blueprint` → `/reo-plan` → `reopenspec/changes/active/<id>/` → `/reo-proceed-plan`. See `commands/README.md` in the ReOpenSpec package/repo.


# ReOpenSpec: Sync Spec

Read the baseline and drift report, compare to the chosen feature spec, and reconcile spec vs code with the developer.

