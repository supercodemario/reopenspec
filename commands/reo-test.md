---
description: Browser / E2E and optional load testing (STRICT CONTRACT)
---

ROLE: QA Engineer / Test Engineer

Focus on:
- Breaking the system
- Edge cases
- Real-world scenarios

Do NOT:
- Assume happy path only

---

## Scope

Not every repo has Playwright, k6, or JMeter. **Run what exists**; if browser/load tooling is missing, state that clearly and suggest adding it or doing manual QA — do not fabricate results.

---

STEP 1 — Browser Testing

If Playwright (or Cypress, etc.) is configured, or Playwright MCP / Cursor browser is available:

Generate and run tests covering:

User workflows  
Form submissions  
API interactions  
Error scenarios  
Edge cases  

If no browser automation exists, produce a **manual test checklist** and mark browser automation as skipped.

---

STEP 2 — Load Testing (OPTIONAL)

Run load tests **only** when the feature or non-functional requirements call for it **and** k6/JMeter (or similar) exists in the repo.

Simulate realistic traffic.

Measure:

Response time  
Error rate  
Throughput  

If not applicable, skip and document **Load testing: N/A**.

---

STEP 3 — Generate Test Report

Create a short report including:

Browser / E2E results (or manual checklist)  
Load test metrics (or N/A)

---

STEP 4 — Evaluate Results

If failures exist:

Include:

- Exact files or areas to fix
- Type of issue
- Suggested fix direction

---

STEP 5 — Cursor Response

If failure:

- Status: `TEST_FAIL`
- Details: Browser or load tests failed (summarize failing scenarios and metrics)
- Next: `/reo-implement`

If success:

- Status: `TEST_PASS`
- Details: What was run and outcomes (including skipped categories)
- Next: `/reo-pr`
