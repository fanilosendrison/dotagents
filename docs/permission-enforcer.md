# Permission Enforcer

Prevents the agent from using file-modifying tools without explicit authorization via the `/go` command in the current turn.

## 1. Wiring — 4 interception points

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_call")` & `pi.on("user_prompt")` | Pi | `~/.pi/agent/extensions/permission-enforcer.ts` |
| 2 | **Claude Code hook** · `pre-tool-use` & `user-prompt-submit` | Claude Code | `~/.claude/hooks/permission-enforcer.ts` |
| 3 | **Codex hook** · `pre-tool-use` & `user-prompt-submit` | Codex | `~/.codex/hooks/permission-enforcer.ts` |
| 4 | **Antigravity wrapper** | Antigravity | `~/.gravity/wrappers/permission-enforcer/pre-tool.ts` |

All share the **same core logic** : `~/.agents/agent-enforcers/permission-enforcer/src/core/checker.ts` and `state.ts`.

## 2. Trigger flow

```
User submits prompt
        │
        ▼
┌──────────────────────────────────────┐
│  Phase 1: Débloqueur                 │
│  (user-prompt-submit)                │
│                                      │
│  Contains Regex: /(^|\s)\/go(\s|$)/? │
└──────────────┬───────────────────────┘
         No    │   Yes
         ▼     ▼
  State=false  State=true
               │
               ▼
Agent calls a tool
               │
               ▼
┌──────────────────────────────────────┐
│  Phase 2: Bloqueur                   │
│  (pre-tool-use)                      │
│                                      │
│  Is modifying tool?                  │
└──────────────┬───────────────────────┘
         No    │   Yes
         ▼     ▼
      Passes ┌──────────────────────────────────┐
             │  Is State == true?               │
             └──────────────┬───────────────────┘
                    No      │   Yes
                    ▼       ▼
              ❌ Block/Deny ✅ Allow/Pass
```

## 3. How it works

The enforcer is stateless across turns but maintains a hidden boolean state file `~/.agents/agent-enforcers/permission-enforcer/.state/config.json`.
1. **State Update:** Every user prompt intercepts the message. If `/go` is found, the state file becomes `{"allowed": true}`. Otherwise, `{"allowed": false}`.
2. **Tool Blocking:** Modifying tools (`write_to_file`, `Edit`, `write`, `apply_patch`, etc.) are blocked if the state is `false`. Read-only tools or bash execution (`run_command`) are allowed.
3. **Skill Injection:** The `/go` skill provides a semantic bridge, instructing the agent to load `operational-rules/implementation.md` when authorized.

## 4. File tree

```
permission-enforcer/
└── src/
    └── core/
        ├── checker.ts                 ← shouldBlockTool(toolName)
        ├── state.ts                   ← updatePermissionState(promptText) & isPermissionGranted()
        └── __tests__/
```

## 5. Behavior by runtime

### Pi (Extension)

| Situation | Behavior |
|-----------|----------|
| User says "fix this /go", agent calls `write_to_file` | ✅ Passes |
| User says "fix this", agent calls `write_to_file` | ❌ Block : `isError: true` + message |
| Agent calls `run_command` (bash) | ✅ Passes |

### Claude Code (hook)

| Situation | Behavior |
|-----------|----------|
| User says "/go", agent calls `Edit` | ✅ Passes (exitAllow) |
| User says "hello", agent calls `Replace` | ❌ `postToolBlock` / deny + message |

### Codex (hook)

| Situation | Behavior |
|-----------|----------|
| User says "/go", agent calls `multi_replace_file_content` | ✅ Passes (exitAllow) |
| User says "why?", agent calls `write_to_file` | ❌ deny + message |

### Antigravity

**Trigger :** Wrappers around the Antigravity TUI or execution framework.

**Entrypoint :** `~/.gravity/wrappers/permission-enforcer/user-prompt.ts` & `pre-tool.ts`

**Flow :**

```
Intercept user prompt -> Call Core state.ts
Intercept tool call -> Call Core checker.ts
```

| Situation | Behavior |
|-----------|----------|
| Modifying tool with state=false | ❌ Block |
| Read tool or state=true | ✅ Pass |

## 6. Agent mitigation (when blocked)

1. **Do not bypass** — Stop your tool execution.
2. **Understand the rule** — You cannot write or modify files without explicit authorization.
3. **Change approach** — Ask the user to type `/go` to give you implementation clearance for the next message.
