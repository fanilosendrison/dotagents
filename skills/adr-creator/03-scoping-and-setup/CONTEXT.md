---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 3
name: "Scoping and Setup"
role_description: "Routing and ID Generator"
inputs:
  - path: "../02-metadata-extraction/output/"
    format: "markdown-extraction"
outputs:
  - path: "output/"
    format: "markdown-routing-metadata"
templates:
  - "templates/routing-metadata-template.md"
conventions:
  - "conventions/naming-an-adr.md"
---

# Step 3: Scoping & Setup

Your goal is to prepare the precise identification for the new ADR(s) and handle the replacement of old ones.

## Tasks
1. Read the extracted metadata from your active session's folder in `../02-metadata-extraction/output/` (e.g., `2026-07-17-auth-refactor/`).
2. **Determine IDs**: Scan the `docs/adr/` directory in the user's workspace. Find the highest `NNNN` sequential number and calculate the next one (e.g., if `0013` exists, your ID is `0014`). If you are creating multiple ADRs, assign them sequentially (e.g., `0014`, `0015`).
3. **Determine Superseding**: Determine if any of the new decisions explicitly replace an older ADR in `docs/adr/`. If so, note the old ADR's full filename for each specific decision.
4. **Determine Filenames**: Follow the rules in `conventions/naming-an-adr.md` to generate the exact filename for each new ADR.

## Output
Create your own session-specific directory: `output/YYYY-MM-DD-short-topic/` (matching Step 2).
Save your output as `routing-metadata.md` in this directory.
You MUST format this file exactly according to `templates/routing-metadata-template.md`.

Once the file is written, you may proceed immediately to Step 4.
