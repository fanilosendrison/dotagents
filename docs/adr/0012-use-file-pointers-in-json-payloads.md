---
title: "Use File Pointers in Orchestrator JSON Payloads"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, agent, methodology, turnlock, json, payload]
---

# Use File Pointers in Orchestrator JSON Payloads

## Context
When an agentic workflow is orchestrated via Turnlock (Hard Determinism), the state is strictly validated via JSON (`state.json`). If the workflow involves generating or modifying large amounts of text (e.g., Markdown specifications, code files), embedding these raw strings directly into the JSON payload creates massive, unreadable objects. This leads to severe JSON escaping errors by the LLM and completely destroys the "Glass Box" auditability, as developers cannot easily read or edit a 5000-word string stuffed inside a single JSON value.

## Decision
When using JSON-based orchestrators like Turnlock, the JSON payload must **strictly use absolute file paths (pointers)** instead of embedding raw text strings for large artifacts.
- The LLM must read from and write to physical `.md` or `.ts` files on the disk.
- The JSON returned to the orchestrator must only contain the `path` to the modified file (e.g., `{ "draft_path": "/absolute/path/to/draft.md" }`).

## Alternatives Considered
- **Embedding Raw Text in JSON**: Rejected because it causes recurrent LLM escaping failures (especially with nested quotes or code blocks) and prevents developers from reviewing the intermediate work natively in their IDE.

## Consequences

### Pros
- **Robustness**: Eliminates all JSON escaping crashes caused by complex formatting or multi-line strings.
- **Glass Box Auditing**: Allows developers to instantly open the intermediate file in their IDE, review the Markdown or code with syntax highlighting, and manually correct it if needed before the orchestrator proceeds to the next phase.
- **Payload Efficiency**: Keeps the `state.json` lightweight and strictly focused on structural routing metadata.

### Cons
- Requires the agent to perform two distinct actions (writing the file to disk via `write_to_file` AND updating the JSON payload), which slightly increases the complexity of the prompt instructions.

## References
- Validating Agent Context Management session discussion.
- Turnlock Bridge Specification: `turnlock-bridge.md`
