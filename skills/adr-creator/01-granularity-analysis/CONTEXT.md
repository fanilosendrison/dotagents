---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 1
name: "Granularity Analysis"
role_description: "Architectural Analyst"
inputs:
  - path: "transcript.jsonl"
    format: "json-transcript"
outputs:
  - path: "output/"
    format: "markdown-decisions-list"
templates:
  - "templates/decisions-list-template.md"
conventions:
  - "conventions/adr-granularity.md"
  - "conventions/extraction-file-naming.md"
  - "conventions/session-folder-naming.md"
---

# Step 1: Granularity Analysis

Determine exactly *how many* Architecture Decision Records (ADRs) need to be created based on the conversation. Do not extract pros/cons yet.

## Tasks
1. Analyze the transcript.
2. Apply `./conventions/adr-granularity.md` to identify the distinct decisions.
3. Apply `./conventions/extraction-file-naming.md` to format their target filenames.

## Output
1. Create a session-specific directory inside `output/` by applying `./conventions/session-folder-naming.md`.
2. Save your output as `decisions-list.md` inside this new directory, strictly formatted according to `templates/decisions-list-template.md`.

Once written, proceed immediately to Step 2.
