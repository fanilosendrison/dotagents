---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "markdown-adr"
title: "Rename the GitHub Project Adapter to Proto-Lithify"
status: accepted
workspace: "dotagents"
date: "2026-09-23"
step_id: 6
amends: ["ADR-0015", "ADR-0016"]
supersedes: "None"
relation_completeness: complete
governs:
  - "standalone GitHub Project adapter public identity"
  - "dotagents GitHub Project workflow-router identity"
  - "dedicated repository and Engineering Project naming"
author: [Fanilo Sendrison]
tags: [github, projects, cli, skills, naming]
---

# Rename the GitHub Project Adapter to Proto-Lithify

## Context

The standalone adapter, its repository, installation namespace, executable,
workflow-router skill, and dedicated GitHub Project use the
`github-engineering-projects` or `GPE` identity. The selected public identity is
now Proto-Lithify. Renaming only a subset would leave stale commands and split
one capability across conflicting active names.

The adapter's mechanical authority boundary, explicit command set, live GitHub
identity resolution, postcondition verification, and lazy workflow contexts
remain applicable. Accepted ADRs and closed work records must retain the former
identity as historical evidence.

## Decision

Adopt `proto-lithify` as the repository, package, executable, standalone data
namespace, and workflow-router skill name. Adopt `Proto-Lithify` as the human
product name and `Proto-Lithify Engineering` as the dedicated GitHub Project
title.

Release the executable and installation namespace rename as version `0.2.0`
because it is a breaking change during initial development. Do not retain an
active compatibility alias for the old executable. Preserve immutable
historical ADRs, closed Issues, and ADR workflow artifacts rather than rewriting
them.

Keep generic references to GitHub Engineering Projects when they describe the
external GitHub domain rather than the former product identity.

## Alternatives considered

- **Rename only the local checkout:** Rejected because the remote repository,
  package, executable, skill, and Project would retain conflicting identities.
- **Keep the old executable as an alias:** Rejected because it would preserve an
  indefinite second public identity and weaken completion checks.
- **Rewrite accepted ADRs and closed Issues:** Rejected because it would destroy
  historical provenance and violate accepted ADR immutability.
- **Rename generic GitHub Project terminology:** Rejected because those terms
  still describe the external domain operated by the adapter.

## Consequences

### Benefits

- Establishes one active identity across source, runtime, agent routing, and
  GitHub.
- Prevents active skills from invoking an obsolete executable.
- Preserves the existing mechanical authority boundary and runtime behavior.
- Retains an auditable decision and migration history.

### Costs and obligations

- Breaks callers of the old executable and skill entrypoint.
- Requires a new standalone installation and removal of the old launcher.
- Requires repository, Project, Issue, and local checkout postcondition checks.
- Requires harnesses to reload skill discovery after the directory rename.
- Leaves immutable historical records containing the former identity.
- Requires external active references to migrate independently without
  overwriting unrelated worktree state.

## References

- ADR-0015: Extract GitHub Project mechanics into a dedicated standalone CLI.
- ADR-0016: Route GitHub Project work through one lazy-loading skill.
- ADR-0003: Enforce ADR immutability.
- Semantic Versioning 2.0.0.
- Global file and folder naming convention.
