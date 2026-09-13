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
   - Are Context and Decision placed first, following the Inverted Pyramid
     structure?
   - Does the incoming `RuntimeArtifact` envelope conform to the Step 4 draft
     template?
   - Does the non-schema `target_adr` planning descriptor contain every routing
     input needed to create repository-conformant sealed metadata?
   - Are all decision relations outgoing from the new ADR, with no proposed
     reverse edits to accepted records?
5. If the repository profile declares validation or rendering commands, prepare
   the draft so the sealed projection can pass them. Do not bypass local schema
   overlays or integrity requirements.
6. Rewrite any noncompliant draft sections directly without changing the
   extracted decision intent.

## Output

Create the matching session directory under `output/`. Save each reviewed draft
using the repository-conformant ID followed by `-reviewed-draft.md`.

Before saving, change the RuntimeArtifact envelope to:

```yaml
format: "markdown-reviewed-draft"
step_id: 5
```

Do not leave Step 4's `format: markdown-draft` or `step_id: 4` in Step 5 output.

Once all files are written, you may proceed immediately to Step 6.
