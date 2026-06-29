# Path Guard

**Core Rule:** Forbids modifying files directly in `~/Developper/Projects/dot<name>/`. Forces all agents to write through their respective `~/.<name>/` symlink gateways instead.

## Execution Context

| Target Data | Interception Phase |
|-------------|--------------------|
| Target Path (`Write`, `Edit`) | Preventive (Before Action) |
| Bash Command String (`Bash`) | Preventive (Before Action) |

## Enforcement Behavior (Blocked vs Allowed)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| ❌ **Blocked** | `Write` to `~/Developper/Projects/dotpi/agent/foo.ts` | Direct physical path is strictly forbidden. |
| ❌ **Blocked** | `Bash` `echo "test" > ~/Developper/Projects/dotagents/README.md` | Redirection to direct physical path is forbidden. |
| ✅ **Allowed** | `Write` to `~/.pi/agent/foo.ts` | Safely uses the symlink gateway. |
| ✅ **Allowed** | `Bash` `cd ~/Developper/Projects/dotpi/ && git commit` | Pure `git` (and `cd`) commands are whitelisted to run physically. |

## Agent Mitigation (If you are blocked)

When an action is blocked by this enforcer, you will receive an error message containing the correct gateway. **You must immediately:**
1. **Acknowledge the block**: Do not attempt to bypass the enforcer using obfuscation or retries.
2. **Understand the rule**: Read the error message to identify which rule you broke.
3. **Change approach**: Replace the physical path with the symlink gateway suggested in the error (e.g., replace `~/Developper/Projects/dotagents/` with `~/.agents/`). Use physical paths ONLY for git commands.