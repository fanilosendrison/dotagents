# Commit Message Validator

Validates commit messages according to the **Conventional Commits 1.0.0** specification.

## 1. Wiring — 4 interception points

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_call")` | **Pi** | `~/.pi/agent/extensions/commit-validator.ts` |
| 2 | **Pre-tool-use hook** · reads stdin JSON | **Claude + Codex** | `~/.claude/hooks/commit-msg-validator.ts` (Claude) / `~/.codex/hooks/commit-msg-validator.ts` (Codex) |
| 3 | **Post-tool-use hook** · injects context | **Codex only** | `~/.codex/hooks/commit-msg-validator-post.ts` |
| 4 | **Antigravity wrapper** · git `commit-msg` hook | **Git (any repo)** | `~/.gravity/wrappers/commit-msg-validator/hook.ts` |

## 2. Trigger flow

```
Bash command → "git commit" ?
        │
        ▼
┌──────────────────────────────────┐
│  extractCommitMessage(command)   │
│  (supports -m and multi-line)    │
└──────────────┬───────────────────┘
    No -m      │  Message extracted
    (editor)   ▼
    Passes  ┌──────────────────────────────────┐
            │  validateCommitMessage(message)   │
            │  → { valid, errors[] } object     │
            └──────────────┬───────────────────┘
            Valid          │  Invalid
            ▼              ▼
       ✅ Allow        ❌ Block/Deny
```

## 3. Validation rules

| Rule | Blocked example | Reason |
|------|----------------|--------|
| **Format** : `<type>(<scope>): <description>` | `Fixed bug` | No type |
| **Type** : must be a valid type (feat, fix, chore, docs, style, refactor, perf, test, build, ci, revert) | `stuff: add feature` | `stuff` is not a recognized type |
| **Scope** : optional, in parentheses | `fix: bug` | ✅ scope is optional |
| **Description** : **imperative present tense** | `fix(auth): fixed bug` | `fixed` → past tense, not imperative |
| **No capital letter** after `:` | `fix: Bug` | `B` is uppercase |
| **No trailing period** | `fix: bug.` | `.` at end of message |
| **Body** : optional, separated by blank line | ✅ `fix: bug\n\ndetails` | |

### Valid types

```
feat, fix, chore, docs, style, refactor, perf, test, build, ci, revert
```

## 4. File tree

```
commit-msg-validator/
├── src/
│   ├── core/
│   │   ├── types.ts                   ← ValidationResult interface
│   │   ├── validator.ts               ← isGitCommit, extractCommitMessage, validateCommitMessage
│   │   └── __tests__/validator.test.ts
│   └── bin/
│       ├── pre-tool-use.ts            ← Pre-execution hook
│       ├── post-tool-use.ts           ← Post-execution hook (Codex)
│       └── __tests__/hooks.test.ts
```

## 5. Behavior by runtime

| Scenario | Pi (Extension) | Claude (Pre) | Codex (Pre+Post) | Antigravity — Git `commit-msg` hook |
|----------|---------------|-------------|------------------|--------------------------------------|
| Valid Conventional Commits | ✅ Passes | ✅ allow + context | ✅ + post: context | ✅ exit 0 — commit proceeds |
| Invalid format/uppercase/period | ❌ Block | ❌ deny | ❌ deny | ❌ exit 1 + `[ENFORCER_API_RESPONSE]` JSON — commit aborted |
| `git commit` (editor) | ✅ Passes | ✅ Passes | ✅ Passes | ✅ exit 0 — skipped (no `-m`) |
| Message file cannot be read | N/A | N/A | N/A | ❌ exit 1 — fail-closed |

**Antigravity trigger :** Git `commit-msg` hook — fires after the user writes a commit message, receives the message file path as `argv[2]`.

**Entrypoint :** `~/.gravity/wrappers/commit-msg-validator/hook.ts`

**Flow :**

```
git commit (any repo)
        │
        ▼
┌──────────────────────────────────────────┐
│  commit-msg hook                         │
│  bun run wrappers/commit-msg-validator/hook.ts <msg_file>
└──────────────┬───────────────────────────┘
               ▼
┌──────────────────────────────────────────┐
│  fs.readFileSync(msgFilePath)            │
│  validateCommitMessage(message)          │
│  → logs telemetry                        │
│  → prints [ENFORCER_API_RESPONSE]        │
└──────────────┬───────────────────────────┘
      Valid    │  Invalid
      exit 0   ▼  exit 1 → commit aborted
```

**Telemetry :** Logs to `~/.gravity/logs/events.jsonl` with status and validation errors.

## 6. Interaction with the `/git-commits-push` skill

The skill **dynamically imports** `commit-msg-validator` in its `commit-and-push` phase to validate LLM-generated messages **before** committing :

```typescript
// turnlock-orchestrator.ts — "commit-and-push" phase
const module = await import(validatorPath);
validateCommitMessage = module.validateCommitMessage;
```

If validation fails, the skill can **retry** (up to 1 time) with LLM feedback.

## 7. Agent mitigation (when blocked)

1. **Use the skill** : `/git-commits-push` generates and validates messages automatically
2. **Manually** : format as `<type>(<scope>): <imperative description>`
   - Lowercase type, scope optional
   - Description in imperative present tense, no leading capital, no trailing period
3. **Do not cheat** : no `--no-verify`, no empty message
