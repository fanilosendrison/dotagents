# Git Commits Push Enforcer

Prevents commits without a **Conventional Commits** message or a **chained push**.

## 1. Wiring — 3 interception points

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_call")` | **Pi** | `~/.pi/agent/extensions/git-commits-push-enforcer.ts` |
| 2 | **Pre-tool-use hook** · reads stdin JSON | **Claude + Codex** | `~/.claude/hooks/git-commits-push-enforcer.ts` (Claude) / `~/.codex/hooks/git-commits-push-enforcer.ts` (Codex) |
| 3 | **Antigravity wrapper** · git `pre-commit` hook + Zsh trap (`_RAW_GIT_CMD`) | **Git (any repo)** | `~/.gravity/wrappers/git-commits-push-enforcer/hook.ts` |

All share the **same validator** : `validator.ts`.

## 2. Trigger flow

```
Agent runs a bash command
        │
        ▼
┌──────────────────────────────────────┐
│  Contains "git commit" ?             │
└──────────────┬───────────────────────┘
         No    │   Yes
         ▼     ▼
      Passes ┌────────────────────────────────────────┐
             │  Is there an inline message (-m "...")? │
             └──────────────┬─────────────────────────┘
           No (editor)      │   Yes
           (no -m)          ▼
           ▼       ┌──────────────────────────────────┐
        Passes     │  extractMessage(command)          │
                   │  → extracts message from -m       │
                   │    or a heredoc <<'EOF'           │
                   └──────────────┬───────────────────┘
                                 ▼
                   ┌──────────────────────────────────┐
                   │  isValidCC(message) ?             │
                   │  Regex : ^[a-z]+(\([^)]+\))?!?:\s\S
                   └──────────────┬───────────────────┘
                   Invalid        │   Valid
                   ▼              ▼
             ❌ Block/Deny    ┌──────────────────────────────┐
                             │  hasPush(command) ?           │
                             │  Regex : /git\s+push/        │
                             └──────────────┬───────────────┘
                            No              │   Yes
                            ▼               ▼
                      ❌ Block/Deny     ✅ Allow/Pass
```

## 3. Validation rules

### Conventional Commits format (`isValidCC`)

```typescript
const CC_REGEX = /^[a-z]+(\([^)]+\))?!?:\s\S/;
```

| Message | Valid? | Reason |
|---------|--------|--------|
| `fix(auth): handle null token` | ✅ | type + scope + description |
| `feat!: breaking change` | ✅ | type + `!` + description |
| `feat(api)!: add v2 endpoint` | ✅ | type + scope + `!` + description |
| `Fixed bug` | ❌ | No type, uppercase |
| `fix: Bug` | ❌ | Uppercase after `:` |
| `fix: bug.` | ✅ * | Regex does not block trailing period |

**Note :** this regex is **permissive** — it only validates the minimal structure. Semantic validation is left to `commit-msg-validator`.

### Chained push (`hasPush`)

```typescript
export function hasPush(command: string): boolean {
    return /git\s+push/.test(command);
}
```

Requires `git push` to be present **in the same command** (typically chained with `&&`).

## 4. Message extraction (`extractMessage`)

```typescript
export function extractMessage(command: string): string | null {
    // 1. Heredoc : git commit -m <<'EOF'...EOF
    // 2. Double quotes : git commit -m "message"
    // 3. Single quotes : git commit -m 'message'
    // Returns null if no -m (interactive editor)
}
```

| Command | Extracted message |
|---------|-------------------|
| `git commit -m "fix: bug" && git push` | `fix: bug` |
| `git commit -m 'feat: add x'` | `feat: add x` |
| `git commit` | `null` → ignored, no block |
| `git commit -m <<'EOF'\nfix: bug\nEOF` | `fix: bug` |

## 5. File tree

```
git-commits-push-enforcer/
├── src/
│   ├── core/
│   │   ├── validator.ts               ← isGitCommit, extractMessage, isValidCC, hasPush
│   │   └── __tests__/validator.test.ts
│   └── bin/
│       ├── pre-tool-use.ts            ← Pre-execution hook
│       └── __tests__/pre-tool-use.test.ts
```

## 6. Behavior by runtime

| Scenario | Pi (Extension) | Claude/Codex (Pre-tool-use) | Antigravity — Git `pre-commit` hook |
|----------|---------------|---------------------------|-------------------------------------|
| `git commit -m "fix: bar" && git push` | ✅ Passes | ✅ allow | ✅ exit 0 — commit proceeds |
| `git commit -m "fix: bar"` (no push) | ❌ Block | ❌ deny | ❌ exit 1 + `[ENFORCER_API_RESPONSE]` — commit aborted |
| `git commit -m "WIP: stuff" && git push` | ❌ Block | ❌ deny | ❌ exit 1 — commit aborted |
| `git commit` (editor, no `-m`) | ✅ Passes (ignored) | ✅ Passes (ignored) | ✅ exit 0 — skipped (no message) |
| Non-shell command / VS Code / script | N/A | N/A | ✅ exit 0 — skipped, best-effort |

**Antigravity trigger :** Git `pre-commit` hook — fires on `git commit` in any repo with the hook installed. The raw git command is captured by a **Zsh trap** and passed via `process.env._RAW_GIT_CMD`.

**Entrypoint :** `~/.gravity/wrappers/git-commits-push-enforcer/hook.ts`

**Flow :**

```
User runs: git commit -m "fix: stuff"
        │
        ▼  (Zsh trap captures _RAW_GIT_CMD)
┌──────────────────────────────────────────┐
│  pre-commit hook                         │
│  → runs push-enforcer wrapper            │
│  → if fails → exit 1 (commit aborted)   │
└──────────────┬───────────────────────────┘
               ▼
┌──────────────────────────────────────────┐
│  Wrapper: reads _RAW_GIT_CMD             │
│  isGitCommit() → extractMessage()       │
│  isValidCC() → hasPush()                │
│  → logs telemetry                       │
│  → prints [ENFORCER_API_RESPONSE]       │
└──────────────┬───────────────────────────┘
     CC+Push   │  Invalid or missing push
     exit 0    ▼  exit 1 → commit aborted
```

**Telemetry :** Logs to `~/.gravity/logs/events.jsonl` via `telemetry/logger.ts` with status and failed check details.

**Special note :** Runs alongside `secret-scanner` in the same `pre-commit` hook — both wrappers are called sequentially; if either fails, the commit is aborted.

## 7. Interaction with the `/git-commits-push` skill

The skill **bypasses** this enforcer because it uses `execSync("git commit ...")` directly (Node.js), not Pi's `bash` tool. Conventional Commits validation is done **by the skill itself** via a dynamic import of `commit-msg-validator`.

## 8. Agent mitigation (when blocked)

1. **Do not bypass** — no `--no-verify`, no retry with a different message
2. **Use the skill** : `/git-commits-push` handles both constraints automatically
3. **Manually** :
   - Append `&& git push` to your command
   - Format the message in Conventional Commits : `<type>(<scope>): <description>`
