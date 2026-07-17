---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "file-system"
severity: "strict"
name: "Extraction File Naming"
---

# 🛑 Extraction File Naming Instructions

**YOUR DIRECTIVE:** When listing the `Target File` for a decision in the output template, you MUST use the exact following format:

`decision-[INDEX]-[kebab-case-topic].md`

### Rules
- **[INDEX]**: The sequential number of the decision in your list (e.g., 1, 2, 3).
- **[kebab-case-topic]**: A hyper-short, lowercase, hyphen-separated summary of the decision.
  - Maximum 4 words.
  - Do not use filler words (e.g., "decision", "adr", "about").

### Correct Examples:
- `decision-1-postgres-database.md`
- `decision-2-prisma-orm.md`

### Incorrect Examples:
- `decision-1-Postgres.md` (Not lowercase)
- `decision-1-we-should-use-postgres-for-db.md` (Too long)
- `decision-2.md` (Missing the kebab-case topic)
