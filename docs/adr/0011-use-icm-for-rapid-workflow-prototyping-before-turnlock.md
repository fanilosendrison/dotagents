---
title: "Use ICM for Rapid Workflow Prototyping Before Turnlock"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, agent, methodology, turnlock, icm, prototyping]
---

# Use ICM for Rapid Workflow Prototyping Before Turnlock

## Context
Turnlock provides "Hard Determinism" through Zod-validated JSON payloads and strict TypeScript state machines, making it the ultimate solution for preventing LLM "overconfidence bias" in complex workflows. However, building a Turnlock phase is engineering-heavy. Using Turnlock immediately for highly exploratory, qualitative, or text-heavy workflows (like drafting NIBs or extracting ADRs) introduces excessive boilerplate and slows down rapid iteration.

## Decision
Adopt a two-tier methodology for agent workflow development:
1. **Rapid Prototyping (Soft Determinism)**: Use the Interpretable Context Methodology (ICM)—which relies on physical folders and Markdown—to quickly build, test, and iterate on new agentic workflows. ICM allows for "Glass Box" manual debugging and natural language parsing.
2. **Production Solidification (Hard Determinism)**: Once an ICM workflow is proven, stabilized, and deemed critical infrastructure, translate it into a Turnlock orchestrated state machine to lock down the determinism and ensure fail-closed security.

## Alternatives Considered
- **Turnlock-Only Approach**: Forcing all agent workflows into Turnlock immediately was rejected because the TypeScript boilerplate kills the agility needed to explore qualitative LLM tasks.
- **ICM-Only Approach**: Rejected because ICM (Soft Determinism) cannot mechanically prevent an LLM from hallucinating or ignoring a rule, making it insufficient for critical production pipelines.

## Consequences

### Pros
- Provides a fast, frictionless playground for AI Systems Designers to test complex multi-step prompts using markdown and folders.
- Ensures that only mature, high-value workflows incur the engineering cost of being ported to Turnlock.
- ICM acts as a perfect functional specification for the eventual Turnlock implementation.

### Cons
- Requires developers to maintain two different orchestration methodologies (`.agents/skills/` vs Turnlock TS codebase) depending on the maturity of the workflow.

## References
- Turnlock Orchestrator Documentation: `NX-TURNLOCK.md`
- Interpretable Context Methodology: Folder Structure as Agentic Architecture (arXiv:2603.16021v2)
