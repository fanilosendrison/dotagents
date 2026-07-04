# Secret Scanner

Prevents committing secrets (API keys, tokens, passwords) by scanning the **staged diff** before every `git commit`.

## 1. Wiring — 5 interception points

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_call")` | **Pi** | `~/.pi/agent/extensions/secret-scanner.ts` |
| 2 | **Pre-tool-use hook** · reads stdin JSON | **Claude Code** | `~/.claude/hooks/secret-scanner.ts` |
| 3 | **Pre-tool-use hook** · reads stdin JSON | **Codex** | `~/.codex/hooks/secret-scanner.ts` |
| 4 | **Post-tool-use hook** · injects context | **Codex only** | `~/.codex/hooks/secret-scanner-post.ts` |
| 5 | **Antigravity wrapper** · git `pre-commit` hook | **Git (any repo)** | `~/.gravity/wrappers/secret-scanner/hook.ts` |

All share the **same scan engine** : `scanner.ts`.

## 2. Trigger flow

```
Agent runs a bash command
        │
        ▼
┌──────────────────────────────────────┐
│  Does the command contain            │
│  "git commit" ?                      │  ← /\bgit\s+commit\b/
└──────────────┬───────────────────────┘
         No    │   Yes
         ▼     ▼
      Passes ┌────────────────────────────────────────┐
             │  Runs : git diff --cached               │
             │  (either via execSync or Bun.spawn)     │
             └──────────────┬─────────────────────────┘
                            ▼
             ┌────────────────────────────────────────┐
             │  scanDiff(diff)                        │
             │  Iterates over + lines in the diff     │
             │  Applies secret patterns               │
             └──────────────┬─────────────────────────┘
                     Clean  │  Secrets found
                     ▼      ▼
              ✅ Allow    ❌ Block / Deny
```

## 3. How it works

### Scan engine (`src/core/scanner.ts`)

```typescript
export function scanDiff(diff: string): ScanResult
```

- **Only inspects added lines** (those starting with `+`)
- Ignores `+++` lines (file headers)
- Ignores **false positives** : `process.env.*`, `${VAR}`, `os.environ[`, `getenv()`, etc.
- Applies a set of **regex patterns** (see patterns section)
- Some patterns have a **confirmer** that checks the value is not a placeholder (`changeme`, `password`, `xxx`...)

### Detected patterns

| Pattern | Regex | Confirmer |
|---------|-------|-----------|
| AWS Access Key | `AKIA[0-9A-Z]{16}` | no |
| AWS Secret Key | `aws_secret_access_key\s*=\s*\S{20,}` | no |
| Private Key | `-----BEGIN (RSA\|EC\|DSA )?PRIVATE KEY-----` | no |
| GitHub Token | `gh[pousr]_[A-Za-z0-9_]{36,}` | no |
| Slack Token | `xox[baprs]-[0-9]{10,}-[a-zA-Z0-9-]+` | no |
| Connection String | `(mongodb\|postgres\|...)//user:pass@host` | no |
| Generic API Key | `api[_-]?key\s*[:=]\s*['"]?\S{20,}` | no |
| Generic Token | `(auth_token\|access_token\|...)` | no |
| Env Secret | `(OPENAI_API_KEY\|STRIPE_SECRET\|...)\s*=\s*\S{16,}` | no |
| Password/Secret | `(password\|pwd\|DB_PASSWORD)\s*=` | yes (length ≥ 8, not a placeholder) |

### False positives ignored

```regex
/process\.env[\.\[]\w+/         // process.env.API_KEY
/os\.environ[/                   // os.environ["KEY"]
/\$\{?\w+\}?/                   // $VAR or ${VAR}
/getenv\(/                       // getenv("KEY")
/requireEnv\(/                   // requireEnv("KEY")
/getApiKey\(/                    // getApiKey("KEY")
```

## 4. File tree

```
secret-scanner/
└── src/
    └── core/
        ├── types.ts                   ← Finding, ScanResult interfaces
        ├── scanner.ts                 ← scanDiff() — the engine
        └── __tests__/scanner.test.ts
```

## 5. Behavior by runtime

### Pi (Extension `tool_call`)

| Situation | Behavior |
|-----------|----------|
| `git commit -m "fix: ..."` with no secrets | ✅ Passes — clean scan |
| `git commit` with a hardcoded credential in staged diff | ❌ **Block** — `{ block: true, reason: "Secret(s) detected..." }` |
| File with `process.env.API_KEY` | ✅ Passes — false positive |
| `git push` (no commit) | ✅ Passes — no `git commit` → no scan |

### Claude (Pre-tool-use hook)

| Situation | Behavior |
|-----------|----------|
| Clean scan | ✅ `permissionDecision: "allow"` + additional context |
| Secret detected | ❌ `permissionDecision: "deny"` + list of findings |

### Codex (Pre + Post tool-use)

| Phase | Behavior |
|-------|----------|
| **Pre-tool-use** | Scans the diff. If clean → records in `scan-state.json` |
| **Post-tool-use** | Checks `scan-state.json`. If clean → injects context `✅ no secrets detected` |

### Antigravity — Git `pre-commit` hook

**Trigger :** `git commit` in any repo with the hook installed. Runs via `~/.gravity/git-hooks/pre-commit`.

**Entrypoint :** `~/.gravity/wrappers/secret-scanner/hook.ts`

**Flow :**

```
git commit
        │
        ▼
┌──────────────────────────────────────┐
│  pre-commit hook                     │
│  1. runs secret-scanner wrapper      │
│  2. runs push-enforcer wrapper       │
│  3. if either fails → exit 1         │
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  Wrapper: execSync("git diff --cached")
│  → scanDiff(diff)                    │
│  → logs telemetry                    │
│  → prints [ENFORCER_API_RESPONSE]    │
└──────────────┬───────────────────────┘
      Clean    │  Secrets found
      exit 0   ▼  exit 1 → commit aborted
```

| Situation | Behavior |
|-----------|----------|
| Clean staged diff | ✅ exit 0 — commit proceeds |
| Secret detected | ❌ exit 1 + `[ENFORCER_API_RESPONSE]` JSON — commit aborted |
| Empty diff | ✅ exit 0 — skipped |
| Scanner error | ❌ exit 1 — fail-closed |

**Telemetry :** Logs to `~/.gravity/logs/events.jsonl` with status (`passed`, `blocked`, `skipped`, `error`).

## 6. Interaction with the `/git-commits-push` skill

The skill **directly imports** the same `scanner.ts` in its validation phase :

```typescript
// turnlock-orchestrator.ts → pre-commit-validators.ts
const scannerPath = path.resolve(
    __dirname,
    "../../../../agent-enforcers/secret-scanner/src/core/scanner.ts"
);
const module = await import(scannerPath);
const result = module.scanDiff(diff);
```

If a secret is detected **during the skill**, the repo is marked `FAILED` in the Turnlock report. This is not an enforcer block but a pipeline validation error.

## 7. Agent mitigation (when blocked)

1. **Do not bypass** — do not use `--no-verify` or obfuscation
2. **Read the error** — it tells you the pattern and the exact line
3. **Unstage** the offending file : `git reset HEAD <file>`
4. **Replace** the hardcoded value with an environment variable (`process.env.SECRET`)
5. **Re-stage** and commit again
