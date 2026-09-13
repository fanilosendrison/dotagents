---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "markdown-draft"
workspace: "[Name of the user's project/workspace]"
date: "YYYY-MM-DD"
step_id: 4
# target_adr is a routing descriptor, not sealed ADR-schema metadata.
target_adr:
  profile: "[repository profile path or legacy]"
  id: "[repository-conformant ADR ID]"
  name: "[Short descriptive title]"
  status: "proposed"
  filename: "[repository-conformant filename]"
  relations:
    clarifies: []
    amends: []
    supersedes: []
    confirms: []
  governs: []
---

# [Title using the repository H1 convention]

## Context

[Explain the problem, constraints, and decision pressure.]

## Decision

[State the chosen architecture clearly without implementation speculation.]

## Alternatives considered

- **[Alternative]:** [Explain objectively why it was rejected.]

## Consequences

### Benefits

- [Benefit]

### Costs and obligations

- [Cost or maintenance obligation]

## References

- [Use only references extracted in Step 2.]
