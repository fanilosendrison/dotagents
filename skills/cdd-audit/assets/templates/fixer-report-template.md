---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "markdown-fixer-report"
workspace: "cdd-audit"
date: "YYYY-MM-DD"
step_id: 2
---

# Fixer Report Template

Written by `fixer.md` to `fixer-report.md`.

```markdown
## 1. Applied Fixes (Category 1)

- **[REQ-001] [🔴] [foo.md:12-15]**
  - **Before:** *"charges the card and handles timeouts"*
  - **After:** *"charges the card and returns a PaymentResult object on timeout"*

## Failed

- **[REQ-003] [🟡] [baz.md]**
  - **Reason:** Could not locate the exact text in the file
```
