---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 2
name: "Metadata Extraction"
role_description: "Analytical Extractor"
inputs:
  - path: "../01-granularity-analysis/output/"
    format: "markdown-decisions-list"
outputs:
  - path: "output/"
    format: "markdown-extraction"
templates:
  - "templates/extraction-template.md"
---

# Step 2: Session Analysis & Extraction

Extract the raw facts of the architectural decision(s) identified in Step 1. Do not draft the final ADR yet.

## Tasks
1. Read the `decisions-list.md` from your active session's folder in `../01-granularity-analysis/output/` to determine which decisions must be extracted.
2. For each decision, analyze the transcript and extract the technical data
   required by `templates/extraction-template.md`.
   - Use the exact `Title` from `decisions-list.md` as the main heading.
   - Extract technical debt, dependencies, and maintenance burdens as costs and
     obligations.
   - Identify the scope the decision governs.
   - Extract only relationships explicitly asserted from the new decision to an
     existing ADR: `clarifies`, `amends`, `supersedes`, and `confirms`.
   - Extract actual literature, standards, and internal artifacts discussed in
     the session. Never cite the transcript or session ID.

## Output
Create your own session-specific directory inside `output/` (matching Step 1). 
For **each** decision, create a separate Markdown file using the exact `Target File` name specified in the list. 
Format each file exactly according to `templates/extraction-template.md`.

Once all files are written, proceed immediately to Step 3.
