---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 5
name: "Compliance and Alignment"
role_description: "Quality Gate and Compliance Reviewer"
inputs:
  - path: "../04-autonomous-drafting/output/"
    format: "markdown-draft"
  - path: "../02-metadata-extraction/output/"
    format: "markdown-extraction"
outputs:
  - path: "output/"
    format: "markdown-reviewed-draft"
---

# Step 5: Compliance & Alignment

Your goal is to act as a quality gate, verifying that the draft(s) faithfully reflect the session's original intent and strictly adhere to ADR formatting standards. Do not re-evaluate the technical merits of the decision itself.

## Tasks
1. Read the drafted ADR(s) from your active session's folder in `../04-autonomous-drafting/output/`. If there are multiple drafts, you must review all of them independently.
2. Cross-reference the drafts with the extracted metadata from `../02-metadata-extraction/output/` (and the original transcript if necessary).
3. For each draft, verify **Alignment**:
   - Does it accurately and faithfully represent the decisions made during the session?
   - Are there any hallucinations or omitted critical details?
4. For each draft, verify **Compliance & Tone**:
   - Is the tone objective and blameless?
   - Is the Context and Decision placed at the top (Inverted Pyramid structure)?
5. If any draft fails these checks, rewrite the necessary sections directly to fix them.

## Output
Create your own session-specific directory: `output/YYYY-MM-DD-short-topic/` (matching previous steps).
Save the fully polished and reviewed markdown file(s) into this directory (e.g., `0014-reviewed-draft.md`).

Once all files are written, you may proceed immediately to Step 6.
