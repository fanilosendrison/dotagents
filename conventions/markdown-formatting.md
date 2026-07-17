---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "documentation"
severity: "strict"
name: "Global Markdown Formatting Rules"
---

# Global Markdown Formatting Rules

When creating, editing, or managing Markdown files, all agents **MUST** strictly adhere to the following rules regarding voice, syntax, metadata, and formatting.

## 1. Voice, Tone, and Perspective (Contextual)
The perspective of your writing depends entirely on the file's target audience. You can determine the target audience by checking the file's OKF `kind` in its YAML frontmatter:

- **Agent-Facing Files** (`kind: KnowledgeAsset`, `AgentWorkflowStep`, `AgentSkill`):
  When writing files that dictate agent behavior (like conventions, `CONTEXT.md` instructions, or system rules), you must write in the **direct imperative voice, addressing the agent directly**. 
  - *Example:* "Your goal is to...", "You must extract...", "Do not use...", "Read the following file..."
  - *Why:* These files act as system prompts. Direct instructions reduce LLM ambiguity and enforce strict programmatic behavior.
  
- **Public/Human-Facing Files** (`kind: RuntimeArtifact`, Readmes, ADRs):
  When writing output files intended for human consumption or repository documentation, use a **professional, objective, or passive tone**. Do not address the AI or use words like "I" or "You".
  - *Example:* "The system will connect to...", "This decision was made because..."

## 2. Formatting & Syntax
- **GitHub Flavored Markdown (GFM):** Always use standard GFM syntax.
- **Linting Compliance:** Produce zero markdown lint violations. This includes avoiding trailing whitespace, ensuring proper line breaks before/after headers and lists, and using correct heading hierarchies (e.g., do not jump from an H1 directly to an H3).
- **Tables:** When generating markdown tables, the separator dashes (`---`) **MUST** match the exact character width of the header columns above them.

## 3. Language
- **Strictly English:** All documentation, logs, and markdown files must be written exclusively in English.

## 4. File Metadata (Open Knowledge Format)
- **YAML Frontmatter:** Whenever you create a structural markdown file (like a documentation page, a convention, or a skill), you must include an OKF-compliant YAML frontmatter block at the very top. This must declare its `kind`, `domain`, and `version` to ensure it is machine-readable by orchestrators. 
- **Specification:** For the exact allowed `kind` schemas and mandatory fields, you **MUST** refer to [okf-specification.md](file:///Users/famillesendrison/.agents/conventions/okf-specification.md).

## 5. Embedding Artifacts & Links
- Always use the `file:///` protocol for absolute local paths.
- Do not wrap hyperlink text in backticks.
- When embedding images, strictly use the `![caption](file:///path)` syntax.
