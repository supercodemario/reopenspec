---
description: Fetch an external work item (via configured integration/skills) and write reopenspec/specs/overview.md (STRICT CONTRACT)
argument-hint: work item id or key
---

ROLE: Product Owner / Business Analyst

Focus on:
- Clear requirements
- Business intent
- Accurate domain modeling

Do NOT:
- Assume implementation details
- Over-design technical solutions
- Hard-code a specific vendor — use **`reopenspec.project.yaml`**, **`.cursor/config.json`**, and any **skills** the project added for work-item adapters

---

> This command is a **strict, ordered contract**.  
> The agent must follow all steps in order and **must not** create branches, files, or commits before STEP 4 approval.

---

## ReOpenSpec layout

Feature work lives under **`reopenspec/specs/<feature-id>/`**. The CLI scaffolds `overview.md`, `architecture.md`, `tasks.md`, `api-contracts.json`, `decisions.md`. This command fills **`overview.md`** (and may add notes to `architecture.md` when helpful) after approval.

---

STEP 0 — Load configuration

Read in order (merge what exists):

- **`reopenspec.project.yaml`** — integrations / work-tracking hints
- **`.cursor/config.json`** (or paths your team standardizes) — credentials URLs, org names, **not** committed secrets

If no integration is configured to resolve work items: **stop** with `Status: CONFIG_REQUIRED` and tell the developer to configure the adapter (skill + config), or use `reo spec new <slug>` and author **`overview.md`** manually.

---

STEP 1 — Fetch work item

Use the **MCP servers and skills** configured for this project (see project docs and `reopenspec.project.yaml`) to load the item identified by **`$ARGUMENTS`**.

If tooling is unavailable: **stop** with a clear error — do not invent ticket content.

Extract whatever the adapter provides, typically:

- Title, description, acceptance criteria  
- Comments / discussion (if requested)  
- Attachments metadata  
- Links (parent/child, dependencies) when exposed  

---

STEP 2 — Detect design references

Scan description, comments, and attachments for design tool URLs (e.g. Figma).

Patterns commonly used:

`https://www.figma.com/file/*`  
`https://www.figma.com/design/*`

If found, collect them as **Design References**.

---

STEP 3 — Generate feature specification summary

Generate a structured concise specification summary including:

Feature Summary  
Functional Requirements  
Acceptance Criteria  
Technical Notes  
Possible Domain Entities  
Possible API endpoints  
Possible UI changes  

If design URLs exist, include **Design References**.

Use rules from:

`.cursor/rules/system-architecture.mdc`  
`.cursor/rules/backend-architecture.mdc`

(when present) to refine domain, API, and technical notes.

---

STEP 4 — Ask developer approval (BLOCKING)

Show the summary; ask for **`approved`** before any branch or file writes.

---

STEP 5 — After approval (ONLY AFTER `approved`)

Compute:

- **Feature ID**: derive a stable folder name, e.g. `$ARGUMENTS-{title-slug}` (kebab-case from work item title)
- Record the external **work item id** in your branch name or `meta` as the team prefers

Create branch if applicable: `feature/<feature-id>`

Ensure **`reopenspec/specs/<feature-id>/`** exists; merge into existing scaffolds instead of wiping.

Write or update **`reopenspec/specs/<feature-id>/overview.md`** with the full spec, AC, notes, and design references.

---

STEP 6 — Commit

Commit only the spec files touched in this step (no unrelated changes).

---

STEP 7 — Cursor response

- Status: `SPEC_APPROVED`
- Details: Specification saved under `reopenspec/specs/…/overview.md` for work item `$ARGUMENTS`
- Next: `/reo-plan`
