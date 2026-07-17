---
title: "Differentiate Atomic Skills from Workflow Routers"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, agent, methodology, icm, skills]
---

# Differentiate Atomic Skills from Workflow Routers

## Context
While the Interpretable Context Methodology (ICM) effectively solves prompt bloat by decomposing tasks into folders, applying this heavy folder architecture to every single agent task causes unnecessary directory bloat and slows down execution for trivial operations. Conversely, keeping heavy workflows in a single "Mega-Prompt" `SKILL.md` causes LLM amnesia and hallucinations.

## Decision
Establish a dual-architecture for agent skills based on their granularity:
1. **Atomic Skills**: For tasks that are fast, single-pass, and don't require human validation (e.g., `/git-commits-push`), keep the logic within a single, standard `SKILL.md` file.
2. **Workflow Routers (ICM)**: For tasks that are heavy, multi-step, qualitative, or require intermediate validation (e.g., `/adr-creator`), transform the `SKILL.md` into a passive Router. The Router merely directs the agent to load the `CONTEXT.md` of physical sub-folders (`01_...`, `02_...`) using Lazy Loading.

## Alternatives Considered
- **Universal ICM**: Forcing every skill into an ICM folder structure was rejected due to massive boilerplate overhead for simple tasks.
- **Universal Mega-Prompts**: Rejected because complex workflows fail completely when instructions exceed the agent's effective attention span.

## Consequences

### Pros
- Balances execution speed with architectural robustness.
- Preserves the "Glass Box" audit trail for complex tasks without polluting the filesystem for simple ones.
- Reduces the cognitive load on the agent by enforcing Context Scoping only when mathematically necessary.

### Cons
- Requires the AI System Designer to accurately evaluate the "weight" of a workflow upfront to choose the right architecture.

## References
- Interpretable Context Methodology: Folder Structure as Agentic Architecture (arXiv:2603.16021v2)
