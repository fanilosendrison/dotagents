---
title: "Standardize ADR Template"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, convention, adr, documentation]
---

# Standardize ADR Template

## Context
The project needed a standardized convention for Architecture Decision Records (ADRs) that could be reliably read and authored by both humans and AI agents. It was important to establish a clear structure based on industry best practices to prevent decision fatigue and ensure consistent documentation.

## Decision
Adopt a standardized ADR template based on the MADR (Markdown Any Decision Record) and Nygard structures. The template includes an inverted pyramid structure (Title, Status, Context, Decision at the top) and utilizes YAML frontmatter for machine-readable metadata. Additionally, the Consequences section is explicitly formatted as "Pros and Cons".

## Alternatives Considered
- **Pure Markdown for Metadata**: Relying only on Markdown headings for metadata (like status or date) was rejected because it is less robust for AI agents and tooling to parse reliably compared to YAML frontmatter.

## Consequences

### Pros
- Ensures highly consistent architectural documentation.
- YAML frontmatter makes it easy for AI agents and tooling to parse, index, and query active decisions.
- The inverted pyramid structure allows for rapid human scanning of the most critical information.

### Cons
- Adds a small amount of overhead for developers who must strictly format the YAML block and structure when creating new ADRs manually.

## References
- Michael Nygard's Architecture Decision Records: http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions
- Markdown Any Decision Record (MADR): https://adr.github.io/madr/
- Structured MADR (SMADR) for YAML Frontmatter definitions: https://smadr.dev/
