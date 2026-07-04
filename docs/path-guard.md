# Path Guard

Prevents writing directly to `~/Developper/Projects/dot*` repos. All writes must go through the **symlink gateway** `~/.<name>/`.

## 1. Wiring — 2 interception points

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_call")` | **Pi** | `~/.pi/agent/extensions/path-guard.ts` |
| 2 | **Pre-tool-use hook** · reads stdin JSON | **Claude + Codex** | `~/.claude/hooks/path-guard.ts` (Claude) / `~/.codex/hooks/path-guard.ts` (Codex) |

Both share the **same engine** : `path-guard.ts`.

## 2. Trigger flow

### Pi Extension — 3 events intercepted

```typescript
// 1. Write — rewrites the path
pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("write", event) && !isToolCallEventType("edit", event)) return;
    // → silently mutated : file_path / path / TargetFile
});

// 2. Edit — same handler

// 3. Bash — rewrites the command
pi.on("tool_call", async (event) => {
    if (!isToolCallEventType("bash", event)) return;
    // → extracts paths, rewrites them, prepends a stderr warning
});
```

### Pre-tool-use (Claude/Codex) — pure block

Same logic but can only `allow` / `deny`.

## 3. How it works

### Dot pattern detection

```
Given path : ~/Developper/Projects/dotagents/skills/foo.ts
                         └──┬───┘
                      "dot" + name
                             │
                             ▼
            gateway = ~/.agents/skills/foo.ts
                         └──┬────┘
                     ~/. + name → ~/.agents/
                     
        Special case "pi" : gateway = ~/.pi/agent/
```

### Real path resolution

```typescript
function resolveReal(givenPath: string): string | null
```

- For existing files : `realpathSync()` resolves symlinks
- For new files : walks up ancestors until it finds an existing one, then `realpathSync` on the ancestor

### Path extraction from bash commands

```typescript
function extractBashPaths(command: string): string[]
```

1. **Unwraps** command wrappers : `env -i`, `sudo`, `nohup`, `bash -c '...'`
2. **Strips** quoted strings (avoids false positives)
3. Extracts :
   - **Redirect targets** : `> path`, `>> path`, `2> path`
   - **Tee targets** : `tee -a path`
   - **Path-like tokens** : `/...`, `~/...`, `relative/with/slash`

### Command wrapper unwrapping

```typescript
function unwrapCommand(command: string): string
```

Recursively unwraps (max 10 levels) :

| Given command | Extracted real command |
|--------------|----------------------|
| `env -i VAR=val bash -c 'echo test > ~/Developper/Projects/dotagents/foo'` | `echo test > ~/Developper/Projects/dotagents/foo` |
| `sudo -u user nohup ./script.sh` | `./script.sh` |
| `bash -c "cd /tmp && ./deploy.sh"` | `cd /tmp && ./deploy.sh` |

### Git whitelist

Pure git commands are **allowed** to run inside `dot*` repos :

```typescript
function isGitOnlyCommand(cmd: string): boolean
```

Each segment (separated by `&&` or `;`) must be either `git ...`, `cd ...`, `echo ...` (no redirect), or `true`/`false`/`exit`.

## 4. Behavior by runtime

### Pi (Extension) — Rewrite mode

| Tool | Given command/path | Behavior |
|------|-------------------|----------|
| **Write** `file_path = "~/Developper/Projects/dotpi/agent/foo.ts"` | 🔄 **Rewritten** to `~/.pi/agent/foo.ts` (silent) |
| **Edit** `path = "~/Developper/Projects/dotagents/AGENTS.md"` | 🔄 **Rewritten** to `~/.agents/AGENTS.md` |
| **Bash** `echo "test" > ~/Developper/Projects/dotagents/README.md` | 🔄 **Rewritten** + prepends `echo -e "\033[33m[Path-Guard] 🔄 Redirection...\033[0m" >&2 && ...` |
| **Bash** `cd ~/Developper/Projects/dotpi && git diff` | ✅ Passes — git-only command |
| **Bash** `cd ~/Developper/Projects/dotagents && bun run test` | ❌ **Blocked** — `bun` is not whitelisted |

### Claude/Codex (Pre-tool-use) — Block mode

| Tool | Given command/path | Behavior |
|------|-------------------|----------|
| **Write** direct `dot*` path | ❌ Deny + message "Use `~/.<name>/` instead" |
| **Bash** writing to `dot*` path | ❌ Deny |
| **Bash** `cd` + `git` only | ✅ Allow |

## 5. File tree

```
path-guard/
├── src/
│   ├── core/
│   │   ├── path-guard.ts              ← checkPath, checkBashCommand, rewriteBashCommand, extractBashPaths
│   │   └── __tests__/path-guard.test.ts
│   └── bin/
│       ├── pre-tool-use.ts            ← Pre-execution hook
│       └── __tests__/pre-tool-use.test.ts
```

## 6. Agent mitigation (when blocked)

1. **Pi :** you are never blocked — paths are silently rewritten. A yellow `[Path-Guard]` message appears in stderr to inform you
2. **Claude/Codex :** the block is final. You must :
   - Replace the physical path with the gateway : `~/.agents/` instead of `~/Developper/Projects/dotagents/`
   - If you need to commit/push, use only `cd` + `git` in a single command
3. **Do not** try wrappers (`env`, `bash -c`, `sudo`) to bypass — they are automatically unwrapped
