<!-- markdownlint-disable MD013 -->
# Managing API Keys

## Where Keys Live

API keys live **only** in Doppler. Nothing else stores the actual secret value — not `agent-credentials.json`, not env vars, not shell profiles.

| What | Where |
| ---- | ----- |
| All API keys | Doppler, project `<agent_name>`, config `<config>` |

---

## How It Works

### 1. The Canonical Multi-Agent Credentials File

All authentication commands are centralized in `~/.agents/agent-credentials.json`. It contains raw Doppler CLI commands, without the `!` prefix, grouped first by provider and then by agent identity:

```json
{
  "<provider-slug>": {
    "<agent-id>": {
      "type": "api_key",
      "key": "doppler secrets get <PROVIDER>_API_KEY_<AGENT_NAME> -p <project> -c <config> --plain"
    },
    "<other-agent-id>": {
      "type": "api_key",
      "key": "doppler secrets get <PROVIDER>_API_KEY_<OTHER_AGENT_NAME> -p <other-project> -c <config> --plain"
    }
  }
}
```

Each entry stores only a retrieval command. The API key returned by that command remains in Doppler. Keep the local registry at permission mode `0600`.

### 2. Credential Resolution

Consumers select both a provider and an agent identity:

- Agent-aware tools read `.<provider>.<agent>.key` through their credential resolver.
- Pi selects its agent identity explicitly in the `jq` bridge stored in `~/.pi/agent/auth.json`.
- Multiple tools can therefore use different Doppler secrets for the same provider.

Some existing consumers support this legacy flat shape for backward compatibility:

```json
{
  "<provider-slug>": {
    "type": "api_key",
    "key": "doppler secrets get <PROVIDER>_API_KEY_<AGENT_NAME> -p <project> -c <config> --plain"
  }
}
```

Do not use the flat shape for new registries because it cannot represent multiple agent identities for one provider.

---

## Naming Convention

Doppler secret names use this format:

```text
<PROVIDER>_API_KEY_<AGENT_NAME>
```

All components are uppercase. Kebab-case agent identifiers become uppercase snake case in secret names.

Examples:

```text
DEEPSEEK_API_KEY_REVIEW_AGENT
ANTHROPIC_API_KEY_REVIEW_AGENT
OPENAI_API_KEY_RELEASE_AGENT
```

### Placeholders Reference

| Placeholder | Meaning | Example |
| ----------- | ------- | ------- |
| `<provider-slug>` | Lowercase provider identifier | `deepseek` |
| `<agent-id>` | Lowercase consumer lookup identifier | `review-agent` |
| `<PROVIDER>` | Uppercase provider name | `DEEPSEEK` |
| `<AGENT_NAME>` | Uppercase snake-case secret suffix | `REVIEW_AGENT` |
| `<project>` | Exact Doppler project | `review-agent` |
| `<config>` | Exact Doppler configuration | `development` |

---

## Relevant Files

| File | Purpose | Versioned |
| ---- | ------- | --------- |
| `~/.agents/agent-credentials.json` | Local registry of auth commands | ❌ local gateway file |
| `~/.agents/agent-credentials.json.template` | Template for `agent-credentials.json` | ✅ committed |
