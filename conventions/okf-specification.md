---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "specification"
domain: "architecture"
severity: "strict"
name: "Open Knowledge Format (OKF) Specification"
---

# Open Knowledge Format (OKF) Local Specification

## Overview
The **Open Knowledge Format (OKF)** is an open standard designed to solve the "context-assembly problem" for AI agents. Because AI agents often struggle to parse disconnected Markdown files, OKF combines standard Markdown with a strictly typed YAML frontmatter. This allows orchestrators (like Turnlock) to parse the semantic intent, inputs, and outputs of a file without needing to read the text.

If you are an agent reading this, you **MUST** follow these schemas whenever you create or modify workflow steps, skills, conventions, or templates in this workspace.

## Supported `kind` Types and Schemas

### A. `AgentWorkflowStep`
Used in `CONTEXT.md` files to define a node in a workflow graph (DAG).
- **Required keys:** 
  - `okf_version`: "1.0"
  - `kind`: "AgentWorkflowStep"
  - `step_id`: Integer
  - `name`: String
  - `role_description`: String (defines the prompt persona)
  - `inputs`: Array of objects (`path` and `format` strings)
  - `outputs`: Array of objects (`path` and `format` strings)
- **Optional keys:** `templates`, `conventions` (Arrays of relative paths).

### B. `AgentSkill`
Used in `SKILL.md` to define an agent's global capability.
- **Note:** Due to strict agent enforcer linting on `SKILL.md` files, all OKF keys must be nested under the standard `metadata` key.
- **Required keys inside `metadata`:**
  - `okf_version`: "1.0"
  - `kind`: "AgentSkill"
  - `domain`: String (e.g., "architecture")
  - `entry_points`: Array of strings describing when to trigger the skill.

### C. `KnowledgeAsset`
Used for conventions, rules, guidelines, and specifications (like this very file).
- **Required keys:**
  - `okf_version`: "1.0"
  - `kind`: "KnowledgeAsset"
  - `asset_type`: String (e.g., "convention", "specification")
  - `domain`: String
  - `severity`: String (e.g., "strict", "guideline")
  - `name`: String

### D. `RuntimeArtifact`
Used for outputs generated during a session (e.g., drafted ADRs, data extractions).
- **Note:** When creating templates (`templates/*.md`), they should bear the YAML frontmatter of the `RuntimeArtifact` they intend to generate. Do not use a separate `kind: Template`.
- **Required keys:**
  - `okf_version`: "1.0"
  - `kind`: "RuntimeArtifact"
  - `format`: String (strongly typed contract identifier, e.g., "markdown-adr")
  - `workspace`: String
  - `date`: String
  - `step_id`: Integer

## Orchestration Contract
The orchestrator relies on the `format` key in `RuntimeArtifact`s to match the `format` required in the `inputs` array of an `AgentWorkflowStep`. If the formats do not match exactly, the workflow will halt to prevent data corruption. Always ensure template formats exactly match the receiving step's expected input format.
