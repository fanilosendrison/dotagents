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

Prepare the repository-conformant identity, filename, and outgoing decision
relationships for each ADR.

## Tasks

1. Read the extracted metadata from the active session folder in
   `../02-metadata-extraction/output/`.
2. Resolve the active repository root and read its directives.
3. If `docs/adr/adr-profile.yaml` exists, read the profile and its referenced
   schemas before assigning an ID. Otherwise, preserve the established ADR
   convention already present in the repository.
4. Scan every retained ADR, including rejected, deprecated, and superseded
   records. Assign the next unallocated repository-conformant ID; never reuse an
   identity.
5. Determine which existing ADRs the new decision explicitly `clarifies`,
   `amends`, `supersedes`, or `confirms`. Record only these outgoing relations;
   do not edit older records to add reverse relations.
6. Apply `conventions/naming-an-adr.md` to produce the exact final filename and
   H1 identity.

## Output
Create your own session-specific directory: `output/YYYY-MM-DD-short-topic/` (matching Step 2).
Save your output as `routing-metadata.md` in this directory.
You MUST format this file exactly according to `templates/routing-metadata-template.md`.

Once the file is written, you may proceed immediately to Step 4.
