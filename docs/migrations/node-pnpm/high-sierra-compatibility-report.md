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
- The prepared `turnlock@0.9.1` tarball installs cleanly and imports through Node ESM; published `turnlock@0.9.0` does not.
- jq 1.7.1 was built from the official release source after verifying source SHA-256 `478c9ca129fd2e3443fe27314b455e211e0d8c60bc8ff7df703873deeee580c2`; all jq and bundled Oniguruma tests pass under `LC_ALL=C` after a test-harness-only BSD `sed` compatibility correction.
- The locally compiled `~/.local/bin/jq` reports 1.7.1, has SHA-256 `5d1277d947b3106236efc43204b90afc2ac8b36b8ec6ee2da873b2b0e9622ee1`, and passes the JSON construction and query shapes used by loop-clean.
- The official jq macOS prebuild was checksum-valid but rejected because its Mach-O load command is unsupported on High Sierra; it was not installed.

## Blocked or missing

- Bun is absent, so the historical Bun 1.3.14 baseline cannot run on this host.
- The current Git version does not provide `git switch`; scripts must use Git 2.17-compatible commands or document a newer prerequisite.
- Node 24 is not installed on this host.

## Authentication bridge observation

The private Pi auth file currently contains no `api_key` entry, and the documented shared credential registry is absent. The jq credential bridge is therefore inactive and cannot be exercised end to end without first configuring it. This does not block the current non-API-key Pi authentication, but the documentation and private configuration are not aligned.

## Required completion evidence

1. Validate two clean frozen pnpm installations after repository manifests and lockfiles exist.
2. Run full loop-clean after Bun is available; its jq expressions already pass direct smoke tests.
3. Run physical-root and gateway suites after deleting `node_modules` and `dist`.
4. Run the no-Bun sentinel job.
5. Record Node 24 evidence on supported Linux and macOS CI.

Modern macOS CI must not substitute for these High Sierra checks.
