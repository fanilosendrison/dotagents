---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cat1-fixes-json"
workspace: "cdd-audit"
date: "YYYY-MM-DD"
step_id: 2
---

# Cat1 Fixes Template

Written by `fix-proposer.md` to `cat1-fixes.json`.

```json
[
  {
    "finding_id": "REQ-001",
    "document": "foo.md",
    "file": "specs/foo.md",
    "lines": "12-15",
    "severity": "🔴",
    "correction": "Replace 'handles the payment' with 'returns a PaymentResult object'"
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `finding_id` | `string` | `req_slug` of the requirement. |
| `document` | `string` | Source document name. |
| `file` | `string` | Path to the file to modify. |
| `lines` | `string` | Line range. |
| `severity` | `string` | `"🔴"` or `"🟡"`. |
| `correction` | `string` | Description of the exact change to apply. |
