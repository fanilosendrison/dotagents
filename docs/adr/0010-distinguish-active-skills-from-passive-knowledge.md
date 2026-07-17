---
title: "Distinguish Active Skills from Passive Knowledge"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, agent, methodology, prompt-engineering, routing]
---

# Distinguish Active Skills from Passive Knowledge

## Context
When engineering an agent's System Prompt, injecting the frontmatter of every internal convention (e.g., `semver.md`, `kebab-case.md`) as a dedicated `<skill>` pollutes the tool selection array. This massive list of passive skills dilutes the LLM's attention ("Prompt Bloat") and creates "Trigger Brittleness", where the LLM might fail to load a vital convention if the user's phrasing doesn't perfectly match the skill's description.

## Decision
Structurally distinguish Active Capabilities from Passive Knowledge in the agent's architecture:
1. **Passive Knowledge (Rules & Conventions)**: Must be documented in a central, globally loaded file (e.g., `AGENTS.md`) using a Semantic Routing Table (Quick Navigation). This relies on the LLM's natural semantic deduction to fetch the right rule via `view_file` when the context implies it.
2. **Active Capabilities (Skills)**: Reserve the `<skills>` directory exclusively for actionable workflows (e.g., `/git-commits-push`) or Hard Domain Switches with exact keyword triggers (e.g., `antigravity-harness-context`). 

## Alternatives Considered
- **Transforming all conventions into Skills**: Rejected because forcing the LLM to continuously evaluate 50 passive tools for every action causes cognitive overload and failures in tool selection logic.

## Consequences

### Pros
- Drastically reduces Prompt Bloat by keeping the `<skills>` array compact and focused on actions.
- Increases the reliability of convention lookups by leveraging the LLM's spatial and semantic reasoning over a structured Markdown table, rather than brittle tool descriptions.

### Cons
- Requires rigorous maintenance of the `AGENTS.md` Quick Navigation table whenever a new convention is added.

## References
- Internal Architecture Rule: `AGENTS.md` (Quick Navigation section logic)
