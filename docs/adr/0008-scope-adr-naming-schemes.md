---
title: "Scope ADR Naming Schemes by Corpus"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Pi
tags: [architecture, documentation, naming, adr]
---

# Scope ADR Naming Schemes by Corpus

## Context
Two ADR filename schemes currently coexist in the workspace. The workspace-level corpus (`docs/adr/`) follows the industry-standard `NNNN-short-descriptive-title.md` convention formalized in the `adr-creator` skill. The pre-existing project-level corpus of the `/go` workflow (`skills/go/specs/adr/`) uses a topical `ADR-go-<topic>.md` scheme. These files are cross-referenced extensively by the NIB and spec corpus of the `/go` project. Leaving the coexistence undocumented creates ambiguity for agents deciding how to name a new ADR.

## Decision
Scope the naming schemes by corpus. The `NNNN-short-descriptive-title.md` convention is canonical for the workspace-level corpus in `docs/adr/` and for any newly created ADR corpus. The existing `ADR-go-*` corpus in `skills/go/specs/adr/` is grandfathered: its files keep their current names, and new ADRs added to that specific corpus continue its established `ADR-go-<topic>.md` scheme to preserve internal consistency and cross-reference integrity.

## Alternatives Considered
- **Mass rename of the `ADR-go-*` corpus to `NNNN` style**: Rejected because it would break dozens of cross-references across the NIB, DC, and spec documents of the `/go` project, and produce churn with no semantic gain.
- **Adopt a global `ADR-<project>-<topic>.md` scheme everywhere**: Rejected because topical names carry no ordering, make supersede chains harder to track, and deviate from the industry-standard sequential `NNNN` convention.

## Consequences

### Pros
- Cross-reference integrity of the `/go` spec corpus is preserved without any migration work.
- Each corpus stays internally consistent, and agents have an unambiguous rule for naming any new ADR.

### Cons
- Two naming schemes remain visible in the workspace, which may surprise a reader comparing the two corpora.

## References
- ADR naming convention: `skills/adr-creator/03-scoping-and-setup/conventions/naming-an-adr.md`
- 0002-standardize-adr-template.md
- 0003-enforce-adr-immutability.md
