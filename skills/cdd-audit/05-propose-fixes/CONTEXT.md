---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 5
name: "Gate 2d — Propose Fixes"
role_description: "Generates fix proposals from classified findings."
inputs:
  - path: "$RUNDIR/all-classified.json"
    format: "merged-json"
outputs:
  - path: "$RUNDIR/fix-proposals.md"
    format: "markdown"
  - path: "$RUNDIR/cat1-fixes.json"
    format: "cat1-json"
---

# Step 5: Propose Fixes

Launch `agents/fix-proposer.md` (sub-agent, `context: fresh`). Give it the `/specs` corpus and `$RUNDIR/all-classified.json`.

**Output**: `$RUNDIR/fix-proposals.md` + `$RUNDIR/cat1-fixes.json`.
