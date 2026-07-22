---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "requirements-json"
workspace: "specify"
date: "YYYY-MM-DD"
step_id: 1
---

# Requirement Lister Output Template

Write to `requirements-<doc>.json`.

```json
[
  {
    "req_slug": "REQ-001-debit-carte",
    "lines": "12-15",
    "quote": "charges the card and handles timeouts"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `req_slug` | `string` | `REQ-NNN-<description>` : zero-padded sequential number + `kebab-case` description. |
| `lines` | `string` | Line range (`"12-15"`). |
| `quote` | `string` | Exact text of the requirement. |
