---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 6
name: "Gate 2e — Apply Fixes"
role_description: "Applies Category 1 mechanical fixes to the corpus."
inputs:
  - path: "$RUNDIR/cat1-fixes.json"
    format: "cat1-json"
outputs:
  - path: "$RUNDIR/fixer-report.md"
    format: "markdown"
  - path: "$RUNDIR/fixer-result.json"
    format: "fixer-result-json"
---

# Step 6: Apply Fixes

Launch `agents/fixer.md` (sub-agent, `context: fresh`). Give it the `/specs` corpus and `$RUNDIR/cat1-fixes.json`.

**Output**: `$RUNDIR/fixer-report.md` + `$RUNDIR/fixer-result.json`.
