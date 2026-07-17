---
title: "Enforcing Single Decision Granularity for ADRs"
status: accepted
date: 2026-07-17
author: Antigravity
tags: [architecture, conventions, standards]
---

# Enforcing Single Decision Granularity for ADRs

## Context
When architectural decisions are grouped together into a single Architecture Decision Record (e.g., choosing a Database AND an API Framework), the document's lifecycle becomes impossible to manage. If one of those decisions is later superseded while the other remains active, the ADR enters a "zombie" state where it is partially valid and partially obsolete. Furthermore, evaluating and reaching consensus on bundled decisions is difficult because an engineer might agree with one part but disagree with another. There was a critical need for a strict convention to guide agents and humans on how to scope ADRs correctly and prevent cognitive overload.

## Decision
We will strictly enforce the "Single Decision Principle" for all ADRs. A new convention (`adr-granularity.md`) has been created which outlines three mandatory heuristics to determine if a topic must be split:
1. **The Disagreement Test**: If parts of a decision can be disagreed with independently, they must be split into separate ADRs.
2. **The Lifecycle Test**: If parts can be superseded independently in the future, they must be split into separate ADRs.
3. **Coupling vs Cohesion**: Distinct choices must be split and cross-linked via `References`, while inextricably linked choices can remain grouped together.

## Alternatives Considered
- **Grouping decisions by epic/project**: This alternative was evaluated but rejected because it tightly couples independent architectural choices. It permanently breaks the ADR lifecycle mechanism (superseding) and makes historical auditing ambiguous.

## Consequences

### Pros
- Enables independent and atomic lifecycle management (allows superseding a single technical choice without invalidating others).
- Makes it significantly easier to review and reach consensus on a single, isolated trade-off.
- Produces a clearer, highly searchable historical audit trail.

### Cons
- Will generate a higher overall volume of ADR files in the repository.
- Imposes an active cognitive burden upfront on agents and humans to properly analyze, debate, and split decisions before drafting.

## References
- [adr-granularity.md](~/.agents/skills/adr-creator/01-granularity-analysis/conventions/adr-granularity.md)
- Industry standards (ThoughtWorks Technology Radar, MADR, AWS Prescriptive Guidance)
