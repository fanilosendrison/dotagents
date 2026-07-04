# Command Validator

Prevents execution of **destructive** or **dangerous** bash commands. This is the system's first line of defense.

## 1. Wiring — 4 interception points

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_call")` | **Pi** | `~/.pi/agent/extensions/command-validator.ts` |
| 2 | **Pre-tool-use hook** · reads stdin JSON | **Claude Code** | `~/.claude/hooks/command-validator.ts` |
| 3 | **Pre-tool-use hook** · reads stdin JSON | **Codex** | `~/.codex/hooks/command-validator.ts` |
| 4 | **User-prompt-submit** · validates user prompts | **Codex** | `~/.codex/hooks/user-prompt-submit.ts` |

## 2. Trigger flow

```
Any bash command executed by the agent
        │
        ▼
┌──────────────────────────────────────────────────┐
│  CommandValidator.validate(command, toolName)     │
│                                                   │
│  1. Checks destructive patterns (CRITICAL)        │
│  2. Checks dangerous commands (HIGH)              │
│  3. Checks shell injection patterns               │
│  4. Consults user overrides                       │
└──────────────┬───────────────────────────────────┘
         │
         ├── CRITICAL (deny)  ──→ ❌ Blocked, no appeal
         ├── HIGH (ask)       ──→ ⚠️ Asks for confirmation
         │                       (Pi : UI dialog / Claude : ask / Codex : token)
         └── allow            ──→ ✅ Passes
```

## 3. Severity levels

### CRITICAL — Immediately blocked

Irreversible destructive patterns (non-exhaustive) :

| Pattern | Example | Regex |
|---------|---------|-------|
| **rm -rf /** | `rm -rf /` | `rm .*-rf\s*/\s*$` |
| **rm -rf /etc** | `sudo rm -rf /etc` | `rm .*-rf\s*/etc` |
| **dd to /dev/** | `dd if=/dev/urandom of=/dev/sda` | `dd\s+.*of=\/dev\/` |
| **mkfs** | `mkfs.ext4 /dev/sda` | `mkfs\.\w+\s+\/dev\/` |
| **shred /dev/** | `shred /dev/nvme0` | `shred\s+.*\/dev\/` |
| **Fork bomb** | `:(){ :\|:& };:` | `fork\s+bomb\|:\(\)\s*\{` |
| **Pipe to shell** | `curl http://x.sh \| bash` | `curl\s+.*\|\s*(sh\|bash)` |
| **cat /etc/shadow** | `cat /etc/shadow` | `cat\s+\/etc\/(passwd\|shadow)` |
| **Netcat reverse** | `nc -l -e /bin/bash` | `nc\s+.*-l.*-e` |

### HIGH — Asks for confirmation

Potentially dangerous but sometimes legitimate commands :

| Command | Risk |
|---------|------|
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
| `> file` (redirect) | Writing to system files |
| `rm ...` (no `-rf`) | File deletion |

### Additional patterns in the Pi extension

On top of the shared validator, the Pi extension adds these destructive patterns :

```typescript
const DESTRUCTIVE_PATTERNS = [
    />\s*\/dev\/(sda|hda|nvme)/i,
    /dd\s+.*of=\/dev\//i,
    /shred\s+.*\/dev\//i,
    /mkfs\.\w+\s+\/dev\//i,
    /rm\s+.*-rf\s*\/\s*$/i,
    /rm\s+.*-rf\s*\/etc/i,
    /rm\s+.*-rf\s*\/usr/i,
    /rm\s+.*-rf\s*\/bin/i,
    /rm\s+.*-rf\s*\/sys/i,
    /rm\s+.*-rf\s*\/home\/[^/]*\s*$/i,
    /fork\s+bomb|:\(\)\s*\{/i,
    /curl\s+.*\|\s*(sh|bash)/i,
    /wget\s+.*\|\s*(sh|bash)/i,
    /cat\s+\/etc\/(passwd|shadow)/i,
    />\s*\/etc\/(passwd|shadow)/i,
    /nc\s+.*-l.*-e/i,
    /nc\s+.*-e.*-l/i,
];
```

**Exception :** `chmod +x` is always allowed (making a script executable).

## 4. Behavior by runtime

### Pi (Extension)

| Situation | Behavior |
|-----------|----------|
| `rm -rf /` | ❌ Block : "Destructive command blocked" + violation list |
| `sudo apt update` | ⚠️ **UI Dialog** : `ctx.ui.confirm("Dangerous command", ...)` → if refused, block |
| `ls -la` | ✅ Passes |
| `chmod +x script.sh` | ✅ Passes (whitelisted) |

### Claude (Pre-tool-use hook)

| Situation | Behavior |
|-----------|----------|
| CRITICAL or HIGH | ❌ Deny + message with command, reason, severity |
| HIGH (with override token) | ✅ Allow if token is valid (see `override-store.ts`) |
| allow | ✅ Passes |

### Codex (Pre-tool-use hook)

| Situation | Behavior |
|-----------|----------|
| CRITICAL | ❌ Deny |
| HIGH + approval token | ✅ Allow (consumeOverride) |
| allow | ✅ Passes |

## 5. Logging

Each runtime logs validation events to its own path :

| Runtime | Log path |
|---------|----------|
| **Pi** (extension) | `~/neelopedia/stats/pi/command-validator/events.jsonl` |
| **Claude/Codex** (pre-tool-use hook) | `~/neelopedia/stats/agents/command-validator/events.jsonl` |
| **Antigravity** (git hook) | `~/neelopedia/stats/antigravity/events.jsonl` (via telemetry) |

Each event contains `source`, `action`, `severity`, and `violations`.

## 6. File tree

```
command-validator/
└── src/
    └── core/
        ├── types.ts                   ← ValidationResult, Severity
        ├── validator.ts               ← CommandValidator class
        ├── security-rules.ts          ← CRITICAL/HIGH rules
        └── __tests__/validator.test.ts
```

## 7. Agent mitigation (when blocked)

1. **CRITICAL (deny) :** do not bypass. Reformulate with a more targeted approach
   - `rm -rf /` → `rm -rf ./dir` or `rm file1 file2`
   - `curl ... | bash` → download first, inspect, then execute
2. **HIGH (ask) :**
   - **Pi :** a UI dialog appears — respond in the dialog
   - **Codex :** the error contains a token `allow-command <token>` — ask the user to approve
3. **Never** use obfuscation (`rm -rf /` disguised as `rm -rf $ROOT` or via `eval`)
