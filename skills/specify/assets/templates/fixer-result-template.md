---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "fixer-result-json"
workspace: "specify"
date: "YYYY-MM-DD"
step_id: 2
---

# Fixer Result Template

Written by `fixer.md` to `fixer-result.json`.

```json
{
  "applied": [
    {
      "finding_id": "REQ-001",
      "document": "foo.md",
      "file": "specs/foo.md",
      "status": "applied",
      "before": "charges the card and handles timeouts",
      "after": "charges the card and returns a PaymentResult object on timeout"
    }
  ],
  "failed": [
    {
      "finding_id": "REQ-003",
      "document": "bar.md",
      "file": "specs/bar.md",
      "status": "failed",
      "reason": "Could not locate the exact text in the file"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `applied[].finding_id` | `string` | `req_slug` of the fixed requirement. |
| `applied[].status` | `"applied"` | Fix was successfully applied. |
| `applied[].before` | `string` | Original text. |
| `applied[].after` | `string` | Replaced text. |
| `failed[].status` | `"failed"` | Fix could not be applied. |
| `failed[].reason` | `string` | Why the fix failed. |
