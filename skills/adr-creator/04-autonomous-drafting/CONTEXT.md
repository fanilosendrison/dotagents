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
2. Read the routing metadata (filename, ID, supersedes) from your active session's folder in `../03-scoping-and-setup/output/`.
3. Read the exact required output structure from `templates/adr-template.md`.
4. Draft the new ADR(s). 
   - Set `status: proposed` in the YAML frontmatter.
   - If a draft supersedes an old ADR, fill the `supersedes` field.
   - Use the Inverted Pyramid style (Context and Decision first).
   - *CRITICAL*: Copy the references exactly as extracted in Step 2. Do NOT hallucinate references and NEVER use the session ID or transcript as a reference.

## Output
Create your own session-specific directory: `output/YYYY-MM-DD-short-topic/` (matching previous steps).
Save the full, formatted markdown draft(s) into this directory using their assigned `NNNN` identifiers (e.g., `0014-draft.md`, `0015-draft.md`).

Once all files are written, you may proceed immediately to Step 5.
