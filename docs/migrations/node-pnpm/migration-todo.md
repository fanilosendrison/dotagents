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
- [ ] Complete remaining blocked items in the High Sierra prerequisite report.

## Phase 1 — Raw and green baselines

- [x] Add Bun 1.3.14 parity CI on Linux and macOS.
- [x] Build both gateways under an isolated temporary `HOME` in CI and retain baseline-only aliases for historical absolute imports.
- [x] Pin dotagents commit `3516a87e52b51e607fad387703a0b47c99751adf` exactly in dotpi CI.
- [x] Run the complete historical suite on Linux and macOS; run `32941370760` passes after isolated module-mock execution and portable HOME fixtures.
- [x] Fix pre-existing failures in separate green commits.
- [x] Annotate and publish both green baselines as `pre-node-pnpm-green`.
- [ ] Record every direct-Git bootstrap commit until Node self-hosting succeeds.
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

- [x] Add and test the shared subprocess API; 22 tests pass under Node 22.19.0 on High Sierra, and run `33095210333` passes on Node 22.19/24 Linux/macOS without Bun while retained Bun run `33095210322` passes on Linux/macOS.
- [x] Add exact `js-yaml@4.3.1` with explicit `CORE_SCHEMA`, Bun-compatible multi-document and alias semantics, duplicate/invalid-input errors, and differential vectors; Node run `33103539658` passes on Node 22.19/24 Linux/macOS without Bun and retained Bun run `33103539701` passes the historical suite plus the Bun 1.3.14 differential gate.
- [x] Add package-local NodeNext build configurations with declarations and source maps.
- [ ] Add deterministic asset copying.
- [ ] Add the explicit Node test runner with sequential execution, fixed timeouts, TAP or JUnit output, and a zero-discovery failure.
- [x] Start direct Node TypeScript stripping with a sequential `node:test` stats-logger smoke; Node run `32954252065` passes on Node 22.19.0/24 Linux/macOS without Bun, and retained Bun run `32954252069` passes on Linux/macOS.

## Phase 4 — Bootstraps and compatible recognition

- [ ] Migrate create-symlink bootstrap to `.mjs`.
- [ ] Migrate documentation bootstraps to `.mjs`.
- [ ] Compile skill-creator validation tooling.
- [ ] Accept both historical Bun and new pnpm commit-launch syntax.
- [ ] Deploy compatible recognition to dotpi and zero-timeout-filter.

## Phase 5 — git-commits-push cutover

- [ ] Compile both entrypoints and copy runtime assets.
- [ ] Replace the shell pipeline with a signal-safe Node supervisor.
- [ ] Preserve Turnlock-only stdout, exit codes, telemetry, queues, and retries.
- [ ] Drain or explicitly close historical runs before cutover.
- [ ] Point resume and queue launches to compiled artifacts through `process.execPath`.
- [ ] Pass trust-token, hook, secret-scanner, permissions, and leak gates.
- [ ] Pass the bare-remote self-hosting gate.
- [ ] Complete the first real Node-orchestrated migration commit and push.

## Phases 6 and 7 — dotagents packages and tests

- [ ] Migrate scripts.
- [ ] Migrate loop-clean protocol and mutation runner.
- [ ] Migrate go and preserve fast-check seeds and shrink paths.
- [ ] Migrate agent-enforcer tests.
- [ ] Migrate all remaining root tests.
- [ ] Complete every row in the 74-surface parity manifest.
- [ ] Remove each package Bun lockfile only after package parity passes.

## Phase 8 — dotpi tests

- [ ] Create the independent dotpi pnpm project and lockfile.
- [ ] Pin Pi 0.84.2, Jiti 2.7.0, TypeScript, and Node types locally.
- [ ] Keep production extensions as Jiti-loaded TypeScript source.
- [ ] Replace Bun resolution, query imports, implicit cache mocks, and absolute imports.
- [ ] Complete every row in the 25-test parity manifest.
- [ ] Keep pi-subagents-4-turnlock mechanically excluded.

## Phase 9 — Gateway portability

- [ ] Link package metadata, workspace metadata, lockfiles, policy, source, and node_modules.
- [ ] Validate physical roots and all gateways.
- [ ] Validate clean reinstall and rebuild in temporary homes and paths containing spaces.
- [ ] Validate with Bun absent and with a logging Bun failure sentinel.
- [ ] Pass the High Sierra gateway smoke using the local Node wrapper.

## Phase 10 — Documentation and cleanup

- [ ] Update active skills, agent guides, context routers, READMEs, CI, and examples at cutover.
- [ ] Remove active Bun APIs, types, shebangs, lockfiles, and obsolete bunfig files.
- [ ] Remove active user-specific absolute paths.
- [ ] Enforce the final Bun occurrence allowlist.
- [ ] Retire required Bun parity CI.
- [ ] Pass Node 22 and Node 24, Linux and macOS, typecheck, lint, tests, gateways, and High Sierra smoke.
- [ ] Confirm clean repositories and no abandoned Turnlock run or migration lock.
