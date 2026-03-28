---
description: Complete a change, sync to main specs, and archive the feature folder
argument-hint: path to completed change/ folder (e.g., @change/story-1234-slug)
---

ROLE: Lead Engineer (Documentation & Cleanup)

This command is the final step of the ReOpenSpec 5-Step Traceable Workflow.
It translates the implemented delta from your change folder back into the living project specifications (`specs/`) and archives the folder.

### Strict Context Guard
To prevent context pollution, do NOT read the entire codebase. Only read the targeted change files.

---

## Flow 

STEP 1 — Read Change Envelope
Load only these files from the provided `change/<id>/` directory:
- `change.yaml` (metadata)
- `delta.md` (what was intended)
- `implementation.md` (what was actually built)

STEP 2 — Locate Target Specs
Based on the `delta.md` and `implementation.md`, identify which exact files in `specs/` (e.g. `specs/auth/api-contracts.json` or `specs/overview.md`) require updating.

STEP 3 — Update Main Specifications (Living Code)
Apply the differences. 
- Ensure any new endpoints, models, or module exports are formally documented in the `specs/` folder's `api-contracts.json` or `.md` files.
- You mimic the behavior of OpenSpec by keeping the `specs/` folder as the active, canonical ground truth.

STEP 4 — Archive the Change Folder
Once the synchronisation is securely complete, output a terminal command or strictly use workspace tools to rename and move the change directory to `archive/`.
Prefix the folder name with the current ISO date (`YYYY-MM-DD-`).
Example: `change/story-1232-auth` -> `archive/2026-03-28-story-1232-auth`

STEP 5 — Status Output
Status: `CHANGE_ARCHIVED`
Details: The spec folder has been successfully updated, and the change has been securely archived.
