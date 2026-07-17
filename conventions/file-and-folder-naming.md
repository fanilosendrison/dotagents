---
name: file-and-folder-naming
description: You MUST strictly adhere to these file and directory naming rules whenever you create or rename anything in the workspace. Use kebab-case by default.
type: global-convention
---

# Naming Conventions

> 🛑 **CRITICAL DIRECTIVE**: Non-negotiable workspace constraints. Any violation breaks system routing. Do not attempt to be creative.

## 1. Default: `kebab-case`
You MUST use `kebab-case` (lowercase, hyphen-separated) for ALL files, scripts, and directories.
- **DO**: `user-profile/`, `data-parser.ts`, `api-routes.js`, `run-tests.sh`
- **DO NOT**: `UserProfile/`, `data_parser.ts`, `apiRoutes.js`, `my file.txt`

## 2. Allowed Exceptions (Strictly Scoped)
You may ONLY deviate from `kebab-case` in these two exact scenarios:
1. **System Entry Points**: Use `UPPERCASE.md` (e.g., `SKILL.md`, `CONTEXT.md`, `README.md`).
2. **UI Components**: Use `PascalCase` ONLY for UI files matching an exported component (e.g., `UserProfile.tsx`, `PrimaryButton.vue`).

## 3. Hard Prohibitions
- **NO spaces**.
- **NO special characters** (only alphanumeric, hyphens, and periods).
