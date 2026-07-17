---
title: "Enforce ADR Immutability"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, convention, adr, workflow]
---

# Enforce ADR Immutability

## Context
As architectural decisions evolve over time, modifying existing ADRs to reflect the current state destroys the historical context of the decision-making process. This can lead to "zombie" documents that are partially correct and partially outdated, and results in teams repeating past debates.

## Decision
Enforce an "append-only" history for ADRs. Once an ADR reaches the `Accepted` status, it must never be modified to reflect new architectural directions. Instead, if a decision changes, a completely new ADR must be created that explicitly supersedes the old one (using `supersedes` in the frontmatter), and the old ADR's status is updated to `Superseded`.

## Alternatives Considered
- **In-place Updates**: Editing the contents of an existing ADR to match the new architecture was rejected because it erases the "why" and the context behind the original decision, removing the historical trail.

## Consequences

### Pros
- Preserves the exact context and reasoning of why a decision was made at a specific point in time.
- Prevents the team from repeating past technical debates by keeping a clear log of abandoned approaches.
- Provides a clear audit trail of architectural evolution.

### Cons
- Leads to a larger volume of ADR files in the repository.
- Requires discipline to properly link superseded and superseding documents to maintain the dependency graph.

## References
- Michael Nygard's Architecture Decision Records (Append-only immutability concept): http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions
