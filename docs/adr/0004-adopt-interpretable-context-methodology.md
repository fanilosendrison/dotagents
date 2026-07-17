---
title: "Adopt Interpretable Context Methodology (ICM)"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, agent, methodology, icm]
---

# Adopt Interpretable Context Methodology (ICM)

## Context
When designing autonomous agent skills, embedding large, complex workflows into a single "Mega-Prompt" within a `SKILL.md` file results in bloated context windows, poor observability, and rigid execution paths. This monolithic approach prevents developers from tracking intermediate reasoning or fixing a specific step without restarting the entire workflow.

## Decision
Adopt the Interpretable Context Methodology (ICM) as the foundational architecture for agent skills. This methodology mandates breaking down workflows into strictly isolated, physical folder pipelines. The main `SKILL.md` acts merely as a Router that enforces "Lazy Loading," directing the agent to move through sequential directories (`01_...`, `02_...`), each containing its own hyper-focused `CONTEXT.md` and an `output/` directory.

## Alternatives Considered
- **Single Mega-Prompt**: Keeping all instructions in one large `SKILL.md` was rejected because it reduces "glass box" transparency and makes error recovery impossible.
- **Agent Code Scripts**: Having the agent write and execute Python scripts for orchestration was rejected because it removes the declarative, text-based simplicity of the prompt-driven pipeline.

## Consequences

### Pros
- **Cognitive Isolation**: Agents focus 100% of their tokens on a single step at a time, drastically reducing hallucinations.
- **Resumability (Glass Box)**: Developers can read, audit, or manually fix the `output/` of a specific step and ask the agent to resume, without restarting the whole process.
- **Strict Execution Boundaries**: Lazy Loading prevents the agent from reading ahead and getting confused by downstream logic.

### Cons
- Increases the initial architectural overhead (requiring the creation of multiple directories and context files instead of just one Markdown file).

## References
- Interpretable Context Methodology: Folder Structure as Agentic Architecture (arXiv:2603.16021v2)
