---
name: "adr-creator"
description: "Creates an Architecture Decision Record (ADR) autonomously."
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "architecture"
  entry_points:
    - "User explicitly requests an ADR"
    - "Architecturally significant decision detected"
---

# ADR Creator (ICM Router)

This skill extracts decision-making from a session and transforms it into an Architecture Decision Record (ADR) through 6 strictly isolated, sequential steps. 

You drop into a step folder, read its `CONTEXT.md`, perform your work, and then proceed to the next one.

## Workflow & Folder Structure

Each step in the pipeline is fully encapsulated. Here is the detailed anatomy of the skill:

```text
adr-creator/
├── SKILL.md                              ← You are here (Router).
├── 01-granularity-analysis/              ← Determine if the conversation contains one or multiple distinct decisions based on industry heuristics.
│   ├── CONTEXT.md                        ← The node logic (AgentWorkflowStep)
│   ├── conventions/                      ← Local business rules
│   ├── templates/                        ← The output formatting contract
│   └── output/                           ← The generated session data
├── 02-metadata-extraction/               ← Extract the deep technical context (Pros, Cons, Alternatives) for each identified decision.
│   ├── CONTEXT.md
│   ├── templates/
│   └── output/
├── 03-scoping-and-setup/                 ← Determine the correct NNNN identifier and supersedes links.
│   ├── CONTEXT.md
│   ├── conventions/
│   ├── templates/
│   └── output/
├── 04-autonomous-drafting/               ← Draft the ADR using the isolated data and templates.
│   ├── CONTEXT.md
│   ├── templates/
│   └── output/
├── 05-compliance-and-alignment/          ← Verify that the draft faithfully reflects the session's intent and adheres to formatting rules.
│   ├── CONTEXT.md
│   └── output/
└── 06-final-presentation-and-sealing/    ← Present the draft to the user, await final approval, and commit the file.
    ├── CONTEXT.md
    └── output/
```

---

## Quick Navigation

| Want to...                                          | Go here first                                |
|-----------------------------------------------------|----------------------------------------------|
| Know how to scope an ADR (Granularity)              | `01-granularity-analysis/conventions/adr-granularity.md` |
| Know how to name the session folder                 | `01-granularity-analysis/conventions/session-folder-naming.md` |
| Know how to name the extraction file                | `01-granularity-analysis/conventions/extraction-file-naming.md` |
| Know how to name the final ADR                      | `03-scoping-and-setup/conventions/naming-an-adr.md` |

---

## System Enforcement Rules

- **Strict Isolation:** You are executing a multi-step workflow. You must act **one step at a time**. **NEVER READ** the `CONTEXT.md` files of future steps in advance.
- **State Check:** The pipeline state is isolated by session folders (`YYYY-MM-DD-short-topic/`). Determine the current active step by checking if your specific session's folder exists and contains files inside the `output/` directories.
- **Execution Order:** Execute the stages sequentially. Enter a folder only if the previous folder's `output/` has been successfully populated.
- **Execution Limit:** Read **only** the `CONTEXT.md` of the current step, perform the required work, and then **STOP**. Move to the next step's folder only after the current step's output is fully generated.
- **Global Conventions:** Even inside this skill, you must strictly respect all global conventions listed in `~/.agents/AGENTS.md` (e.g., Markdown formatting, OKF schemas).
