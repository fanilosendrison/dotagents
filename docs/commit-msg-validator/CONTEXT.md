# Commit Message Validator

**Core Rule:** Enforces Conventional Commits syntax and best practices on your git commits. Blocks invalid commit messages.

## Execution Context

| Target Data | Interception Phase |
|-------------|--------------------|
| Bash Command String (`git commit -m ...`) | Preventive (Before Action) |

## Enforcement Behavior (Blocked vs Allowed)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| ❌ **Blocked** | `git commit -m "Fixed bug"` | Uses past tense instead of imperative, missing type/scope. |
| ❌ **Blocked** | `git commit -m "fix: Bug"` | Capital letter after the colon. |
| ❌ **Blocked** | `git commit -m "fix: bug."` | Trailing period. |
| ✅ **Allowed** | `git commit -m "fix(auth): handle null token"` | Correct Conventional Commits format with imperative present tense. |

## Agent Mitigation (If you are blocked)

When an action is blocked by this enforcer, you will receive an error message. **You must immediately:**
1. **Acknowledge the block**: Do not attempt to bypass the enforcer using obfuscation or retries.
2. **Understand the rule**: Read the error message to identify which rule you broke.
3. **Change approach**: Rewrite the commit message to follow Conventional Commits syntax (`type(scope): description`), using imperative present tense, no capitalization after the colon, and no trailing period.