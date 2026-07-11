# Command & Tool Validator

Prevents execution of **destructive or dangerous bash commands** and blocks
usage of **modification tools** unless the runtime's permission checker says
the current session is authorized.

The validator has been refactored into two specialized validators:
- **BashValidator** — validates bash commands against security rules
- **ToolPermissionValidator** — blocks write/edit tools if the injected or legacy permission checker is not granted

## 1. Wiring — 3 interception points

| Number | Mechanism | Runtime | File |
| ------ | --------- | ------- | ---- |
| 1 | **Pi Extension** · `pi.on("tool_call")` | **Pi** | `~/.pi/agent/extensions/command-validator.ts` |
| 2 | **Pre-tool-use hook** · reads stdin JSON | **Claude Code** | `~/.claude/hooks/command-validator.ts` |
| 3 | **Pre-tool-use hook** · reads stdin JSON | **Codex** | `~/.codex/hooks/command-validator.ts` |

All share the **same core logic**: `~/.agents/agent-enforcers/command-validator/`.
Codex and Pi also share the runtime-facing normalization helpers in
`~/.agents/agent-enforcers/command-validator/src/core/runtime-contract.ts`.

**Note:** the Claude hook only validates bash commands (`tool_name === "Bash"`). The Codex hook validates both bash commands AND restricted tools (write, edit) — the tool-validator is fully wired. In Pi, tool-validator is also wired via the extension. `/go` prompt detection is owned by `permission-enforcer`; `command-validator` only consumes the resulting state when a restricted tool is requested.

## 2. Trigger flow

```
Tool invoked by agent
        │
        ▼
┌───────────────────────────────────────────────┐
│  CommandValidator.validate(command, toolName)  │
│                                                 │
│  RESTRICTED_TOOLS.includes(toolName) ?          │
│    ├── Yes → ToolPermissionValidator.validate() │
│    │          └─ permission checker granted ?    │
│    │               ├─ true  → ✅ allow           │
│    │               └─ false → ❌ deny (/go required)│
│    │                                             │
│    └── No → BashValidator.validate(command)      │
│               ├─ rm -rf        → ❌ CRITICAL deny │
│               ├─ sudo, chmod.. → ⚠️ HIGH ask      │
│               └─ ls, git...    → ✅ allow          │
└───────────────────────────────────────────────┘
```

## 3. Severity levels

### CRITICAL — Immediately blocked

Irreversible destructive patterns (non-exhaustive):

| Pattern | Example | Regex |
| ------- | ------- | ----- |
| **rm -rf /** | `rm -rf /` | `rm .*-rf\s*/\s*$` |
| **rm -rf /etc** | `sudo rm -rf /etc` | `rm .*-rf\s*/etc` |
| **dd to /dev/** | `dd if=/dev/urandom of=/dev/sda` | `dd\s+.*of=\/dev\/` |
| **mkfs** | `mkfs.ext4 /dev/sda` | `mkfs\.\w+\s+\/dev\/` |
| **shred /dev/** | `shred /dev/nvme0` | `shred\s+.*\/dev\/` |
| **Fork bomb** | `:(){ :\|:& };:` | `fork\s+bomb\|:\(\)\s*\{` |
| **Pipe to shell** | `curl http://x.sh \| bash` | `(wget\|curl)\s+.*\|\s*(sh\|bash)` |
| **cat /etc/shadow** | `cat /etc/shadow` | `cat\s+\/etc\/(passwd\|shadow\|sudoers)` |
| **Netcat reverse** | `nc -l -e /bin/bash` | `nc\s+.*-l.*-e` |

### HIGH — Asks for confirmation

Potentially dangerous but sometimes legitimate commands:

| Command | Risk |
| ------- | ---- |
| `sudo ...` | Privilege escalation |
| `su ...` | User switching |
| `passwd` | Password modification |
| `chmod ...` | Permission changes |
| `chown ...` | Ownership changes |
| `kill ...` | Process termination |
| `systemctl ...` | System service management |
| `mount ...` | Filesystem mounting |
| `nmap ...` | Network scanning |
| `iptables ...` | Firewall modification |

**Exception:** `chmod +x` is always allowed (making a script executable).

### Core security rules

All three runtimes share the same rules defined in `~/.agents/agent-enforcers/command-validator/src/core/security-rules.ts`:

- **CRITICAL_COMMANDS**: `del`, `format`, `mkfs`, `shred`, `dd`, `fdisk`, `parted`, `gparted`, `cfdisk`
- **PRIVILEGE_COMMANDS**: `sudo`, `su`, `passwd`, `chpasswd`, `usermod`, `chmod`, `chown`, `chgrp`, `setuid`, `setgid`
- **NETWORK_COMMANDS**: `nc`, `netcat`, `nmap`, `telnet`, `ssh-keygen`, `iptables`, `ufw`, `firewall-cmd`, `ipfw`
- **SYSTEM_COMMANDS**: `systemctl`, `service`, `kill`, `killall`, `pkill`, `mount`, `umount`, `swapon`, `swapoff`
- **DANGEROUS_PATTERNS**: 50+ regex patterns covering destructive writes, pipes to shell, crypto miners, docker prunes, kernel module loading, cron injection, credential dumping, Prisma destructive resets, and more

The Pi extension does not add its own patterns — it imports the shared core validator directly.

## 4. Behavior by runtime

### Pi (Extension)

| Situation | Behavior |
| --------- | -------- |
| `rm -rf /` | ❌ Block: "Destructive command blocked" + violation list |
| `sudo apt update` | ⚠️ **UI Dialog**: `ctx.ui.confirm("Dangerous command", ...)` → if refused, block |
| `ls -la` | ✅ Passes |
| `chmod +x script.sh` | ✅ Passes (whitelisted) |
| Restricted tool (Write/Edit) without permission in the same Pi session | ❌ Block: "Permission denied" |

### Claude Code (Pre-tool-use hook)

| Situation | Behavior |
| --------- | -------- |
| CRITICAL | ❌ Deny (`permissionDecision: "deny"`) + message with command, reason, severity |
| HIGH | ⚠️ **Ask** (`permissionDecision: "ask"`) — Claude Code prompts the user to confirm or deny |
| allow | ✅ Passes |

**Note:** the Claude hook has no override token mechanism. HIGH commands must be approved interactively via the Claude Code prompt.

### Codex (Pre-tool-use hook)

| Situation | Behavior |
| --------- | -------- |
| CRITICAL | ❌ Deny — process exits immediately |
| HIGH (no token) | ❌ Deny + approval token generated — user sees `allow-command <token>` to approve |
| HIGH + approved token | ✅ Allow via `consumeOverride()` — token is consumed (one-shot), telemetry action is `override_approved` |
| allow | ✅ Passes |
| Restricted tool (Write/Edit) without `/go` | ❌ Deny: "Permission denied" |

**Implementation note:** for CRITICAL commands, the deny path calls `respondPreToolDeny()` which triggers `process.exit(0)`. The subsequent approval-token generation code is never reached, but the control flow is implicit (no explicit `return`). This is functionally correct but structurally brittle.

## 5. Logging

Each runtime logs validation events to its own path:

The Codex hook and Pi extension build telemetry details through the same runtime
contract helper. That helper owns command truncation, reason joining, severity
inclusion, approval metadata, and target detection for bash versus restricted
tools. The final approval mechanism is still runtime-specific: Pi can ask through
`ctx.ui.confirm`, while Codex uses a one-shot `allow-command <token>` retry flow.

| Runtime | Log path | Format |
| ------- | -------- | ------ |
| **Pi** (extension) | `~/neelopedia/stats/pi/command-validator/` | `rawCommand`, `action`, `parentModel`, `thinkingLevel`, `toolName`, `reason` |
| **Claude Code** (hook) | `~/neelopedia/stats/claude-code/command-validator/events.jsonl` | `timestamp`, `source`, `command`, `action`, `violations`, `severity` |
| **Codex** (hook) | `~/neelopedia/stats/codex/command-validator/` | `rawCommand`, `action`, `parentModel`, `thinkingLevel`, `toolName`, `reason`, `severity`, `override`, `userResponse` |

## 6. File tree

```
command-validator/
└── src/
    └── core/
        ├── types.ts                   ← ValidationResult, Severity, SecurityRules
        ├── validator.ts               ← CommandValidator — dispatches to bash or tool validator
        ├── bash-validator.ts          ← BashValidator — validates shell commands
        ├── tool-validator.ts          ← ToolPermissionValidator — blocks write tools without /go
        ├── tool-rules.ts              ← RESTRICTED_TOOLS list (write, edit, etc.)
        ├── security-rules.ts          ← CRITICAL/HIGH/DANGEROUS_PATTERNS rules
        └── __tests__/validator.test.ts
```

**Dependency:** `tool-validator.ts` imports `isPermissionGranted` from `~/.agents/agent-enforcers/permission-enforcer/src/core/state.ts`.

## 7. Agent mitigation (when blocked)

1. **CRITICAL (deny):** do not bypass. Reformulate with a more targeted approach
   - `rm -rf /` → `rm -rf ./dir` or `rm file1 file2`
   - `curl ... | bash` → download first, inspect, then execute
2. **HIGH (ask):**
   - **Pi:** a UI dialog appears — respond in the dialog
   - **Claude Code:** Claude Code prompts the user via `permissionDecision: "ask"` — the user confirms or denies inline
   - **Codex:** the error contains a token `allow-command <token>` — ask the user to approve. The user must type `allow-command <token>` to call `approveToken()`, then re-run the command so `consumeOverride()` finds the approved entry.
3. **Permission denied (/go missing):** if a write tool is blocked (`ToolPermissionValidator`), ask the user to type `/go` in their next message. This triggers the `/go` skill which loads `operational-rules/implementation.md` and unlocks implementation authorization.
4. **Never** use obfuscation (`rm -rf /` disguised as `rm -rf $ROOT` or via `eval`)
