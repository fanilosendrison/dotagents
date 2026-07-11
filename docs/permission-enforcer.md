# Permission Enforcer

Manages turn-scoped permission for code-modifying tools through the `/go`
authorization marker.

The enforcer is split into two responsibilities:

- `permission-enforcer` owns the prompt lifecycle and writes the shared state.
- `command-validator` consumes that shared state when restricted tools are used.

## 1. Wiring - 3 interception points

| Number | Mechanism | Runtime | File |
| ------ | --------- | ------- | ---- |
| 1 | Pi extension, `before_agent_start` | Pi | `~/.pi/agent/extensions/permission-enforcer.ts` |
| 2 | Codex hook, `UserPromptSubmit` | Codex | `~/.codex/hooks/user-prompt-submit.ts` |
| 3 | Direct import, legacy or scoped permission check | Shared command validator core | `~/.agents/agent-enforcers/command-validator/src/core/tool-validator.ts` |

The shared state logic lives in
`~/.agents/agent-enforcers/permission-enforcer/src/core/state.ts`.

## 2. Trigger flow

```text
User prompt
    |
    v
Pi before_agent_start or Codex UserPromptSubmit
    |
    v
updatePermissionState(prompt)
or updatePermissionStateForScope(prompt, scope)
    |
    v
~/.agents/agent-enforcers/permission-enforcer/.state/config.json
    |
    v
CommandValidator -> ToolPermissionValidator -> permission checker
    |
    +-- true  -> allow restricted tool
    |
    +-- false -> deny restricted tool with the /go authorization message
```

## 3. How it works

`updatePermissionState(promptText)` and
`updatePermissionStateForScope(promptText, scope)` detect two authorization
forms:

- Literal slash marker as a standalone token: `/go`
- Expanded skill marker: `<skill name="go">`

If either marker is present, permission is set to `true`. Otherwise permission
is set to `false`. The functions return the boolean they wrote so runtime
integrations can log the exact state transition without duplicating detection
logic.

Legacy runtime adapters can still use the top-level state:

```json
{ "allowed": true }
```

Runtimes that can provide a stable session id should use scoped state instead:

```json
{
  "scopes": {
    "pi:<session-id>": {
      "allowed": true,
      "matchSource": "slash",
      "updatedAt": "<iso-timestamp>"
    },
    "codex:<session-id>": {
      "allowed": true,
      "matchSource": "slash",
      "updatedAt": "<iso-timestamp>"
    }
  }
}
```

`detectPermissionGrantSource(promptText)` returns one of these values:

- `slash`
- `skill-tag`
- `none`

`isPermissionGranted()` reads the legacy state. `isPermissionGrantedForScope()`
reads only the requested scope, with a migration fallback for old state files
that contain no scoped entries yet. Missing, invalid, or false state is treated
as denied.

The `/go` marker has two coupled effects:

- The prompt lifecycle adapter records shared permission state for modifying
  tools.
- The `/go` skill loads `operational-rules/implementation.md`, which tells the
  agent how to proceed once implementation is authorized.

Agents must never self-trigger `/go`; the marker must appear in the user's
message as `/go` or as the expanded skill tag.

## 4. File tree

```text
permission-enforcer/
└── src/
    └── core/
        ├── state.ts
        └── __tests__/
            └── state.test.ts
```

Runtime wiring:

```text
~/.pi/agent/extensions/permission-enforcer.ts
~/.codex/hooks/user-prompt-submit.ts
```

## 5. Behavior by runtime

### Pi

Pi runs `~/.pi/agent/extensions/permission-enforcer.ts` on
`before_agent_start`. The extension scopes state by the real Pi session id from
`ctx.sessionManager.getSessionId()`, using keys like `pi:<session-id>`.

| Situation | Behavior |
| --------- | -------- |
| Prompt contains `/go` | The current Pi session scope is set to `allowed: true`; restricted tools are allowed for that session. |
| Prompt contains `<skill name="go">` | The current Pi session scope is set to `allowed: true`; restricted tools are allowed for that session. |
| Prompt has no authorization marker | The current Pi session scope is set to `allowed: false`; restricted tools are denied for that session. |
| Restricted tool is called | `command-validator` reads `isPermissionGrantedForScope({ agent: "pi", sessionId })` and allows or denies. |

Telemetry is written to
`~/neelopedia/stats/pi/permission-enforcer/events.jsonl` with event type
`permission_state_change`.

The event intentionally records `promptLength`, `matchSource`, and
`permissionScope`, not prompt content.

### Codex

Codex runs `~/.codex/hooks/user-prompt-submit.ts` for each prompt. The hook
calls `updatePermissionStateForScope(promptText, { agent: "codex", sessionId })`
before handling any `allow-command <token>` command-validator override.
`~/.codex/hooks/command-validator.ts` checks the same session scope before
allowing restricted tools.

This prevents two open Codex sessions from clobbering each other's `/go`
authorization. A prompt without `/go` in session B revokes session B only; it no
longer overwrites session A's authorization.

Codex does not write a separate permission-enforcer telemetry event today; the
enforcement result is visible when `command-validator` allows or denies
restricted tools.

Codex currently wires this through `UserPromptSubmit` only. There is no Codex
`PostToolUse` linter hook in the active hook configuration.

### Claude Code and Antigravity

No current prompt-lifecycle adapter was found for Claude Code or Antigravity.
They can only consume the shared permission state if their runtime wiring calls
`command-validator`.

## 6. Agent mitigation when blocked

1. Do not bypass the restriction with another write path.
2. Ask the user to authorize implementation with `/go` in the blocked session.
3. Retry the modifying tool only after the next prompt updates permission state.
