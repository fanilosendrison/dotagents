---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 4
name: "Autonomous Drafting"
role_description: "Technical Writer"
inputs:
  - path: "../02-metadata-extraction/output/"
    format: "markdown-extraction"
  - path: "../03-scoping-and-setup/output/"
    format: "markdown-routing-metadata"
outputs:
  - path: "output/"
    format: "markdown-draft"
templates:
  - "templates/adr-template.md"
---

# Step 4: Autonomous Drafting

Your goal is to combine the data from previous steps into clean markdown drafts.

## Tasks
1. Read the extracted metadata from your active session's folder in `../02-metadata-extraction/output/`.
2. Read the repository profile, filename, ID, and outgoing relations from the
   active session's routing metadata in `../03-scoping-and-setup/output/`.
3. Read the exact required output structure from `templates/adr-template.md`.
4. Draft each ADR.
   - Keep the draft itself a `RuntimeArtifact` with
     `format: markdown-draft`.
   - Put routing inputs for the intended repository ADR under `target_adr`.
     This is a planning descriptor, not an instance of the sealed ADR schema;
     do not present it as final ADR frontmatter.
   - Set the target lifecycle status to `proposed`.
   - Copy the repository-conformant ID, filename, and outgoing relations from
     Step 3 exactly.
   - Use the Inverted Pyramid style with Context and Decision first.
   - Copy references exactly from Step 2. Do not invent references or cite the
     transcript/session ID.

## Output
Create your own session-specific directory: `output/YYYY-MM-DD-short-topic/` (matching previous steps).
Save each formatted draft under the repository ID assigned in Step 3, followed
by `-draft.md` (for example, `adr-016-draft.md` or `0016-draft.md` according to
the repository convention).

Once all files are written, you may proceed immediately to Step 5.
