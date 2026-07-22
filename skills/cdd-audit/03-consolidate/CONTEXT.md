---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 3
name: "Gate 2b — Consolidate"
role_description: "Consolidates sniper outputs into classified findings per document."
inputs:
  - path: "$RUNDIR/sniper-*.json"
    format: "sniper-json"
outputs:
  - path: "$RUNDIR/classified-*.json"
    format: "classified-json"
---

# Step 3: Consolidate

For each document with ≥1 FAIL, launch `agents/sniper-output-consolidator.md` (sub-agent, `context: fresh`). Give it `$RUNDIR` and `<document>`.

**Output**: `$RUNDIR/classified-<document>.json` per document.
