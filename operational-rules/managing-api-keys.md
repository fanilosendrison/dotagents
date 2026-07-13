<!-- markdownlint-disable MD013 -->
# Managing API Keys

## Where Keys Live

API keys live **only** in Doppler. Nothing else stores the actual secret value — not `agent-credentials.json`, not env vars, not shell profiles.

| What | Where |
| ---- | ----- |
| All API keys | Doppler, project `<agent_name>`, config `<config>` |

---

## How It Works

### 1. The Agnostic Credentials File

All authentication commands are centralized in `~/.agents/agent-credentials.json`. It contains raw Doppler CLI commands (without the `!` prefix) to fetch the keys:

```json
{
  "<provider-slug>": {
    "type": "api_key",
    "key": "doppler secrets get <PROVIDER>_API_KEY_<AGENT_NAME> -p <agent-name> -c <config> --plain"
  }
}
```

---

## Naming Convention

```text
<PROVIDER>_API_KEY_<AGENT_NAME>
```

All uppercase. Components:

- **`<PROVIDER>`** : provider name (e.g. `DEEPSEEK`, `ANTHROPIC`, `OPENAI`)
- **`_API_KEY_`** : fixed separator
- **`<AGENT_NAME>`** : name of the agent that uses the key (e.g. `JANET`, `MARCUS`)

Examples:

```text
DEEPSEEK_API_KEY_JANET    ← agent Janet
ANTHROPIC_API_KEY_JANET   ← agent Janet
OPENAI_API_KEY_MARCUS     ← agent Marcus
```

### Placeholders Reference

| Placeholder | Meaning | Example |
| ----------- | ------- | ------- |
| `<provider-slug>` | Lowercase provider ID | `deepseek`, `anthropic` |
| `<PROVIDER>` | Uppercase provider name | `DEEPSEEK`, `ANTHROPIC` |
| `<AGENT_NAME>` | Uppercase agent name | `JANET` |
| `<agent-name>` | Lowercase agent name (matches Doppler project) | `janet` |
| `<config>` | Doppler config | `dev_personal` |

---

## Relevant Files

| File | Purpose | Versioned |
| ---- | ------- | --------- |
| `~/.agents/agent-credentials.json` | Agnostic registry of auth commands | ❌ gitignored |
| `~/.agents/agent-credentials.json.template` | Template for `agent-credentials.json` | ✅ committed |
