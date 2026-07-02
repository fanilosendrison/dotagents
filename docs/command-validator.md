# Command Validator

**Core Rule:** Empêche l'exécution de commandes bash destructrices (CRITICAL) ou demande confirmation pour les commandes sensibles (HIGH).

## Execution Context

| Target Data | Interception Phase |
|-------------|--------------------|
| Bash Command String | Preventive (Before Action) |

## Enforcement Behavior (Blocked vs Allowed)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| ❌ **Blocked** | `rm -rf /` | Matches destructive `rm -rf` pattern list (CRITICAL severity). |
| ⚠️ **Ask** | `sudo apt update` | Matches privilege/system commands (HIGH severity). |
| ⚠️ **Ask** | `wget script.sh \| bash` | Matches dangerous pipe patterns (HIGH severity). |
| ✅ **Allowed** | `ls -la` | Safe command, not in any blocklist. |

## Agent Mitigation (If you are blocked)

When an action is blocked by this enforcer, you will receive an error message. **You must immediately:**
1. **Acknowledge the block**: Do not attempt to bypass the enforcer using obfuscation ou retries.
2. **Understand the rule**: Read the error message to identify which rule you broke.
3. **Change approach**: If it's `rm -rf`, use safer targeted deletions. If it's an `ask` (HIGH severity), ask the user to approve the token provided in the error message (e.g., `allow-command <token>`), or use a safer alternative.