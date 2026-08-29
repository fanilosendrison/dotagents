---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "high-sierra-compatibility-report"
workspace: "dotagents and dotpi"
date: "2026-08-25"
step_id: 0
---

# High Sierra compatibility report

## Verified

- Host operating system: macOS 10.13.6 on x86-64.
- Node wrapper reports Node.js 22.19.0.
- The wrapper injects local compatibility copies of `libc++.1.dylib`, `libc++abi.1.dylib`, and `libchkstk_compat.dylib`.
- Corepack 0.34.0 runs through the Node wrapper.
- Corepack installed and activated exact pnpm 11.24.0; `pnpm --version` reports `11.24.0`.
- Direct execution and syntax checking of an erasable TypeScript module succeed under Node 22.19.0.
- `import.meta.dirname` and `import.meta.filename` are available.
- Git 2.17.2, Bash 3.2.57, and the system toolchain are present.
- Pi coding agent 0.84.2, Pi AI 0.84.2, Pi TUI 0.84.2, and Jiti 2.7.0 are installed in the current Pi distribution.
- Biome 2.5.2 executes successfully through pnpm on this host and passes the event-sink source gate.
- Exact LLM Runtime 0.1.2, Jiti 2.7.0, and Pi Coding Agent 0.84.2 root imports succeed from an isolated pnpm installation; `pi --version` reports 0.84.2.
- Jiti 2.7.0 loads an erasable TypeScript fixture.
- Pi 0.84.2 Darwin terminal modifiers, native clipboard loading, clipboard resolution fallback, and Photon WASM image construction execute successfully.
- Published `turnlock@0.9.1` reproduces byte-for-byte through pnpm pack, installs cleanly, imports through Node ESM, and compiles from a strict TypeScript consumer; published `turnlock@0.9.0` does not import under Node ESM.
- jq 1.7.1 was built from the official release source after verifying source SHA-256 `478c9ca129fd2e3443fe27314b455e211e0d8c60bc8ff7df703873deeee580c2`; all jq and bundled Oniguruma tests pass under `LC_ALL=C` after a test-harness-only BSD `sed` compatibility correction.
- The locally compiled `~/.local/bin/jq` reports 1.7.1, has SHA-256 `5d1277d947b3106236efc43204b90afc2ac8b36b8ec6ee2da873b2b0e9622ee1`, and passes the JSON construction and query shapes used by loop-clean.
- The official jq macOS prebuild was checksum-valid but rejected because its Mach-O load command is unsupported on High Sierra; it was not installed.
- Both independent pnpm lockfiles pass two clean frozen installations with lifecycle scripts disabled and unchanged lock hashes; exact Pi/event-sink/Jiti/Turnlock imports pass from the materialized graphs.
- The shared Node subprocess runtime passes 26 tests under Node 22.19.0 on High Sierra, including exit/abort, exit/I/O-error, abort/I/O-error, and abort/spawn-error precedence; 12 repeated race runs remain stable, Node run `33121281919` passes on Node 22.19/24 across Linux and macOS without Bun, and retained Bun run `33121281949` passes on Linux and macOS.
- The shared YAML parser uses exact `js-yaml@4.3.1` with explicit `CORE_SCHEMA`; Node run `33103539658` passes on Node 22.19/24 Linux/macOS without Bun, and Bun run `33103539701` passes the complete Bun 1.3.14 differential vectors.
- The deterministic asset copier and closed `.mjs` runner pass the combined 42-test Node runtime suite with 41 passes and only the Bun differential skipped under Node 22.19.0 on High Sierra. Two clean frozen installations in a path containing spaces preserve lock SHA-256 `b7293c1ec53fbb1d386d42aaffc343eddc56ccfb5693133b984330d9962bf4b1`; Node run `33121281919` passes on Node 22.19/24 Linux/macOS without Bun, and retained Bun run `33121281949` passes on Linux/macOS.
- The dependency-free `create-symlink.mjs` bootstrap preserves all five historical backup and symlink vectors under Node 22.19.0, passes its active gateway smoke with spaces and non-ASCII paths, and leaves the Bun sentinel untouched. Node run `33122709911` passes on Node 22.19/24 Linux/macOS, and retained Bun run `33122709858` passes both historical and successor tests on Linux/macOS.
- The dependency-free documentation bootstraps preserve all 57 historical unit and end-to-end vectors, including exact validation errors, generated Markdown, indexes, Quick Navigation, tree ordering, stdout, and exit codes. Two frozen installs in a path with spaces remain stable and leave the Bun sentinel untouched; Node run `33153119390` passes on Node 22.19/24 Linux/macOS, and retained Bun run `33153119383` passes historical and successor suites on Linux/macOS. The parity validator itself passes Node run `33152421996` and Bun run `33152421963`.
- The skill-creator validator compiles from strict NodeNext TypeScript to untracked `.mjs` with source maps and declarations. Its 13 portable vectors preserve exact diagnostics and exit codes through the compiled CLI, while the retained Bun differential compares three representative historical CLI outcomes. The active gateway command, spaces/Unicode smoke, two frozen installs, and Bun failure sentinel pass with stable lock SHA-256 `f8a098ec1532cc5487c8ff6c21696c28be876d91806fa9497d7df2046cecd79c`; Node run `33156097968` passes on Node 22.19/24 Linux/macOS, and retained Bun run `33156097980` passes on Linux/macOS.
- The shared git-commits-push recognizer classifies slash, historical Bun, and canonical pnpm launches while rejecting incomplete, lookalike, non-conjunctive, substituted, redirected, or appended commands. Two frozen installs and the Bun sentinel pass; Node run `33174108705` and retained Bun run `33174108777` are green on Linux/macOS. Dotpi consumes the same result in both its enforcer and zero-timeout adapter, retains all 25 parity surfaces, and passes Node run `33175005631` plus Bun run `33175005680` on Linux/macOS.
- Both git-commits-push entrypoints and their shared trust-token dependency compile as strict NodeNext ESM with rewritten relative extensions, declarations, and source maps; exact settings and prompt assets are copied deterministically into the untracked artifact tree. Five artifact/import/gateway vectors pass two frozen installs in spaces/Unicode paths without Bun and preserve pnpm lock SHA-256 `f8a098ec1532cc5487c8ff6c21696c28be876d91806fa9497d7df2046cecd79c`; Node run `33177422527` and retained Bun run `33177422521` are green on Linux/macOS.
- The compiled shell-free supervisor owns isolated producer and bridge groups, preserves argument boundaries and multi-megabyte backpressure, isolates producer stdout, fails closed on stage and executable failures, terminates both trees on abort, and forwards SIGTERM. Six supervisor vectors pass Node run `33178828140`; retained Bun run `33178828142` remains green on Linux/macOS while the active launch stays on the compatibility pipeline.
- Exact `.js` and `.ts` trust-token stack boundaries now authorize only the two internal Git helpers. Three compiled vectors verify mode-0600 creation, one-shot consumption, direct-mint rejection, and lookalike rejection; Node run `33198648152` and retained Bun run `33198648080` pass on Linux/macOS. Two frozen installs in spaces/Unicode paths leave all locks and the Bun sentinel unchanged.
- Compiled resume and dequeue launches use `process.execPath`, exact artifact paths, argument arrays, and `shell: false`; altered or historical resume commands fail closed before spawn, partial resume stdout survives non-zero exits, and dequeued order context remains unchanged. Four Node vectors preserve the exact source Bun commands while proving no internal Bun/pnpm in compiled launches; Node run `33241797546` and retained Bun run `33241797544` pass on Linux/macOS, with two frozen installs and stable locks.
- A compiled read-only cutover preflight classifies historical runs from terminal audit events or separate explicit-closure evidence and blocks every incompatible run, Turnlock/queue lock residue, and `order-*` artifact without mutating persisted state. Six vectors cover all classifications, malformed evidence, reopened history, active/stale locks, hostile names, deterministic JSON, and exit codes; the gateway report is empty and ready. Node run `33242635902` and retained Bun run `33242635956` pass on Linux/macOS; two frozen installs preserve every package-manager lockfile and leave the Bun sentinel empty.
- The compiled enforcement validator, scanner, publisher, and supervisor pass hook, secret redaction, warning-boundary, scanner-error, forged-token, Git-mode, file-permission, and output-leak gates. The exercised publisher preserves the established pre/post-hook behavior and `100755`/`100644` modes while a quoted temporary message path fixes spaces/Unicode temp roots. Five new vectors bring the artifact suite to 29 tests; Node run `33243694973` and retained Bun run `33243694997` pass on Linux/macOS, with two frozen installs, stable lockfiles, and an empty Bun sentinel.
- The real compiled supervisor-to-orchestrator-to-bridge pipeline now completes a validation retry, commit, and push against a local bare remote while only the LLM HTTP call is mocked. Its stdout contains only validated Turnlock blocks; bridge diagnostics and captured resume stderr remain on stderr; terminal state, telemetry, queue cleanup, matching local/remote HEADs, and zero Bun/pnpm children are verified. Git branch resolution now uses `symbolic-ref`, supported by the local Git 2.17 baseline. The suite reaches 30 tests; Node run `33257153599` and retained Bun run `33257153601` pass on Linux/macOS, with two frozen installs and stable lockfiles.
- Full pnpm audits report zero known vulnerabilities. `js-yaml` is intentionally raised from Bun-resolved 4.3.0 to patched 4.3.1 for `GHSA-5p4m-2wfm-xmqj` / `CVE-2026-59870`.

## Blocked or missing

- Bun is absent, so the historical Bun 1.3.14 baseline cannot run on this host.
- The current Git version does not provide `git switch`; scripts must use Git 2.17-compatible commands or document a newer prerequisite.
- Node 24 is not installed on this host.

## Authentication bridge observation

The private Pi auth file currently contains no `api_key` entry, and the documented shared credential registry is absent. The jq credential bridge is therefore inactive and cannot be exercised end to end without first configuring it. This does not block the current non-API-key Pi authentication, but the documentation and private configuration are not aligned.

## Required completion evidence

1. Run full loop-clean after Bun is available; its jq expressions already pass direct smoke tests.
2. Run physical-root and gateway suites after deleting `node_modules` and `dist`.
3. Run the no-Bun sentinel job on High Sierra; the supported Linux/macOS CI sentinel is already green in run `33095210333`.
4. Node 24 evidence on supported Linux and macOS CI is complete in run `33095210333`.

Modern macOS CI must not substitute for the remaining High Sierra checks.
