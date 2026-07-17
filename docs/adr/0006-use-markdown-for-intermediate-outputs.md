---
title: "Use Markdown for Intermediate Agent Outputs"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, agent, methodology, markdown, json]
---

# Use Markdown for Intermediate Agent Outputs

## Context
In a multi-stage agentic pipeline (like ICM), agents pass intermediate state to the next folder (e.g., extracting metadata in Step 1 for Step 2 to read). If this intermediate data is forced into strict JSON structures, it often crashes the pipeline due to LLMs failing to properly escape complex strings (like multi-line code blocks or quotes in "Pros" and "Cons"). Furthermore, raw JSON is difficult for humans to quickly read and debug during an audit.

## Decision
Mandate the use of structured Markdown instead of JSON for all intermediate pipeline state outputs (e.g., `output/extracted-metadata.md`). 
Agents must be instructed to generate strictly structured Markdown with specific heading hierarchies (`## Decision 1`, `### Pros`), which downstream agents will naturally parse and utilize.

## Alternatives Considered
- **Strict JSON Schemas**: Forcing the LLM to output valid JSON was rejected because it introduces a brittle point of failure (escaping errors) and reduces the "Interpretable Context" (auditability) for the human operator.

## Consequences

### Pros
- **Robustness**: Markdown is the native language of LLMs, completely eliminating JSON parsing/escaping crashes.
- **Human Interpretable**: A human can instantly open the intermediate file, read the extracted reasoning, and manually correct a bullet point if needed before the pipeline resumes.
- **Token Efficiency**: Markdown is often denser than JSON because it doesn't require repeating keys for every object in an array.

### Cons
- Requires the downstream agent to rely on its natural language understanding to parse the Markdown document, rather than utilizing a programmatic JSON schema validation step.

## References
- Interpretable Context Methodology: Folder Structure as Agentic Architecture (arXiv:2603.16021v2)
- Markdown Standard: https://daringfireball.net/projects/markdown/
