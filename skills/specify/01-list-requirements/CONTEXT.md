---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 1
name: "Gate 1 — List Requirements"
role_description: "Extracts every behavioral requirement from each project file using parallel sub-agents."
inputs:
  - path: "$RUNDIR/index.txt"
    format: "text-index"
outputs:
  - path: "$RUNDIR/requirements-<filename>.json"
    format: "requirements-json"
---

# Step 1: List Requirements

1. Read `$RUNDIR/index.txt`. The first line is the CWD; subsequent lines are the project files.
2. For each file, launch 1 sub-agent with `agents/requirement-lister.md` and `context: fresh`. Each sub-agent writes to `$RUNDIR/requirements-<filename>.json`.
3. When all sub-agents have completed, proceed to Step 2.

**Output**: `$RUNDIR/requirements-<filename>.json`.
