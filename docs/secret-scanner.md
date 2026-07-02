# Secret Scanner

**Core Rule:** Prevents committing sensitive information (API keys, tokens, passwords) by scanning the staged git diff before allowing a commit.

## Execution Context

| Target Data | Interception Phase |
|-------------|--------------------|
| Git Staged Diff | Preventive (Before Action on `git commit`) |

## Enforcement Behavior (Blocked vs Allowed)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| ❌ **Blocked** | Staged file with `AWS_SECRET_KEY=...` | Matches AWS Secret Key regex. |
| ❌ **Blocked** | Staged file with `password = "secret123!"` | Matches Password/Secret regex. |
| ✅ **Allowed** | Staged file with `process.env.API_KEY` | Whitelisted as false positive. |
| ✅ **Allowed** | Code changes without secrets | `scanDiff` returns clean. |

## Agent Mitigation (If you are blocked)

When an action is blocked by this enforcer, you will receive an error message indicating the line where the secret was detected. **You must immediately:**
1. **Acknowledge the block**: Do not attempt to bypass the enforcer using obfuscation or retries.
2. **Understand the rule**: Read the error message to identify which rule you broke.
3. **Change approach**: Unstage the file (`git reset HEAD <file>`). Remove the hardcoded secret from the code and replace it with an environment variable (e.g. `process.env.SECRET`). Then restage and commit again.