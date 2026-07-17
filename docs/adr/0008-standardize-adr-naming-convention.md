---
title: "Standardize ADR Naming Convention"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, convention, adr, naming]
---

# Standardize ADR Naming Convention

## Context
Architecture Decision Records (ADRs) need to be easily scannable and naturally ordered chronologically in file systems and remote repositories. A lack of strict naming rules leads to fragmented naming schemes (using spaces, dates, or status markers) which complicates automated parsing and breaks markdown links when a document's status changes.

## Decision
Enforce the `NNNN-short-descriptive-title.md` (kebab-case) naming convention for all ADRs.
- `NNNN`: A zero-padded sequential number starting from `0001`. Numbers must never be reused.
- `short-descriptive-title`: Must be in strict `kebab-case` (lowercase, hyphen-separated).
- **Prohibited**: Do NOT include dates (Git handles history). Do NOT include status keywords like `draft` or `accepted` (this prevents breaking external links if the status evolves).

## Alternatives Considered
- **Including Dates in the Filename**: Rejected because it adds visual noise and duplicates information natively managed by Git version control.
- **CamelCase or Spaces**: Rejected because it causes cross-platform escaping issues in URLs and bash commands.

## Consequences

### Pros
- Ensures ADRs are perfectly sorted chronologically in IDEs and GitHub.
- Guarantees cross-platform safety for shell scripts and automated parsers.
- Permanent URLs: Since status is tracked inside the frontmatter, the filename never changes, preserving all internal markdown links.

### Cons
- Requires developers or agents to manually look up the highest existing number before creating a new ADR to prevent collisions.

## References
- Markdown Any Decision Record (MADR) format guidelines: https://adr.github.io/madr/
- Agentic Naming Conventions (internal documentation): file-and-folder-naming.md
