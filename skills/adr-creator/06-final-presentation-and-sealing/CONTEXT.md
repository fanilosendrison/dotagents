---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 6
name: "Final Presentation and Sealing"
role_description: "Human Validation Gateway"
inputs:
  - path: "../05-compliance-and-alignment/output/"
    format: "markdown-reviewed-draft"
outputs:
  - path: "docs/adr/"
    format: "markdown-adr"
---

# Step 6: Final Presentation & Sealing

Your goal is to get final user approval and officially seal the ADR(s) into the project's history.

## Tasks
1. Present the fully reviewed draft(s) (from your active session's folder in `../05-compliance-and-alignment/output/`) to the user.
2. Wait for the user to explicitly approve or request changes. Do not proceed until they approve all of them.
4. Upon approval:
   - Change the frontmatter `status` from `proposed` to `accepted` in each file.
   - Write the final file(s) directly into the user's `docs/adr/` folder.
   - If any ADR supersedes an older one, open the older ADR in `docs/adr/`, change its status to `superseded`, and set `superseded-by: [your-new-filename]`.

## End of Workflow
Once the file(s) are written to `docs/adr/` and any superseding updates are done, the workflow is complete. 
- **CRITICAL REMINDER**: Inform the user that once an ADR is `accepted`, it becomes strictly **immutable**. It must never be edited again to reflect new decisions (it can only be superseded by a new ADR). 
- Remind the user to commit the changes.
