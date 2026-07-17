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
3. For each decision, analyze the transcript and extract the technical data required by `templates/extraction-template.md`.
   - **Use the exact `Title`** provided in `decisions-list.md` for the document's main heading.
   - *CRITICAL*: Make sure to extract any technical debt, added dependencies, or maintenance burdens as `Cons`.
   - *CRITICAL*: Extract the actual literature, studies, papers, or technical standards discussed in the session for the `References` section. Do NOT reference the session ID or transcript itself.

## Output
Create your own session-specific directory inside `output/` (matching Step 1). 
For **each** decision, create a separate Markdown file using the exact `Target File` name specified in the list. 
Format each file exactly according to `templates/extraction-template.md`.

Once all files are written, proceed immediately to Step 3.
