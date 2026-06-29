# Docs — Agent Enforcers & Shared Logic

This folder documents all agnostic agent-enforcer rules (security, validators, linters).
These rules intercept agent tools across Pi, Claude, and Codex.

When you need to document a new enforcer, look here first to understand what's already been done, then document any new changes using the `document-agent-enforcement` skill.

## How to Add a New Enforcer Doc

1. Create a folder with the enforcer name: `docs/<enforcer-name>/`
2. Add a `CONTEXT.md` inside using the template from `document-agent-enforcement`.
3. Add an entry below with date and link.

## Existing Enforcers

*(No enforcers documented here yet. Run `document-agent-enforcement` to start!)*

### 1. Command Validator
- **Date** : 2026-06-29
- **Doc** : [`command-validator/CONTEXT.md`](command-validator/CONTEXT.md)

### 2. Commit Message Validator
- **Date** : 2026-06-29
- **Doc** : [`commit-msg-validator/CONTEXT.md`](commit-msg-validator/CONTEXT.md)

### 3. Git Commits Push Enforcer
- **Date** : 2026-06-29
- **Doc** : [`git-commits-push-enforcer/CONTEXT.md`](git-commits-push-enforcer/CONTEXT.md)

### 4. Path Guard
- **Date** : 2026-06-29
- **Doc** : [`path-guard/CONTEXT.md`](path-guard/CONTEXT.md)

### 5. Secret Scanner
- **Date** : 2026-06-29
- **Doc** : [`secret-scanner/CONTEXT.md`](secret-scanner/CONTEXT.md)
