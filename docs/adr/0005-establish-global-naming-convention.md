---
title: "Establish Global File and Folder Naming Convention"
status: accepted
workspace: "dotagents"
date: "2026-07-17"
step_id: 6
supersedes: None
author: Antigravity
tags: [architecture, convention, filesystem, naming]
---

# Establish Global File and Folder Naming Convention

## Context
Inconsistent naming conventions across different sub-projects, scripts, and agent workspaces create confusion and increase the likelihood of LLM hallucination. A mix of `snake_case`, `CamelCase`, and `kebab-case` forces the agent framework to parse edge cases continuously, which drains context efficiency.

## Decision
Enforce `kebab-case` (lowercase, hyphen-separated) universally as the default naming convention for ALL files, scripts, and directories.
There are only two strictly scoped exceptions:
1. **System Entry Points**: Use `UPPERCASE.md` (e.g., `SKILL.md`, `CONTEXT.md`) so they stand out for agents.
2. **UI Components**: Use `PascalCase` ONLY for UI files matching an exported component (e.g., `UserProfile.tsx`).

## Alternatives Considered
- **Language-Specific Conventions**: Allowing `snake_case` for Python or Bash scripts was rejected. In a modern, highly standardized agent environment, allowing fragmented exceptions based on file extensions makes programmatic rule enforcement difficult and confusing for agents.

## Consequences

### Pros
- Simplifies instructions for LLMs, resulting in zero edge cases (a script like `quick-validate.ts` follows the exact same rules as folders).
- Provides a unified, clean aesthetic across the entire project structure.
- "MUST DO" imperative constraints mechanically force agents to obey the convention.

### Cons
- Deprecates familiar, historical conventions like `snake_case` for Python scripts, which might feel unnatural to human developers initially.

## References
- Agentic Naming Conventions (internal documentation): file-and-folder-naming.md
- Kebab-case standard: https://en.wikipedia.org/wiki/Letter_case#Kebab_case
