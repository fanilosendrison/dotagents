---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "contract"
domain: "git-commits-push"
severity: "strict"
name: "git-commits-push launch and resume contract"
version: "0.3.0"
---

# git-commits-push launch and resume contract

## Public launch

The canonical public command is:

```bash
"$HOME/.local/bin/git-commits-push"
```

The dotagents skill directory contains only `SKILL.md`. The command-recognition
core must reject launch commands targeting either the retired skill runtime or
the dedicated source checkout. Binary invocations must contain no wrappers,
arguments, redirects, or appended shell segments. Dotpi adapters and
zero-timeout filtering consume the shared recognition result rather than
duplicating command parsing.

## Process topology

The public symlink resolves through the active immutable XDG release. After
launch:

- the release-local Node bootstrap must import the compiled public entrypoint;
- a Node supervisor must own both compiled Turnlock entrypoints;
- internal resumes must use `process.execPath` plus the absolute compiled
  orchestrator path from the same release;
- no production or resume process may invoke `pnpm` or build artifacts;
- arguments must be passed as arrays without a shell unless shell syntax is
  explicitly required;
- paths containing spaces or non-ASCII characters must remain single arguments;
- stdin, stdout, stderr, backpressure, exit, abort, and signal behavior must follow the shared subprocess contract.

## Repository and artifact contract

The runtime, workspace packages, lockfile, build, tests, and CI belong to the
dedicated `git-commits-push` repository. Dotagents may retain versioned package
tarballs for active harness consumers, but it must not retain runtime source.

The build must emit the public launcher, supervisor, orchestrator, and bridge
entrypoints and deterministically copy `settings.json` and `system-prompt.md`.
The installer must deploy a self-contained Node application below non-empty
absolute `XDG_DATA_HOME`, falling back to `~/.local/share`, name releases by
semantic version plus deterministic tree digest, and atomically switch only the
`current` symlink. `~/.local/bin/git-commits-push` remains a stable managed link.
Runtime-relative paths must resolve from compiled artifacts without
user-specific absolute paths. Source maps must be emitted and `dist/` must
remain untracked.

## Resume contract

New Turnlock `resumeCommand` values must target compiled JavaScript in the
release that created the run. Existing persisted runs must never be rewritten
silently. Installed releases must not be automatically garbage-collected while
a historical run may retain their absolute entrypoints. Before cutover, every
historical run must be classified as drained, explicitly closed, or rejected as
incompatible. A resume request for an incompatible run must fail closed with an
actionable error.

## Reconciliation and state contract

The cutover must occur only while no active run, live legacy lock, pending
legacy order, or active SQLite owner exists. Mutable state defaults to
`$XDG_STATE_HOME/git-commits-push/orders/`, or
`~/.local/state/git-commits-push/orders/` when `XDG_STATE_HOME` is absent or
empty. The public launcher must fail closed while the retired skill-local
`.state` container still exists; the explicit migration command must move the
complete container atomically before launch.

Public invocations coalesce through SQLite generations. Reconciliation fencing,
retry kinds, and telemetry must remain unchanged. Descendant processes must be
terminated on cancellation or shutdown without leaving a live owner.

## Output contract

Normal orchestrator stdout is reserved exclusively for Turnlock protocol blocks. Supervisor diagnostics and child stderr remain on stderr. Child stdout must never leak to parent stdout except through the explicitly validated Turnlock protocol path.

## Security gate

The compiled implementation must pass trust-token, Git-hook, secret-scanner, telemetry-redaction, file-permission, and forged-token tests. Missing tools, malformed state, unavailable executables, and scanner errors remain fail-closed.

## Self-hosting gate

The compatibility exception for direct Git ends only after the compiled Node orchestrator successfully validates, commits, and pushes a real migration commit through a temporary repository with a local bare remote, followed by the designated real migration commit and push.

The gate is satisfied. Run `01M16Z8A030MJZAHMZX554CJPM` used the canonical Node launch to validate, commit, and push real changes to dotagents and dotpi; commits `10b5da5`, `5990b33`, and `3c1cf95` reached their remotes, and Node/Bun CI runs `33258149595`, `33258149602`, `33258151521`, and `33258151486` all passed. The closure record itself is committed through the same Node orchestrator. Direct agent-issued `git commit` and `git push` commands are prohibited after this closure; only Git subprocesses owned by the orchestrator remain permitted.
