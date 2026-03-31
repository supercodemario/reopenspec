# ReOpenSpec

**What the baseline is:** `arch-baseline.json` (path in `reopenspec.json`, usually `reopenspec/specs/.meta/arch-baseline.json`) is the **AST-grounded export snapshot** from `reo sync`. Use it especially for **first-time /reo-blueprint** work and whenever you need **accurate module and public-API structure** without guessing.

**How to use it:** Prefer baseline + `reopenspec/specs/` (and `api-contracts.json`) for **structural truth** — which files export what, how contracts map to symbols. If something is missing from the baseline, say so and suggest `reo sync` or treat it as an open question — do not invent modules or exports.

**Codebase access:** You **may and should** read and edit application source when **implementing** features, fixes, or reviews. The baseline does **not** replace reading code for those tasks; it **grounds** specs and drift checks so structure and contracts stay honest.

