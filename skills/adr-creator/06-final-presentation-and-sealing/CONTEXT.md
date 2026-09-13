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

1. Present every reviewed draft from the active Step 5 session folder.
2. Wait for explicit approval or requested changes. Do not seal any draft until
   the user has approved it.
3. Upon approval, transform each `RuntimeArtifact` into the final ADR format
   required by the repository:
   - remove the RuntimeArtifact envelope and all draft-only `target_adr` fields,
     including `profile` and `filename`;
   - source `adr_profile_version`, `domain`, `severity`, fixed OKF fields, and
     local extensions from the repository profile and its schemas;
   - copy canonical `id`, `name`, outgoing relations, and `governs` from the
     reviewed planning descriptor;
   - record the actual approval date as the decision `date`;
   - set `relation_completeness: complete` for a new native ADR;
   - set the lifecycle status to `accepted` only when approval authorizes that
     transition;
   - compute integrity metadata from the exact final decision bytes when the
     profile requires it;
   - write the exact filename selected in Step 3.
4. Never edit an older accepted ADR to add `superseded-by` or another incoming
   relation. Let repository tooling derive reverse relations from the new ADR.
5. Run every validation and rendering command declared by the repository ADR
   profile. Inspect generated changes before reporting success.

## End of Workflow

Once the approved ADRs and required generated projections validate, the
workflow is complete.

- Inform the user that accepted identity, decision date, outgoing relations,
  governed scope, and decision body are immutable. A later ADR may change the
  architecture; repository policy alone governs lifecycle transitions.
- Remind the user to commit the changes unless the requested workflow already
  includes committing them.
