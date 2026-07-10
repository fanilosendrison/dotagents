# Git Commits Push Enforcer

Blocks direct raw Git mutations and forces commits through the `/git-commits-push` skill. Detection and enforcement logic is centralized in the shared core:

`~/.agents/agent-enforcers/git-commits-push-enforcer/src/core/validator.ts`

Trust tokens are managed by:
`~/.agents/agent-enforcers/git-commits-push-enforcer/src/core/trust-store.ts`

## 1. Wiring — 4 interception points

| # | Mechanism | Runtime | File |
|---|-----------|---------|------|
| 1 | **Pi Extension** · `pi.on("tool_call")` | **Pi** | `~/.pi/agent/extensions/git-commits-push-enforcer.ts` |
| 2 | **Pre-tool-use hook** · reads stdin JSON | **Codex** | `~/.codex/hooks/git-commits-push-enforcer.ts` |
| 3 | **PATH shim** · intercepts `git` binary | **Antigravity** | `~/.gravity/wrappers/git-commits-push-enforcer/git-shim.sh` |
| 4 | **Git pre-commit hook** | **Git (any repo)** | `~/.gravity/git-hooks/pre-commit` |

All share the **same enforcement core**: `validator.ts` from `.agents`.
The Antigravity PATH shim keeps only a minimal Bash prefilter for `commit`,
`commit-tree`, and `push` so it can decide when to invoke the TypeScript hook.

## 2. What is blocked

- `git commit`
- `git commit-tree`
- `git push`

Obfuscation techniques are detected and blocked: env prefixes, sudo, bash -c, env -S, nohup, command chaining.

## 3. Allowed paths

### Skill invocation (shell-level)
```bash
/git-commits-push
cd ~/.agents/skills/git-commits-push && bun run start
```

### Trusted skill execution (internal-only)
The `/git-commits-push` skill creates short-lived, one-shot trust tokens from its internal Git helper call sites before spawning internal git subprocesses. The token is passed via `GIT_COMMITS_PUSH_ENFORCER_TOKEN` alongside `GIT_COMMITS_PUSH_ENFORCER_SOURCE=skill`. Direct `createTrustToken()` callers outside the skill Git helpers are rejected, and a marker without a valid helper-issued token is blocked.

## 4. Behavior by runtime

| Scenario | Pi | Codex | Gravity |
|----------|-----|-------|---------|
| `git commit -m "fix: bar"` | ❌ Block | ❌ Deny | ❌ Block |
| `git push origin main` | ❌ Block | ❌ Deny | ❌ Block |
| `BYPASS_GIT_ENFORCER=1 git commit` | ⚠️ Skip (legacy) | ⚠️ Skip (legacy) | ❌ Block |
| `/git-commits-push` | ✅ Allow + log | ✅ Allow + log | ✅ Allow |
| Skill internal git with helper-issued token | ✅ Allow | ✅ Allow | ✅ Allow + log |
| Marker without token | — | — | ❌ Block (forged) |

## 5. Telemetry

Events use the same names across all harnesses: `enforcer_triggered`, `blocked`, `skipped`.

| Harness | Stats path | Extra fields |
|---------|-----------|--------------|
| Pi | `~/neelopedia/stats/pi/git-commits-push-enforcer/` | `toolCallId`, `parentModel`, `thinkingLevel` |
| Codex | `~/neelopedia/stats/codex/git-commits-push-enforcer/` | `toolCallId`, `parentModel`, `thinkingLevel` |
| Gravity | `~/neelopedia/stats/antigravity/git-commits-push-enforcer/` | `parentModel`, `thinkingLevel`, `trajectoryId` |

Non-commit-intent commands (e.g. `echo ok`, `rg -n 'git commit'`) produce **zero telemetry** events.

## 6. Interaction with the `/git-commits-push` skill

The skill bypasses enforcement only through its internal Git helpers, which create a trust token via `createTrustToken()` before each git subprocess. The Gravity shim validates the token through `hook.ts`, logs `enforcer_triggered`, then delegates to the real git binary with `--no-verify`.

## 7. Relevant Files

- `~/.agents/agent-enforcers/git-commits-push-enforcer/src/core/validator.ts` — shared detection + enforcement
- `~/.agents/agent-enforcers/git-commits-push-enforcer/src/core/trust-store.ts` — capability trust tokens
- `~/.pi/agent/extensions/git-commits-push-enforcer.ts` — Pi adapter
- `~/.codex/hooks/git-commits-push-enforcer.ts` — Codex adapter
- `~/.gravity/wrappers/git-commits-push-enforcer/hook.ts` — Gravity adapter
- `~/.gravity/wrappers/git-commits-push-enforcer/git-shim.sh` — PATH shim with minimal prefilter before `hook.ts`
- `~/.agents/skills/git-commits-push/src/modules/git/git-exec.ts` — skill trust token generation
