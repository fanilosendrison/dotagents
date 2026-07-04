---
name: document-agent-enforcement
description: Document an agent-enforcer script (security rule, validator, linter). Use when the user asks to document an enforcer, add enforcement docs, or explain a security rule.
---

# Document an Agent Enforcer

Read `~/.agent/AGENTS.md`.
You are documenting a strict security rule or guardrail script located in the `~/.agents/agent-enforcers/` directory.

## STEP 1. Read the Source Code

First, read the target enforcer's source code. You must understand:
- **Wiring** — how does it connect to each runtime?
  - Pi extension (`~/.pi/agent/extensions/<name>.ts`) — `pi.on("tool_call")` or `pi.on("tool_result")`
  - Pre-tool-use hook (`src/bin/pre-tool-use.ts`) — reads stdin JSON
  - Post-tool-use hook (`src/bin/post-tool-use.ts`) — injects context after execution
  - Antigravity wrapper (`~/.gravity/wrappers/<name>/hook.ts`) — git hook entrypoint
- **Trigger** — what exact event fires it (bash command, git commit, tool_write, etc.)?
- **Decision logic** — what patterns/regex/heuristics determine allow vs block?
- **Behavior per runtime** — does it differ between Pi, Claude, Codex, Antigravity?

## STEP 2. Draft the Documentation and fill the JSON

Draft the full markdown content for this enforcer using the template below.

### Template

~~~markdown
# [Enforcer Name]

[One sentence explaining what this enforcer ensures or prevents.]

## 1. Wiring — [N] interception point(s)

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_call")` | Pi | `~/.pi/agent/extensions/<name>.ts` |
| 2 | **Pre-tool-use hook** · reads stdin JSON | Claude + Codex | `~/.agents/agent-enforcers/<name>/src/bin/pre-tool-use.ts` |
| 3 | **Post-tool-use hook** · injects context | Codex only | `~/.agents/agent-enforcers/<name>/src/bin/post-tool-use.ts` |
| 4 | **Antigravity wrapper** · git hook | Git (any repo) | `~/.gravity/wrappers/<name>/hook.ts` |

All share the **same core logic** : `<shared-file>`. Only include rows that exist (omit rows 3 or 4 if absent).

## 2. Trigger flow

```
[ASCII flow diagram showing when the enforcer fires]
```

## 3. How it works

[Detailed explanation of the detection logic, patterns, regex, etc.]

## 4. File tree

```
<name>/
├── src/
│   ├── core/
│   │   └── ...
│   └── bin/
│       └── ...
```

## 5. Behavior by runtime

### Pi (Extension)

| Situation | Behavior |
|-----------|----------|
| ... | ✅ ... |
| ... | ❌ ... |

### Claude (Pre-tool-use hook)

| Situation | Behavior |
|-----------|----------|
| ... | ✅ ... |
| ... | ❌ ... |

### Codex (Pre + Post tool-use)

| Situation | Behavior |
|-----------|----------|
| ... | ✅ ... |
| ... | ❌ ... |

### Antigravity — Git `<hook-name>` hook

**Trigger :** Description of the git hook trigger.

**Entrypoint :** `~/.gravity/wrappers/<name>/hook.ts`

**Flow :**

```
[ASCII flow for the Gravity wrapper]
```

| Situation | Behavior |
|-----------|----------|
| ... | ✅ ... |
| ... | ❌ ... |

**Telemetry :** Logs to `~/.gravity/logs/events.jsonl` with status details.

## 6. Agent mitigation (when blocked)

1. **Do not bypass** — ...
2. **Understand the rule** — ...
3. **Change approach** — ...
~~~

---

**Then, output this JSON block.** Put the full drafted text in the `content` field.

```json
{
  "topic": "enforcer-name",
  "title": "Enforcer Name",
  "description": "Short description",
  "action": "Short imperative",
  "date": "YYYY-MM-DD",
  "wiring": "Pi ext + pre-hook + ...",
  "trigger": "What fires it",
  "content": "# Enforcer Name\n\nFull markdown content..."
}
```

| Field | Source |
|-------|--------|
| `topic` | Enforcer name in kebab-case (e.g. `command-validator`) |
| `title` | The title, without `# ` |
| `description` | Short summary — 6 words max |
| `action` | Short imperative action (e.g. "Validate bash commands") |
| `date` | Today's date in `YYYY-MM-DD` |
| `wiring` | Comma-separated mechanisms (e.g. "Pi ext + pre-hook + post-hook + Antigravity") |
| `trigger` | What event triggers the enforcer (e.g. "git commit → staged diff scan") |
| `content` | The full `.md` text drafted above |

---

## STEP 3. Run the bootstrap script (mechanical)

Pipe the JSON from STEP 2 into the script bundled with this skill:

```bash
echo '<json>' | ./scripts/bootstrap-enforcer-docs
```

It writes `<topic>.md` in `~/.agents/docs/`, and updates the docs index all in one shot. **Zero LLM calls after STEP 2.**
