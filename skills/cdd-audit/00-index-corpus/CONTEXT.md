---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 0
name: "Gate 0 — Index Corpus"
role_description: "Indexes the project corpus and initializes the audit run directory."
inputs:
  - path: "."
    format: "project-directory"
outputs:
  - path: "$RUNDIR/"
    format: "run-directory"
  - path: ".cdd-audit/LATEST.txt"
    format: "pointer-to-run-dir"
---

# Step 0: Index Corpus

Run this command:

```bash
d=".cdd-audit/$(date +%Y-%m-%d-%H%M%S)" && mkdir -p "$d" && echo "$(pwd)" > "$d/index.txt" && find . -type f >> "$d/index.txt" && echo "$d" > .cdd-audit/LATEST.txt
```

Then proceed to Step 1.
