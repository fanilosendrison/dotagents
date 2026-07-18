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

Tone follows document **function**: directive documents (which command agent behavior) use the imperative voice; descriptive documents (which describe a system, including agent-consumed `RuntimeArtifact`s like CDDs) use the objective voice. The OKF `kind` is a proxy for this distinction, not its definition.

- **Directive Documents (Imperative Voice):**
  When writing files that dictate agent behavior (like conventions, `CONTEXT.md` instructions, `AgentSkill` rules, or **NIBs**), you must write in the **direct imperative voice, addressing the agent directly**. 
  - *Proxy `kind`:* `KnowledgeAsset`, `AgentWorkflowStep`, `AgentSkill`, and `nib-module`.
  - *Example:* "Your goal is to...", "You must extract...", "Verify args is..."
  - *Why:* These files act as system prompts or rigid coding instructions. Direct imperatives reduce LLM ambiguity.
  
- **Descriptive Documents (Objective Voice):**
  When writing files that describe a system's conceptual physics (like CDDs), outputs for human consumption, or repository documentation, use a **professional, objective, or passive tone**. Do not address the AI or use words like "I" or "You".
  - *Proxy `kind`:* `RuntimeArtifact` (e.g., CDDs, drafted ADRs), Readmes.
  - *Example:* "The system connects to...", "This decision was made because...", "The module parses..."

## 2. Formatting & Syntax
- **GitHub Flavored Markdown (GFM):** Always use standard GFM syntax.
- **Linting Compliance:** Produce zero markdown lint violations. This includes avoiding trailing whitespace, ensuring proper line breaks before/after headers and lists, and using correct heading hierarchies (e.g., do not jump from an H1 directly to an H3).
- **Tables:** When generating markdown tables, the separator dashes (`---`) **MUST** match the exact character width of the header columns above them.

## 3. Language
- **Agent Instructions (Directive):** Internal system files (`KnowledgeAsset`, `AgentSkill`, `AgentWorkflowStep`) AND strict implementation briefs (**NIBs**). **Must be written exclusively in English.** A strict English policy prevents translation nuances from breaking behavioral contracts when prompting an AI.
- **Conception Drafts (Internal/Descriptive):** Files used for architectural brainstorming and system description (e.g., **CDDs**, session notes, ADRs). **Not strictly required to be in English.** They can be written in other languages (e.g., French) to facilitate human thought, before being extracted into English NIBs.
- **Public Documentation:** READMEs, user-facing guides, external API docs. **Must be written exclusively in English.**

## 4. File Metadata (Open Knowledge Format)
- **YAML Frontmatter:** Whenever you create a structural markdown file (like a documentation page, a convention, or a skill), you must include an OKF-compliant YAML frontmatter block at the very top. This must declare its `kind`, `domain`, and `version` to ensure it is machine-readable by orchestrators. 
- **Specification:** For the exact allowed `kind` schemas and mandatory fields, you **MUST** refer to [okf-specification.md](file:///Users/famillesendrison/.agents/conventions/okf-specification.md).

## 5. Embedding Artifacts & Links
- Always use the `file:///` protocol for absolute local paths.
- Do not wrap hyperlink text in backticks.
- When embedding images, strictly use the `![caption](file:///path)` syntax.
