---
name: document-agent-enforcement
description: Document an agent-enforcer script (security rule, validator, linter). Use when the user asks to document an enforcer, add enforcement docs, or explain a security rule.
---

# Document an Agent Enforcer

You are documenting a strict security rule or guardrail from the `~/.agents/agent-enforcers/` directory.
The documentation must be written directly as `README.md` inside the enforcer's root directory (e.g., `~/.agents/agent-enforcers/command-validator/README.md`).

## STEP 1. Read the Source Code

First, read the target enforcer's source code. You must understand:
- What input data it analyzes (Bash string, file content, git commit).
- Its interception phase (preventive vs reactive).
- What exact patterns or heuristics cause it to block or allow an action.

## STEP 2. Write the README.md

Create or overwrite the `README.md` file in the enforcer's directory using the exact template below. Do not use client-specific terms like `PreToolUse` or `PostToolUse` — keep it entirely agnostic.

### Template

~~~markdown
# [Enforcer Name]

**Core Rule:** [One sentence explaining what this enforcer ensures or prevents. e.g., "Empêche l'exécution de commandes bash destructrices."]

## Execution Context

| Target Data | Interception Phase |
|-------------|--------------------|
| [e.g., Bash Command String] | [Preventive (Before Action) / Reactive (After Action)] |

## Enforcement Behavior (Blocked vs Allowed)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| ❌ **Blocked** | `rm -rf /` | Matches destructive pattern list. |
| ❌ **Blocked** | `echo "token" > .env` | Matches secret leak heuristic. |
| ✅ **Allowed** | `rm file.txt` | Safe, targeted file deletion. |

## Agent Mitigation (If you are blocked)

When an action is blocked by this enforcer, you will receive an error message. **You must immediately:**
1. **Acknowledge the block**: Do not attempt to bypass the enforcer using obfuscation or retries.
2. **Understand the rule**: Read the error message to identify which rule you broke.
3. **Change approach**: [Specific mitigation strategy, e.g., "Use `git clean` instead of `rm -rf`"].
~~~
