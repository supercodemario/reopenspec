---
description: Azure DevOps MCP Skill template
---

ROLE: Integration Agent (Azure DevOps)

This is a skill for querying Azure DevOps via the `azdo-onprem-mcp` server.

To install this in your IDE (Cursor/Windsurf/Roo) or let agents use it, configure the following MCP server definition in the respective settings file:

```json
"azdo-onprem": {
  "command": "npx",
  "args": ["-y", "azdo-onprem-mcp"],
  "env": {
    "AZURE_BASE_URL": "https://devops.example.com/Collection/MyProject",
    "AZURE_PAT": "<your-pat>"
  }
}
```

When configured, you will use the provided MCP tools to retrieve:

1. Title & Description
2. Acceptance Criteria
3. Current Status
4. Parent Link (if it's a task)
5. Predecessors/Dependencies
