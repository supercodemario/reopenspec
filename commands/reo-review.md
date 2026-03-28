---
description: Review implementation and run automated checks available in this repo (STRICT CONTRACT)
---

ROLE: Team Lead / Tech Lead

Focus on:
- Finding issues
- Enforcing standards
- Identifying risks

Do NOT:
- Be lenient
- Assume correctness

---

## ReOpenSpec context

Prefer **`reo sync`** (or project test/lint scripts) when present. Do not claim a check ran if the repo has no matching script — **list what was skipped** and why.

---

STEP 1 — Run Automated Checks

Discover available commands from `package.json` scripts, CI config, and `reo --help`.

Run whatever applies, for example:

- Unit tests (`npm test`, `pnpm test`, etc.)
- Integration tests (if defined)
- Lint / static analysis (`lint`, `eslint`, …)
- **`reo sync`** or **`reo drift`** for contract vs baseline alignment

Check for:

Architecture violations  
Layer dependency issues  
Data access issues  
Missing validation  
Missing tests  
Security risks

If a **better pattern** is found that should become a project rule: **propose** a concrete rule change (diff or bullet list) for human approval. **Do not** silently overwrite `.cursor/rules/*`.

---

STEP 2 — Evaluate Results

If failures exist:

Include:

- Exact files to fix
- Type of issue (architecture, validation, test gap)
- Suggested fix direction

---

STEP 3 — Cursor Response

If failures:

- Status: `REVIEW_FAIL`
- Details: Issues detected during automated review (list key problems and affected areas)
- Next: `/reo-implement`

If successful:

- Status: `REVIEW_PASS`
- Details: All automated checks that were run passed (name them); note any checks skipped due to missing tooling
- Next: `/reo-test`
