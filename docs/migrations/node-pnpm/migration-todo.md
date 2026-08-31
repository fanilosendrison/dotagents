---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "node-pnpm-migration-todo"
workspace: "dotagents and dotpi"
date: "2026-08-25"
step_id: 0
---

# Node and pnpm migration to-do

## Status legend

- `[x]` complete and mechanically verified
- `[ ]` pending
- `[!]` blocked by an external prerequisite

## Phase 0 — Decisions and dependencies

- [x] Create `migration/node-pnpm` in both repositories.
- [x] Annotate both raw baselines as `pre-node-pnpm-raw`.
- [x] Confirm six dotagents Bun lockfiles and one dotpi Bun lockfile.
- [x] Confirm 74 dotagents Bun test surfaces and 25 direct dotpi Bun tests.
- [x] Create machine-readable inventory and parity generation tooling.
- [x] Seal approved ADR 0014 as immutable.
- [x] Add the functional parity contract.
- [x] Add the git-commits-push launch and resume contract.
- [x] Add test-retention and Bun-allowlist policies.
- [x] Register successor documents for specifications that mandate Bun.
- [x] Retrieve and audit the authoritative event-sink source.
- [x] Prepare `@fanilosendrison/event-sink@0.1.0`, Node tests, build, lockfile, CI, tarball, and clean-install smoke.
- [x] Commit and push event-sink as `e75692f34ef212c9ad173a37a73539f35f54c6ff`, push annotated tag `v0.1.0`, and pass GitHub CI run `32896680948`.
- [x] Publish event-sink immutably and verify exact registry integrity plus a clean public-API installation.
- [x] Declare exact Turnlock 0.9.1 in its dotagents consumer and exact event-sink 0.1.0 in dotpi; retain the verified Turnlock integrity in the Bun lock.
- [x] Materialize and verify both exact packages in independent pnpm lockfiles; defer runtime import replacement until green baseline gates pass.
- [x] Audit exact distributed tarballs for turnlock 0.9.0, LLM Runtime 0.1.2, Jiti 2.7.0, and Pi 0.84.2.
- [x] Reproduce the published turnlock 0.9.0 Node ESM defect end to end.
- [x] Prepare and push behavior-preserving `turnlock@0.9.1` through release-candidate HEAD `d6fdc6ad0f88978ee3f1c8d882d5bfd7183715b1` with Node package tests.
- [x] Pass Turnlock CI run `32897464178` on Bun 1.3.14 and Node 22.19/24 across Linux and macOS.
- [x] Authenticate npm, push annotated tag `v0.9.1`, pass tag CI, publish, reproduce the registry tarball byte-for-byte, and verify runtime plus TypeScript clean installation.
- [x] Complete the transitive distributed-file, lifecycle, native/WASM, deprecation, version-drift, and vulnerability audits.
- [x] Build and test official jq 1.7.1 source for High Sierra and install it under `~/.local/bin`.
- [x] Close the High Sierra prerequisite report with local Node 22.19 wrapper evidence and supported Node 22.19/24 Linux/macOS matrices.

## Phase 1 — Raw and green baselines

- [x] Add Bun 1.3.14 parity CI on Linux and macOS.
- [x] Build both gateways under an isolated temporary `HOME` in CI and retain baseline-only aliases for historical absolute imports.
- [x] Pin dotagents commit `3516a87e52b51e607fad387703a0b47c99751adf` exactly in dotpi CI.
- [x] Run the complete historical suite on Linux and macOS; run `32941370760` passes after isolated module-mock execution and portable HOME fixtures.
- [x] Fix pre-existing failures in separate green commits.
- [x] Annotate and publish both green baselines as `pre-node-pnpm-green`.
- [x] Record every direct-Git bootstrap commit until Node self-hosting succeeds; the registry is sealed by the successful self-hosting run and no later direct commit or push is permitted.
- [x] Record direct-Git Node runtime commit `2ee68a4efc7553aa1c631466de8f6c5c5b1c65f7` under the active bootstrap exception.

## Phase 2 — pnpm foundations

- [x] Create the explicit seven-importer dotagents workspace and root-only dotpi workspace with the upstream exclusion.
- [x] Remove the four empty scripts pseudo-package manifests and inherit the single `@dotagents/scripts` package boundary; two clean frozen installs preserve the regenerated seven-importer lockfile.
- [x] Add exact `pnpm@11.24.0` package-manager and Node `>=22.19.0` engine declarations at both roots.
- [x] Enforce strict engines and disabled automatic peer installation through `.npmrc` plus effective pnpm workspace settings; both repositories pass two clean frozen installs with stable lockfiles.
- [x] Declare the verified immutable dependencies in their consuming packages, including exact event-sink in git-commits-push before removing its source import.
- [x] Override all Pi internal packages to exact 0.84.2 so pnpm cannot drift to 0.84.3.
- [x] Generate one independent pnpm lockfile per repository.
- [x] Compare resolved versions against every Bun lockfile and classify only type-only drift plus the js-yaml security correction.
- [x] Validate two clean frozen installs per repository with unchanged lockfiles.
- [x] Resolve package managers in normative declaration order and fail closed when multiple supported lockfiles exist without a `STACK_EVAL.yaml` or `package.json` declaration.

## Phase 3 — Portable Node runtime

- [x] Add and test the shared subprocess API, including deterministic exit/abort, exit/I/O-error, abort/I/O-error, and abort/spawn-error races; 26 subprocess tests pass under Node 22.19.0 on High Sierra, 12 repeated race runs remain stable, Node run `33121281919` passes on Node 22.19/24 Linux/macOS without Bun, and retained Bun run `33121281949` passes on Linux/macOS.
- [x] Add exact `js-yaml@4.3.1` with explicit `CORE_SCHEMA`, Bun-compatible multi-document and alias semantics, duplicate/invalid-input errors, and differential vectors; Node run `33103539658` passes on Node 22.19/24 Linux/macOS without Bun and retained Bun run `33103539701` passes the historical suite plus the Bun 1.3.14 differential gate.
- [x] Add package-local NodeNext build configurations with declarations and source maps.
- [x] Add manifest-driven deterministic asset copying with confined paths, full source preflight, unique destinations, stable ordering, byte-exact output, and fixed file modes.
- [x] Add the explicit Node test runner with a closed upstream-free file set, sequential execution, a fixed 30-second timeout, TAP output, and fail-closed empty or missing discovery; Node run `33120493741` passes on Node 22.19/24 Linux/macOS without Bun and retained Bun run `33120493729` passes the historical suite on Linux/macOS.
- [x] Start direct Node TypeScript stripping with a sequential `node:test` stats-logger smoke; Node run `32954252065` passes on Node 22.19.0/24 Linux/macOS without Bun, and retained Bun run `32954252069` passes on Linux/macOS.

## Phase 4 — Bootstraps and compatible recognition

- [x] Migrate the active create-symlink bootstrap to dependency-free `.mjs` while retaining the historical TypeScript source, Bun test, and lockfile; all five named Node parity vectors, the gateway smoke, two frozen installs, and the Bun failure sentinel pass, Node run `33122709911` passes on Node 22.19/24 Linux/macOS, and retained Bun run `33122709858` passes on Linux/macOS.
- [x] Add a fail-closed parity-attribution validator after correcting the create-symlink row assignment; it checks counts, uniqueness, target confinement/readability, retained case names, and absence of `bun:test` in green targets. Node run `33152421996` and retained Bun run `33152421963` pass.
- [x] Migrate both active documentation bootstraps and pure libraries to dependency-free `.mjs` while retaining all historical sources and tests; all 57 names and filesystem/output vectors pass through two frozen installs in a path with spaces without touching the Bun sentinel, Node run `33153119390` passes on Node 22.19/24 Linux/macOS, and retained Bun run `33153119383` passes on Linux/macOS.
- [x] Compile the skill-creator validator from portable NodeNext TypeScript to untracked `.mjs` with source maps and declarations; its package-local typecheck/build, closed TAP runner, active root command, 13 portable vectors, and Bun differential preserve validation diagnostics and exit codes. Two frozen installs in a path with spaces and Unicode leave lock SHA-256 `f8a098ec1532cc5487c8ff6c21696c28be876d91806fa9497d7df2046cecd79c` unchanged and the Bun sentinel empty; Node run `33156097968` passes on Node 22.19/24 Linux/macOS, and retained Bun run `33156097980` passes historical and successor suites on Linux/macOS.
- [x] Accept the slash invocation, historical Bun launch, and canonical pnpm launch through one strict shared recognition result; reject incomplete commands, lookalike paths, unsafe separators, command substitutions, redirections, and appended shell commands. Seven direct Node vectors pass two frozen installs without touching the Bun sentinel; Node run `33174108705` passes on Node 22.19/24 Linux/macOS, and retained Bun run `33174108777` passes the extended historical core suite on Linux/macOS.
- [x] Deploy the shared recognition result to dotpi and zero-timeout-filter, update active operational commands to canonical pnpm syntax, and retain Bun compatibility. Dotpi keeps all 25 parity surfaces green with 136 Node tests; Node run `33175005631` and retained Bun run `33175005680` pass on Linux/macOS.

## Phase 5 — git-commits-push cutover

- [x] Compile both entrypoints and the shared trust-token dependency as strict NodeNext ESM with rewritten extensions, declarations, declaration maps, and source maps; deterministically copy exact `settings.json` and `system-prompt.md` bytes into the untracked artifact tree. Five Node artifact and gateway vectors pass two frozen installs in spaces/Unicode paths without touching the Bun sentinel, while the pnpm and Bun lockfiles remain byte-stable; Node run `33177422527` passes on Node 22.19/24 Linux/macOS, and retained Bun run `33177422521` passes on Linux/macOS.
- [x] Compile a shell-free Node supervisor that owns both isolated process groups, pipes producer stdout only into the bridge, preserves multi-megabyte backpressure, fails closed on either child or missing executable, terminates both trees on abort, and forwards SIGTERM. Six supervisor vectors pass Node run `33178828140`; retained Bun run `33178828142` remains green on Linux/macOS. The active launch intentionally remains on the compatibility pipeline until resume, queue, and security gates close.
- [x] Authorize exact compiled `.js` trust-token helper stacks without accepting suffix lookalikes; the compiled helper mints a mode-0600 one-shot token, validation consumes it once, and direct minting remains blocked. Three compiled vectors and the extended historical core test pass Node run `33198648152` and retained Bun run `33198648080` on Linux/macOS; two frozen installs preserve every lock and leave the Bun sentinel empty.
- [x] Replace the active shell pipeline with `scripts/start-node.mjs`: the canonical pnpm command now invokes a Node launcher that builds the shared runtime and skill artifacts through `process.execPath`, starts the compiled supervisor with inherited stdio, forwards signals to its isolated process tree, and propagates build/spawn/exit failures without internal Bun, pnpm, or shell composition. The bare-remote gate runs through this active launcher, and the strict public recognizer remains green. Two frozen installs preserve all package-manager lockfiles and leave the Bun sentinel empty. Node run `33257640938` and retained Bun run `33257640937` pass on Linux/macOS.
- [x] Preserve Turnlock-only stdout, exit codes, telemetry, queues, and retries on the compiled real pipeline; bridge diagnostics and resumed orchestrator stderr now remain on stderr.
- [x] Gate cutover with a read-only compiled preflight that classifies every persisted run as drained, explicitly closed through a separate local ledger, or rejected incompatible; require a final matching `orchestrator_end` event for natural drainage and reject live, stale, malformed, or unreadable Turnlock/queue locks plus every `order-*` artifact. Six Node vectors cover empty state, all classifications, reopened terminal history, malformed closure evidence, unexpected entries, active/abandoned locks, hostile order names, deterministic JSON, and exit codes. The gateway scan reports zero runs, locks, or orders and no blockers; two frozen installs preserve all package-manager lockfiles and leave the Bun sentinel empty. Node run `33242635902` and retained Bun run `33242635956` pass on Linux/macOS.
- [x] Point compiled `resumeCommand` values and dequeued orders to the compiled orchestrator and supervisor through `process.execPath` plus shell-free argument arrays; reject historical or altered resume strings before spawning, preserve partial stdout on resume failure, and retain the exact Bun source commands during compatibility. Four Node vectors cover hostile run IDs, spaces/Unicode paths, incompatible persisted commands, non-zero resume output, queue environment, and absence of internal Bun/pnpm; two frozen installs preserve all locks and the Bun sentinel. Node run `33241797546` and retained Bun run `33241797544` pass on Linux/macOS.
- [x] Pass the compiled Git-hook, secret-scanner, permission, forged-token, and leak gates. The compiled enforcement validator now ships with declarations and maps; production secrets block with redacted telemetry, non-production findings remain warnings, scanner exceptions fail closed, trusted marker replay/forgery blocks, pre-commit bypass and post-commit execution preserve the established hook contract, Git `100755`/`100644` modes survive, and hook/token values do not reach stdout or stderr. The publisher now quotes its temporary message path, fixing commits when the temp root contains spaces or Unicode. Five additional Node vectors bring the artifact suite to 29 tests; two frozen installs preserve all package-manager lockfiles and leave the Bun sentinel empty. Node run `33243694973` and retained Bun run `33243694997` pass on Linux/macOS.
- [x] Pass the bare-remote self-hosting gate with the real compiled supervisor, orchestrator, bridge, Turnlock resume loop, scanner, publisher, and Git push; only the OpenAI HTTP boundary is preloaded. The fixture forces a validation retry, commits and pushes to a local bare remote, verifies matching HEADs, terminal v2 state, manifests/results, Turnlock-only stdout, reports/diagnostics on stderr, redacted telemetry, empty queue state, and zero internal Bun/pnpm calls. It also replaces unsupported Git `branch --show-current` with `symbolic-ref` for Git 2.17 and forwards captured resume stderr. The 30-test Node artifact suite passes two frozen installs with spaces/Unicode and stable lockfiles. Node run `33257153599` and retained Bun run `33257153601` pass on Linux/macOS.
- [x] Complete real Node-orchestrated commits and pushes through run `01M16Z8A030MJZAHMZX554CJPM`: dotagents commit `10b5da5` and dotpi commits `5990b33` plus `3c1cf95` reached their remotes, all four Node/Bun CI runs (`33258149595`, `33258149602`, `33258151521`, `33258151486`) passed, and the terminal run is classified `drained` with no blocker. This migration closure record is itself committed through the canonical Node launch, permanently ending the direct-Git bootstrap exception.

## Phases 6 and 7 — dotagents packages and tests

- [x] Migrate `scripts`: all 16 retained surfaces now run through a closed `process.execPath` Node runner using `node:test` and `node:assert/strict`; the three CLIs use Node entrypoints and explicit ESM imports; stack-tools and the scanner consume the shared subprocess/YAML runtime plus `node:fs`; strict typecheck, 141 tests, three CLI smokes, parity validation, and two frozen installs in spaces/Unicode paths pass without invoking the Bun sentinel. The package-local Bun lock/configuration were removed only after Node run `33271564980` and Bun run `33271564979` established differential parity; the Bun baseline now executes against pnpm-locked dependencies, with cutover runs `33271871874` (Node 22.19/24 Linux/macOS) and `33271871906` (Bun 1.3.14 Linux/macOS) green.
- [x] Migrate `loop-clean/protocol` and its mutation runner: the controller launches its adjacent TypeScript CLI through Node; production Git, runtime-gate subprocess, and YAML paths use Node APIs with exact byte handling and `CORE_SCHEMA`; all 9 retained surfaces use `node:test`/strict assertions through a closed runner. Strict typecheck, 87 tests, the Git 2.17 path, autonomous isolated installation, and all 9 named mutants pass while preserving HEAD/index and routing observables. Two frozen installs in spaces/Unicode paths leave the Bun sentinel empty. Differential runs `33302922515` (Node) and `33302922514` (Bun) passed before the package Bun lock/configuration were removed; cutover runs `33303609674` (Node 22.19/24 Linux/macOS) and `33303609630` (Bun 1.3.14 Linux/macOS against pnpm-locked dependencies) are green.
- [x] Migrate `go`: both test files and the shared assertion helper now use a closed Node runner, `node:test`, and strict Node assertions while production stage-harness code remains byte-for-byte unchanged. All 26 acceptance cases and 8 property cases pass; exact `fast-check@3.23.2`, `numRuns: 8`, default seed selection, counterexample seeds, and shrink paths are preserved. Typecheck/lint, 34 tests, and two frozen installs in spaces/Unicode paths pass with an empty Bun sentinel. Differential runs `33304351573` (Node) and `33304351543` (Bun) passed before `skills/go/bun.lock` was removed; cutover runs `33304638852` (Node 22.19/24 Linux/macOS) and `33304638836` (Bun 1.3.14 Linux/macOS against pnpm-locked dependencies) are green.
- [x] Migrate agent-enforcer tests: 6 retained surfaces across command-validator, git-commits-push enforcement, path-guard, and permission state now use a symlink-aware closed Node runner and strict Node assertions. Relative production imports use explicit `.ts` specifiers; permission tests use the existing injected checker instead of mutable module spying. Targeted typecheck, 128 tests, the pre-existing 7 launch-recognition tests, scripts regressions, and two frozen installs in spaces/Unicode paths pass with an empty Bun sentinel. Node run `33314339244` and retained Bun run `33314339289` pass on Linux/macOS.
- [x] Migrate all remaining root tests: the final 35 `git-commits-push` surfaces use a closed sequential Node runner, `node:test`, strict Node assertions, explicit source resume/dequeue launches, injectable LLM boundaries, and isolated agent/order test environments. The source suite passes 325 tests across 126 suites with no agent identity, while the compiled runner adds bounded GitHub failure annotations. Differential runs `33370323093` (Node 22.19/24 Linux/macOS) and `33370323096` (Bun 1.3.14 Linux/macOS) are green before package-local Bun state removal. After removing the package Bun lock, Bun engine, Bun types, and obsolete compatibility aliases, cutover runs `33372313883` (Node) and `33372313860` (Bun against pnpm-locked dependencies) pass on Linux/macOS with all 74 parity surfaces green and pnpm lock SHA-256 `1b8436748c0754076f667692139b0daf3af08b855632a00653dacb651cd62a93`.
- [x] Complete every row in the 74-surface parity manifest.
- [x] Remove every package and root Bun lockfile only after differential parity passes; final dotagents lock SHA-256 is `3aed51d84692a597abc41fcecf2678525e4e689477274778a73054f4f61a9d04`.

## Phase 8 — dotpi tests

- [x] Create the independent dotpi pnpm project and lockfile.
- [x] Pin Pi 0.84.2, Jiti 2.7.0, TypeScript, and Node types locally.
- [x] Keep production extensions as Jiti-loaded TypeScript source.
- [x] Replace Bun resolution, query imports, implicit cache mocks, and absolute imports.
- [x] Complete every row in the 25-test parity manifest.
- [x] Keep pi-subagents-4-turnlock mechanically excluded.

## Phase 9 — Gateway portability

- [x] Link package metadata, workspace metadata, lockfiles, policy, source, and node_modules.
- [x] Validate physical roots and all gateways, including the shared-import `rootDirs` overlays.
- [x] Validate clean reinstall and rebuild in temporary homes and paths containing spaces and Unicode.
- [x] Validate with Bun absent and with a logging Bun failure sentinel.
- [x] Pass the High Sierra gateway smoke using the local Node wrapper.

## Phase 10 — Documentation and cleanup

- [x] Update active skills, agent guides, context routers, READMEs, CI, and examples at cutover.
- [x] Remove active Bun APIs, types, shebangs, lockfiles, obsolete bunfig files, and transitional launch syntax.
- [x] Remove active user-specific absolute paths.
- [x] Enforce the final exact Bun occurrence allowlists: 74/74 dotagents and 25/25 dotpi.
- [x] Retire required Bun parity CI after the last differential evidence.
- [x] Pass Node 22.19 and Node 24 on Linux and macOS, plus local typecheck, lint, tests, gateways, frozen installs, and High Sierra smoke. Final runs: dotagents `33405383157`, dotpi `33422658335`.
- [x] Confirm both repositories clean and the compiled preflight reports every Turnlock run drained with no lock, queue artifact, or migration blocker.

## Final closure

The Node-only platform is published at dotagents `3772ec4a135884953ff956479998acdfd5cad7c2` and dotpi `5ae546b7c9cefb34b25e4a5302672780441a7d95`. Historical sources are byte-exact archives outside active package and test boundaries. Required execution uses Node `>=22.19.0` and pnpm `11.24.0`; Bun remains only in exact policy-enforcement literals and optional external-project interoperability boundaries.
