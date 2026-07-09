# Permission Enforcer

Manages turn-scoped permission for code-modifying tools through the `/go`
authorization marker.

The enforcer is split into two responsibilities:

- `permission-enforcer` owns the prompt lifecycle and writes the shared state.
- `command-validator` consumes that shared state when restricted tools are used.

## 1. Wiring - 2 interception points

| Number | Mechanism | Runtime | File |
|------|---------|-------|----|
| 1 | Pi extension, `before_agent_start` | Pi | `~/.pi/agent/extensions/permission-enforcer.ts` |
| 2 | Direct import, `isPermissionGranted()` | Shared command validator core | `~/.agents/agent-enforcers/command-validator/src/core/tool-validator.ts` |

The shared state logic lives in
`~/.agents/agent-enforcers/permission-enforcer/src/core/state.ts`.

## 2. Trigger flow

```text
User prompt
    |
    v
Pi permission-enforcer extension
    |
    v
updatePermissionState(prompt)
    |
    v
~/.agents/agent-enforcers/permission-enforcer/.state/config.json
    |
    v
CommandValidator -> ToolPermissionValidator -> isPermissionGranted()
    |
    +-- true  -> allow restricted tool
    |
    +-- false -> deny restricted tool with the /go authorization message
```

## 3. How it works

`updatePermissionState(promptText)` detects two authorization forms:

- Literal slash command: `/go`
- Expanded skill marker: `<skill name="go">`

If either marker is present, it writes `{"allowed": true}`. Otherwise it writes
`{"allowed": false}`. The function returns the boolean it wrote so runtime
integrations can log the exact state transition without duplicating detection
logic.

`detectPermissionGrantSource(promptText)` returns one of these values:

- `slash`
- `skill-tag`
- `none`

`isPermissionGranted()` reads the same state file. Missing, invalid, or false
state is treated as denied.

## 4. File tree

```text
permission-enforcer/
└── src/
    └── core/
        ├── state.ts
        └── __tests__/
            └── state.test.ts
```

Pi runtime wiring:

```text
~/.pi/agent/extensions/
├── permission-enforcer.ts
└── __tests__/
    ├── permission-enforcer.test.ts
    ├── permission-enforcer.integration.test.ts
    ├── permission-enforcer.contract.test.ts
    └── permission-enforcer.e2e.test.ts
```

## 5. Behavior by runtime

### Pi

| Situation | Behavior |
|---------|--------|
| Prompt contains `/go` | State is set to `allowed: true`; restricted tools are allowed for that turn. |
| Prompt contains `<skill name="go">` | State is set to `allowed: true`; restricted tools are allowed for that turn. |
| Prompt has no authorization marker | State is set to `allowed: false`; restricted tools are denied. |
| Restricted tool is called | `command-validator` reads `isPermissionGranted()` and allows or denies. |

Telemetry is written to
`~/neelopedia/stats/pi/permission-enforcer/events.jsonl` with event type
`permission_state_change`.

The event intentionally records `promptLength` and `matchSource`, not prompt
content.

### Codex, Claude Code, and Antigravity

This change does not add or modify runtime hooks for Codex, Claude Code, or
Antigravity. They can still consume the shared permission state through
`command-validator` when their runtime wiring calls it, but this implementation
only adds Pi-side prompt lifecycle wiring.

## 6. Agent mitigation when blocked

1. Do not bypass the restriction with another write path.
2. Ask the user to authorize implementation with `/go`.
3. Retry the modifying tool only after the next prompt updates permission state.
