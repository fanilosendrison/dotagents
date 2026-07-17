---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "file-system"
severity: "strict"
name: "ADR Final Naming Convention"
---

# ADR Naming Convention

When creating an Architecture Decision Record (ADR), you **MUST** follow this exact naming convention:

**`NNNN-short-descriptive-title.md`**

## Strict Rules

1. **Sequential Numbering (`NNNN`)**
   - You MUST pad the number with leading zeros to maintain 4 digits (e.g., `0001`, `0015`, `0123`).
   - Start with `0001` and increment by one for each new ADR.
   - Never reuse a number, even if an ADR is deprecated or rejected.

2. **Kebab-Case Title (`short-descriptive-title`)**
   - All letters MUST be lowercase.
   - Words MUST be separated by hyphens (`-`).
   - Do NOT use spaces, underscores (`_`), or CamelCase.
   - Keep the title short but descriptive enough to understand the decision at a glance.

3. **No Dates or Status in Filename**
   - Do NOT include dates (e.g., `2026-07-17`). Git handles versioning and history.
   - Do NOT include status keywords like `draft`, `accepted`, `deprecated`, `final`, or `v2`. 
   - Status must be tracked *inside* the ADR content, not in the filename.

## Example

```text
docs/adr/
  ├── 0001-record-architecture-decisions.md
  ├── 0002-use-postgresql-as-primary-database.md
  ├── 0003-implement-event-driven-architecture.md
```
