---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 4
name: "Gate 2c — Merge Findings"
role_description: "Merges all classified outputs into a single file."
inputs:
  - path: "$RUNDIR/classified-*.json"
    format: "classified-json"
outputs:
  - path: "$RUNDIR/all-classified.json"
    format: "merged-json"
---

# Step 4: Merge Findings

Run the merge script:

```bash
npx tsx scripts/merge-classified-outputs.ts $RUNDIR
```

**Output**: `$RUNDIR/all-classified.json`.
