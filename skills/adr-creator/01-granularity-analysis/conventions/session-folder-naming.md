---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "file-system"
severity: "strict"
name: "Session Folder Naming"
---

# 🛑 Session Folder Naming Instructions

**YOUR DIRECTIVE:** When creating the session-specific directory to store your outputs, you MUST format the folder name exactly as follows:

`YYYY-MM-DD-[kebab-case-short-topic]`

### Rules
- **[YYYY-MM-DD]**: The current date (e.g., `2026-07-17`).
- **[kebab-case-short-topic]**: A hyper-short, lowercase, hyphen-separated summary of the primary overarching topic of the conversation.
  - Maximum 3 words.
  - Do not use filler words (e.g., "adr", "decision", "about").

### Correct Examples:
- `2026-07-17-auth-refactor`
- `2026-07-17-database-migration`

### Incorrect Examples:
- `2026-07-17-Auth.Refactor` (Not kebab-case)
- `2026-07-17-decision-about-the-new-auth-system` (Too long, contains filler words)
- `auth-refactor` (Missing the date prefix)
