# Path Guard

**Core Rule:** Forbids modifying files directly in `~/Developper/Projects/dot<name>/`. Forces all agents to write through their respective `~/.<name>/` symlink gateways instead.

## Execution Context

| Client | Interception Phase | Behavior |
|--------|--------------------|----------|
| **Pi Extension** | Pre-Tool (Mutates Input) | Transparent/Verbose Rewrite |
| **Native Hook (Claude/Codex)** | Pre-Tool (Blocks Input) | Strict Deny / Block |

## Enforcement Behavior

### 1. Pi Extension (Wrapper Mode)

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| 🔄 **Rewritten** | `Write` to `~/Developper/Projects/dotpi/agent/foo.ts` | Path is silently mutated to `~/.pi/agent/foo.ts` before execution. |
| 🔄 **Rewritten** | `Bash` `echo "test" > ~/Developper/Projects/dotagents/README.md` | Command is mutated to use `~/.agents/` and a `[Path-Guard]` warning is prepended to `stderr`. |
| ✅ **Allowed** | `Write` to `~/.pi/agent/foo.ts` | Safely uses the symlink gateway, left untouched. |
| ✅ **Allowed** | `Bash` `cd ~/Developper/Projects/dotpi/ && git commit` | Pure `git` (and `cd`) commands are whitelisted to run physically. |

### 2. Native Hook (Blocker Mode)

For Claude Code and Codex, because the hook runtime only supports `allow | ask | deny`, the enforcer acts as a strict blocker:

| Status | Example Input | Reason / Logic |
|--------|---------------|----------------|
| ❌ **Denied** | `Write` to `~/Developper/Projects/dotpi/...` | Hook returns `deny` with instructions to use the gateway instead. |
| ❌ **Denied** | `Bash` `echo "test" > ~/Developper/Projects/dotagents/...` | Hook returns `deny` with instructions to use the gateway. |
| ✅ **Allowed** | `Write` to `~/.pi/agent/foo.ts` | Safely uses the symlink gateway. |
| ✅ **Allowed** | `Bash` `cd ~/Developper/Projects/dotpi/ && git commit` | Pure `git` (and `cd`) commands are whitelisted. |

## Agent Experience

The experience depends on the client you are using:

**Using Pi:**
Since the enforcer is integrated as a "verbose wrapper" extension, it no longer blocks your actions. If you accidentally target a physical repository path instead of the symlink gateway:
- For `Write`/`Edit`: The path is fixed silently and the file is created at the correct location.
- For `Bash`: The command is rewritten on-the-fly and a yellow `[Path-Guard] 🔄 Redirection silencieuse...` warning will appear in the execution output, but the command will succeed.

**Using Claude Code / Codex (Native Hook):**
If you accidentally target a physical repository path, the tool call will be **blocked** and return an error message instructing you to use the appropriate symlink gateway. You will need to correct your path and retry the action.