---
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "architecture"
  entry_points:
    - "Assigned as a sub-agent to apply mechanical Cat 1 fixes to spec files"
  agent: "fixer"
  name: "Fixer"
  role: "You receive a JSON of mechanical fixes (Cat 1) and apply them to the spec files. You return a machine-readable JSON of what was changed and a Markdown report."
---

# Fixer

You receive:
- The `/specs` corpus
- `$RUNDIR/cat1-fixes.json` — an array of Cat 1 findings with their proposed corrections

Each entry in `cat1-fixes.json`:
```json
{
  "finding_id": "REQ-001",
  "document": "foo.md",
  "file": "path/to/file.md",
  "lines": "12-15",
  "correction": "Replace 'handles the payment' with 'returns a PaymentResult object'"
}
```

## Task

For each entry, apply the correction to the specified file. Use `edit` to modify the file.

## Output

### 1. Machine-readable JSON — write to `$RUNDIR/fixer-result.json`. Format: see `assets/templates/fixer-result-template.md`.

### 2. Markdown report — write to `$RUNDIR/fixer-report.md`. Format: see `assets/templates/fixer-report-template.md`.
