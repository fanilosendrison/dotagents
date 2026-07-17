---
title: "Isolate Agent Runtime State by Session"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, agent, methodology, concurrency, state]
---

# Isolate Agent Runtime State by Session

## Context
In a physical folder pipeline architecture (ICM), agents read and write state to intermediate `output/` directories. If multiple skill executions or workspaces write to a shared `output/` directory concurrently, state collision occurs. Furthermore, deleting the `output/` directory at the end of a run to "clean up" destroys the intermediate files, which are essential for debugging and providing a "glass box" audit trail.

## Decision
Isolate the agent's runtime state into unique, session-specific output directories.
For every step in the pipeline, the agent MUST write its outputs to a dynamically generated sub-folder inside the step's `output/` directory, named after the active session or workspace (e.g., `01_analysis_and_extraction/output/<conversation-id>/decision-1.md`). 
Additionally, the context metadata (like workspace name or conversation ID) must be explicitly recorded in the YAML frontmatter of these intermediate files.

## Alternatives Considered
- **Destructive Cleanup**: Deleting the contents of the `output/` folder at the end of the pipeline was rejected because it destroys the audit trail, completely defeating the purpose of the Interpretable Context Methodology (ICM).
- **Archiving at the End**: Moving files to an `archives/` folder at the end of the pipeline was rejected because it doesn't solve the concurrency issue if two sessions run the skill simultaneously.

## Consequences

### Pros
- **Concurrency**: Multiple agent sessions or workspaces can execute the exact same skill pipeline simultaneously without any race conditions or state corruption.
- **Glass Box Auditing**: The intermediate files are preserved indefinitely, naturally categorized by session, allowing developers to inspect exactly what the agent concluded at Step 1 six months later.
- **Pipeline Routing**: The skill Router simply checks if `output/<current-session-id>/` is empty to determine the active step, ignoring other concurrent sessions.

### Cons
- Generates deeply nested directories that will accumulate over time and might eventually require a manual or automated archival pruning mechanism.

## References
- Interpretable Context Methodology: Folder Structure as Agentic Architecture (arXiv:2603.16021v2)
- Concurrent Computing Race Conditions: https://en.wikipedia.org/wiki/Race_condition
