# Git Commits Push Enforcer

**Core Rule:** Enforces Conventional Commits syntax and ensures that `git push` is always chained with `git commit`.

## Execution Context

| Target Data | Interception Phase |
|-------------|--------------------|
| Bash Command String (`git commit ...`) | Preventive (Before Action) |

## Enforcement Behavior (Blocked vs Allowed)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| ❌ **Blocked** | `git commit -m "foo"` | Invalid Conventional Commits format. |
| ❌ **Blocked** | `git commit -m "fix: bar"` | Valid format, but missing chained `git push`. |
| ✅ **Allowed** | `git commit -m "fix: bar" && git push` | Valid format AND includes `git push`. |
| ✅ **Allowed** | `git commit` | Without `-m`, ignores enforcement (relies on editor). |

## Agent Mitigation (If you are blocked)

When an action is blocked by this enforcer, you will receive an error message. **You must immediately:**
1. **Acknowledge the block**: Do not attempt to bypass the enforcer using obfuscation or retries.
2. **Understand the rule**: Read the error message to identify which rule you broke.
3. **Change approach**: Use the `/git-commits-push` skill or format your commit as `git commit -m "<type>(<scope>): <desc>" && git push`.