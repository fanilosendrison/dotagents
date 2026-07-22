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
  - path: "$RUNDIR/index.txt"
    format: "text-index"
---

# Step 0: Index Corpus

Run this command:

```bash
d="$(pwd)/.specify/$(date +%Y-%m-%d-%H%M%S)" && mkdir -p "$d" && echo "$(pwd)" > "$d/index.txt" && find . -type f >> "$d/index.txt" && echo "$d"
```

Then proceed to Step 1.

**Output**: `$RUNDIR/index.txt`.
