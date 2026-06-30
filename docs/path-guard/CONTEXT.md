# Path Guard

**Core Rule:** Forbids modifying files directly in `~/Developper/Projects/dot<name>/`. Forces all agents to write through their respective `~/.<name>/` symlink gateways instead.

## Execution Context

| Target Data | Interception Phase |
|-------------|--------------------|
| Target Path (`Write`, `Edit`) | Transparent Rewrite (Mutates Input) |
| Bash Command String (`Bash`) | Verbose Rewrite (Mutates Command) |

## Enforcement Behavior (Rewritten vs Allowed)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| 🔄 **Rewritten** | `Write` to `~/Developper/Projects/dotpi/agent/foo.ts` | Path is silently mutated to `~/.pi/agent/foo.ts` before execution. |
| 🔄 **Rewritten** | `Bash` `echo "test" > ~/Developper/Projects/dotagents/README.md` | Command is mutated to use `~/.agents/` and a `[Path-Guard]` warning is prepended to `stderr`. |
| ✅ **Allowed** | `Write` to `~/.pi/agent/foo.ts` | Safely uses the symlink gateway, left untouched. |
| ✅ **Allowed** | `Bash` `cd ~/Developper/Projects/dotpi/ && git commit` | Pure `git` (and `cd`) commands are whitelisted to run physically. |

## Agent Experience

Since the enforcer has been upgraded to a "verbose wrapper", it no longer blocks your actions. If you accidentally target a physical repository path instead of the symlink gateway:
- For `Write`/`Edit`: The path is fixed silently and the file is created at the correct location.
- For `Bash`: The command is rewritten on-the-fly and a yellow `[Path-Guard] 🔄 Redirection silencieuse...` warning will appear in the execution output, but the command will succeed.