# Git Commits Push Enforcer

Blocks direct raw Git mutations and forces commits through the `/git-commits-push` skill. Detection and enforcement logic is centralized in the shared core:

`~/.agents/agent-enforcers/git-commits-push-enforcer/src/core/validator.ts`

One-shot guardrail permits are defined by the versioned
`@git-commits-push/trust` package owned by the dedicated `git-commits-push`
repository. Dotagents consumes its pinned package artifact. This mechanism is
not an authentication boundary against arbitrary code running as the same OS
user.

## 1. Wiring — 4 interception points

| Number | Mechanism | Runtime | File |
| ------ | --------- | ------- | ---- |
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

### Canonical shell launch

```bash
"$HOME/.local/bin/git-commits-push"

"$HOME/.local/bin/git-commits-push" \
  --repository "/absolute/path/to/worktree" \
  --push-remote origin \
  --push-ref refs/heads/main
```

The shared recognizer accepts only the quoted stable executable followed by
optional static arguments. The installed runtime remains the authority for CLI
argument semantics. Shell wrappers, environment prefixes, control operators,
redirections, backgrounding, expansion, substitution, globbing, retired
checkout launches, and noncanonical executable forms are rejected.

Slash-form skill references are valid only as interactive harness input. When
an agent emits `/git-commits-push` inside a Bash tool call, the enforcer blocks
it with a diagnostic naming the canonical executable instead of allowing the
shell to fail with `ENOENT`.

### Internal one-shot permit

The installed `git-commits-push` runtime creates a short-lived, one-shot permit
from exact Git helper paths in its immutable content-addressed release before
spawning an internal Git subprocess.
The permit is passed via `GIT_COMMITS_PUSH_ENFORCER_TOKEN` alongside
`GIT_COMMITS_PUSH_ENFORCER_SOURCE=skill`. Validation atomically claims the
record, verifies private file ownership and modes, requires the recorded issuer
process to be the validator or one of its ancestors, and binds issuance to an
authorized source or immutable XDG release working directory. The vendored validator package cannot
mint permits. A marker without a well-formed, unconsumed permit is blocked.

These checks prevent accidental reuse, malformed markers, and cross-user access.
They do not establish trusted code provenance within one user account. A process
running as the same user can fabricate files, inspect processes, or modify the
runtime. Adversarial same-user authorization requires an external broker under a
separate service identity; it cannot be added by signing the record with
same-user key material.

## 4. Behavior by runtime

| Scenario | Pi runtime | Codex runtime | Gravity runtime |
| -------- | ---------- | ------------- | --------------- |
| `git commit -m "fix: bar"` | ❌ Block | ❌ Deny | ❌ Block |
| `git push origin main` | ❌ Block | ❌ Deny | ❌ Block |
| `BYPASS_GIT_ENFORCER=1 git commit` | ⚠️ Skip (legacy) | ⚠️ Skip (legacy) | ❌ Block |
| Canonical installed binary with static arguments | ✅ Allow + log | ✅ Allow + log | ✅ Allow |
| Slash form inside a Bash tool call | ❌ Block with correction | ❌ Deny with correction | ❌ Block with correction |
| Skill internal Git with one-shot permit | Not observed by parent hook | Not observed by parent hook | ✅ Allow + log |
| Trusted marker leaks into parent hook without validation | ❌ Block (invalid) | ❌ Deny (invalid) | ❌ Block (invalid) |

## 5. Telemetry

Events use the same names across all harnesses: `enforcer_triggered`, `blocked`, `skipped`.

| Harness | Stats path | Extra fields |
| ------- | ---------- | ------------ |
| Pi | `~/neelopedia/stats/pi/git-commits-push-enforcer/` | `toolCallId`, `parentModel`, `thinkingLevel` |
| Codex | `~/neelopedia/stats/codex/git-commits-push-enforcer/` | `toolCallId`, `parentModel`, `thinkingLevel` |
| Gravity | `~/neelopedia/stats/antigravity/git-commits-push-enforcer/` | `parentModel`, `thinkingLevel`, `trajectoryId` |

Non-commit-intent commands (e.g. `echo ok`, `rg -n 'git commit'`) produce **zero telemetry** events.

## 6. Interaction with the `/git-commits-push` skill

The skill bypasses enforcement only through its internal Git helpers, which
create a one-shot permit via `createTrustToken()` before each Git subprocess.
The Gravity shim validates and consumes the permit through `hook.ts`, logs
`enforcer_triggered`, then delegates to the real Git binary with `--no-verify`.

**Permits are subprocess-level only.** Pi and Codex are agent-level
interceptors: they see the canonical installed-binary Bash tool command, not
the skill's internal git subprocesses. They pass `trustedSkillMarkerSet` to
the shared core for consistency but intentionally omit `trustToken` and
`validateToken`. If the marker leaks into a Pi or Codex parent process, the core
fails closed and blocks it as forged. Gravity is the only adapter that validates
and consumes internal one-shot permits.

## 7. Relevant Files

- `~/.agents/agent-enforcers/git-commits-push-enforcer/src/core/validator.ts` — shared detection + enforcement
- `~/.agents/agent-enforcers/git-commits-push-enforcer/src/core/static-shell-arguments.ts` — static shell-argument boundary
- `~/Developper/Projects/git-commits-push/packages/trust/` — canonical one-shot guardrail-permit package
- `~/.pi/agent/extensions/git-commits-push-enforcer.ts` — Pi adapter
- `~/.codex/hooks/git-commits-push-enforcer.ts` — Codex adapter
- `~/.gravity/wrappers/git-commits-push-enforcer/hook.ts` — Gravity adapter
- `~/.gravity/wrappers/git-commits-push-enforcer/git-shim.sh` — PATH shim with minimal prefilter before `hook.ts`
- `~/Developper/Projects/git-commits-push/src/modules/git/git-exec.ts` — runtime trust-token generation
