---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 7
name: "Gate 2f — Filter & Report"
role_description: "Filters applied fixes and assembles the behavioral report."
inputs:
  - path: "$RUNDIR/fixer-report.md"
    format: "markdown"
  - path: "$RUNDIR/fix-proposals.md"
    format: "markdown"
outputs:
  - path: "$RUNDIR/behavioral-report.md"
    format: "markdown-report"
---

# Step 7: Filter & Report

1. Run the filter script:

   ```bash
   npx tsx scripts/filter-applied-fixes.ts $RUNDIR
   ```

2. Assemble `$RUNDIR/behavioral-report.md` following the template `assets/templates/audit-report-template.md`:
   - Section 1: from `$RUNDIR/fixer-report.md`.
   - Section 2: from the Cat 2 section of `$RUNDIR/fix-proposals.md`.

3. If 0 findings in `cat2-remaining.json` → load `08-structural/CONTEXT.md`. Otherwise, the report is the final deliverable. STOP. Do not proceed to the next steps.

**Output**: `$RUNDIR/behavioral-report.md`.
