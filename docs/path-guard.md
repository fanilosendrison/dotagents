# Path Guard

Prevents writing directly to `~/Developper/Projects/dot*` repos through the **write surfaces it governs**. Governed writes must go through the **symlink gateway** `~/.<name>/`.

The guard is **not** a general filesystem/process isolation boundary. It governs Write/Edit tool calls and the Bash write destinations whose operand is mechanically established by shell syntax or by an explicitly governed command. Ordinary path arguments are preserved, and mutations performed internally by an arbitrary launched process are outside its guarantee (see §3, Enforcement boundary).

## 1. Wiring — 2 interception points

| Number | Mechanism | Runtime | File |
| ------ | --------- | ------- | ---- |
| 1 | **Pi Extension** · `pi.on("tool_call")` | **Pi** | `~/.pi/agent/extensions/path-guard.ts` |
| 2 | **Codex pre-tool-use hook** · reads stdin JSON | **Codex** | `~/.codex/hooks/path-guard.ts` |

The **same engine** is shared across runtimes : `path-guard.ts`.

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
    // → sanctioned git-commits-push launches pass through untouched
    // → otherwise extracts governed write targets, rewrites them, prepends a
    //   stderr warning only when a substitution actually happens
});
```

### Codex pre-tool-use — deny with rewrite hint

Codex uses the same shared path logic but cannot mutate the tool input. It
denies direct physical repo paths and includes the gateway path or rewritten
command to retry.

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

### Governed Bash write targets

```typescript
function extractBashWriteTargets(command: string): string[]
```

1. **Unwraps** command wrappers : `env -i`, `sudo`, `nohup`, `bash -c '...'`
2. **Tokenizes** shell quotes and escapes before extracting tokens
3. Extracts only mechanically established write destinations :
   - **Output redirect targets** : `> path`, `>> path`, `1> path`, `2> path`,
     `2>> path`, `&> path`, `&>> path`, attached (`>path`) or detached (`> path`)
   - **Tee targets** : `tee -a path`
4. Never extracts :
   - ordinary path-like arguments (`ls relative/path`, `git diff -- path`, an
     argument of an arbitrary program)
   - input redirection operands (`< path`, `<< word`) — their operand is read
   - bare words (`> out.txt`), which are not resolved against the guard working
     directory

The older `extractBashPaths()` helper remains as the non-enforcement "every
path-like token" abstraction used by telemetry consumers (for example the Pi
extension's `path-guard` event attribution). Enforcement must not use it :
"all paths" and "governed write targets" are separate concepts.

### Command wrapper unwrapping

```typescript
function unwrapCommand(command: string): string
```

Recursively unwraps (max 10 levels) :

| Given command | Extracted real command |
| ------------- | ---------------------- |
| `env -i VAR=val bash -c 'echo test > ~/Developper/Projects/dotagents/foo'` | `echo test > ~/Developper/Projects/dotagents/foo` |
| `sudo -u user nohup ./script.sh` | `./script.sh` |
| `bash -c "cd /tmp && ./deploy.sh"` | `cd /tmp && ./deploy.sh` |

### Git whitelist

Pure git commands are **allowed by path-guard** to run inside `dot*` repos :

```typescript
function isGitOnlyCommand(cmd: string): boolean
```

Each segment (separated by `&&` or `;`) must be either `git ...`, `cd ...`,
`echo ...` with no redirect, or `true`/`false`/`exit`. Raw `git commit` and
`git push` are still handled by `git-commits-push-enforcer`.

### Sanctioned git-commits-push launches

The Bash guard governs the write surfaces it protects. It is **not** an
argument-semantics analyzer : its extraction is syntactic and cannot know what
an arbitrary program means by the paths it receives.

A canonical installed-binary launch is therefore left **strictly untouched** :

```typescript
import { recognizeGitCommitsPushCommand } from "~/.agents/agent-enforcers/git-commits-push-enforcer/src/core/validator.ts";

function isSanctionedGitCommitsPushLaunch(command: string): boolean {
  return recognizeGitCommitsPushCommand(command) === "binary-launch";
}
```

`checkBashCommand()` returns `allowed` and `rewriteBashCommand()` returns the
command byte-identical for those launches, before any path extraction.

`recognizeGitCommitsPushCommand()` is the **only** authority for this decision.
It already fails closed on shell wrappers, `&&`/`;` chains, pipelines,
redirections, backgrounding, command substitution, backticks, process
substitution, non-canonical executable forms, and dynamic arguments. Commands it
refuses receive **no** exemption, so their direct writes stay protected exactly
as before.

The guard owns no `git-commits-push` argument grammar and interprets none of its
arguments.

### Enforcement boundary (normative)

```text
Known governed write destination
  Write / Edit tool path, output redirection target, `tee` target
  → protected

Ordinary or unknown path argument
  Read-only argument, Git relative pathspec, argument of an arbitrary program
  → preserved byte-for-byte

Mutation performed internally by a launched process, or a write whose
  destination cannot be established mechanically
  → outside the path guard guarantee
```

A path that merely appears in a Bash command is **not** write evidence. The
guard rewrites the operand of an output redirection or a `tee`, and it rewrites
`Write` / `Edit` tool paths; it does not guess how `cp`, `rm`, `rsync`, `python`,
`node`, or any other program treats its own operands. There is no command
registry and no general read/write argument analyzer.

Preventing every process-level write to a protected repository is a stronger
requirement than a Bash path parser can provide. That guarantee belongs to a
filesystem/process isolation layer, not to this guard. This limit is the
accepted normative boundary, not a defect to repair inside the parser.

## 4. Behavior by runtime

### Pi (Extension) — Rewrite mode

| Tool | Given command/path | Behavior |
| ---- | ------------------ | -------- |
| **Write** `file_path = "~/Developper/Projects/dotpi/agent/foo.ts"` | 🔄 **Rewritten** to `~/.pi/agent/foo.ts` (silent) |
| **Edit** `path = "~/Developper/Projects/dotagents/AGENTS.md"` | 🔄 **Rewritten** to `~/.agents/AGENTS.md` |
| **Bash** `echo "test" > ~/Developper/Projects/dotagents/README.md` | 🔄 **Rewritten** + prepends `echo -e "\033[33m[Path-Guard] 🔄 Redirection...\033[0m" >&2 && ...` |
| **Bash** `cat ~/Developper/Projects/dotagents/AGENTS.md` | ✅ Passes unchanged — read-only argument, not write evidence |
| **Bash** `ls relative/path` (cwd in a physical `dot*` worktree) | ✅ Passes unchanged — relative read argument preserved byte-for-byte |
| **Bash** `cd ~/Developper/Projects/dotpi && git diff` | ✅ Passes — git-only command |
| **Bash** `cd ~/Developper/Projects/dotagents && bun run test` | ✅ Passes unchanged — `cd` is an ordinary path argument, not a governed write destination |
| **Bash** `some-program ~/Developper/Projects/dotagents/path` | ✅ Passes unchanged — unknown argument semantics; outside the guarantee |
| **Bash** `"$HOME/.local/bin/git-commits-push" --repository "~/Developper/Projects/dotagents" ...` | ✅ Passes — sanctioned canonical launch, arguments untouched |
| **Bash** `"$HOME/.local/bin/git-commits-push" ... > ~/Developper/Projects/dotagents/out.txt` | 🔄 **Rewritten** — the recognizer refuses this form, so the redirect write stays protected; the `--repository` argument itself is preserved |

### Codex (Pre-tool-use) — Deny mode

| Tool | Given command/path | Behavior |
| ---- | ------------------ | -------- |
| **Write** direct `dot*` path | ❌ Deny + message "Use `~/.<name>/` instead" |
| **Bash** redirect/tool write to a `dot*` path | ❌ Deny + rewritten command hint |
| **Bash** read-only or unknown path argument | ✅ Allowed by path-guard; argument unchanged |
| **Bash** `cd` + `git` only | ✅ Allowed by path-guard; raw commit/push may still be blocked by git enforcer |
| **Bash** canonical `git-commits-push` launch | ✅ Allowed by path-guard; arguments are not inspected or rewritten |

## 5. File tree

```
path-guard/
└── src/
    └── core/
        ├── path-guard.ts              ← checkPath, checkBashCommand, rewriteBashCommand
        ├── bash-parser.ts             ← unwrapCommand, extractBashPaths (all paths), extractBashWriteTargets (enforcement), isGitOnlyCommand
        ├── helpers.ts                 ← resolveReal, targetsDotRepo, extractRepo
        └── __tests__/
            ├── path-guard.test.ts
            ├── path-guard-relative-boundary.test.ts
            └── git-commits-push-shell-boundary.test.ts
```

## 6. Agent mitigation (when blocked)

1. **Pi :** you are never blocked — a governed write destination is silently rewritten. A yellow `[Path-Guard]` message appears in stderr to inform you. Ordinary read-only arguments are not rewritten.
2. **Codex :** the block is final. You must :
   - Replace the physical write destination with the gateway : `~/.agents/` instead of `~/Developper/Projects/dotagents/`
   - If you need to commit or push, use `/git-commits-push`; do not run raw `git commit` or `git push`
3. **Do not** try wrappers (`env`, `bash -c`, `sudo`) to bypass a governed write — they are automatically unwrapped
4. A write performed internally by a program you launch (`cp`, `rm`, `rsync`, a script, ...) is **not** governed by the Bash parser. Route those writes through the gateway yourself; the guard cannot enforce them for you.
