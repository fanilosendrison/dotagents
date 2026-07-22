---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "sniper-output-json"
workspace: "specify"
date: "YYYY-MM-DD"
step_id: 2
---

# Sniper Output Template

Shared by all snipers (1..8). Write to `sniper-<N>-<doc>.json`.

```json
[
  {
    "req_slug": "REQ-001-debit-carte",
    "lines": "12-15",
    "verdict": "FAIL",
    "finding": "Oracle missing: \"handles the payment\" — expected result undefined."
  }
]
```

| Field | Type | Description |
|-------|------|-------------|
| `req_slug` | `string` | Same as in the requirements file. |
| `lines` | `string` | Line range. |
| `verdict` | `"PASS"` \| `"FAIL"` \| `"N/A"` | `N/A` = check does not apply. `N/A` with a `finding` = Deferred (TBD at design time). |
| `finding` | `string` \| `null` | If `FAIL`, quote and description. If `PASS`, `null`. If `N/A` and Deferred, contains the reason. |
