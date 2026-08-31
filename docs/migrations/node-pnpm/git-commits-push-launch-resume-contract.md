---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "contract"
domain: "git-commits-push"
severity: "strict"
name: "git-commits-push launch and resume contract"
version: "0.1.0"
---

# git-commits-push launch and resume contract

## Public launch

The canonical public command is:

```bash
cd "$HOME/.agents/skills/git-commits-push" && pnpm --silent run start
```

The command-recognition core must accept both this syntax and the historical Bun syntax during the compatibility deployment. Dotpi adapters and zero-timeout filtering must consume the shared recognition result rather than duplicate command parsing.

## Process topology

The public package-manager process may perform the initial launch. After launch:

- a Node supervisor must own both compiled entrypoints;
- internal resumes must use `process.execPath` plus the compiled orchestrator path;
- dequeued orders must use `process.execPath` plus the compiled supervisor or orchestrator path required by the queue contract;
- no resume or queue process may relaunch pnpm;
- arguments must be passed as arrays without a shell unless shell syntax is explicitly required;
- paths containing spaces or non-ASCII characters must remain single arguments;
- stdin, stdout, stderr, backpressure, exit, abort, and signal behavior must follow the shared subprocess contract.

## Artifact contract

The build must emit both entrypoints and deterministically copy `settings.json` and `system-prompt.md`. Runtime-relative paths must resolve from compiled artifacts without user-specific absolute paths. Source maps must be emitted and `dist/` must remain untracked.

## Resume contract

New Turnlock `resumeCommand` values must target compiled JavaScript. Existing persisted runs must never be rewritten silently. Before cutover, every historical run must be classified as drained, explicitly closed, or rejected as incompatible. A resume request for an incompatible run must fail closed with an actionable error.

## Queue contract

The cutover must occur only while no active run, live queue lock, or pending order exists. Queue ordering, order identifiers, lock heartbeats, stale thresholds, retry kinds, and telemetry must remain unchanged. Descendant processes must be terminated on cancellation or shutdown without leaving a live lock.

## Output contract

Normal orchestrator stdout is reserved exclusively for Turnlock protocol blocks. Supervisor diagnostics and child stderr remain on stderr. Child stdout must never leak to parent stdout except through the explicitly validated Turnlock protocol path.

## Security gate

The compiled implementation must pass trust-token, Git-hook, secret-scanner, telemetry-redaction, file-permission, and forged-token tests. Missing tools, malformed state, unavailable executables, and scanner errors remain fail-closed.

## Self-hosting gate

The compatibility exception for direct Git ends only after the compiled Node orchestrator successfully validates, commits, and pushes a real migration commit through a temporary repository with a local bare remote, followed by the designated real migration commit and push.

The gate is satisfied. Run `01M16Z8A030MJZAHMZX554CJPM` used the canonical Node launch to validate, commit, and push real changes to dotagents and dotpi; commits `10b5da5`, `5990b33`, and `3c1cf95` reached their remotes, and Node/Bun CI runs `33258149595`, `33258149602`, `33258151521`, and `33258151486` all passed. The closure record itself is committed through the same Node orchestrator. Direct agent-issued `git commit` and `git push` commands are prohibited after this closure; only Git subprocesses owned by the orchestrator remain permitted.
