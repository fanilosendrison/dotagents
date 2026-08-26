---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "dependency-audit"
workspace: "dotagents and dotpi"
date: "2026-08-25"
step_id: 0
---

# Migration dependency audit

## Immutable registry metadata verified

- `turnlock@0.9.0` declares Node.js 22 or newer and resolves with integrity `sha512-J4zJO+YG+PVaRGGov5zaSvtGbyU8kPP23V/mGhLyHRDK3jJ/hdPZ8GpPfW0F8P+5qjvHFJED4AJsNq8B0ONcvg==`.
- `@fanilosendrison/llm-runtime@0.1.2` declares Node.js 20 or newer and resolves with integrity `sha512-yoej2g21eF693bOTdB4ufsIcCrxUC740rUVTe7a/xYdUwSICxR4MlmxeRpwKf8hpQ6QCcJqqlwiW2MgUL9MADg==`.
- `jiti@2.7.0` resolves with integrity `sha512-AC/7JofJvZGrrneWNaEnJeOLUx+JlGt7tNa0wZiRPT4MY1wmfKjt2+6O2p2uz2+skll8OZZmJMNqeke7kKbNgQ==`.
- `@earendil-works/pi-coding-agent@0.84.2` declares Node.js 22.19.0 or newer and resolves with integrity `sha512-l4E+B7hgXKWddRo8bC/eSue2aWZjEgJ9xIpf5p0Og+lq8a2TArCwJ0HCoCPCgaBP/tN4zbYH/wOwvx9pJpeLCA==`.
- The installed Pi distribution contains Pi AI 0.84.2, Pi TUI 0.84.2, Jiti 2.7.0, Node types 22.19.19, Photon WASM, Darwin terminal-modifier prebuilds, and optional clipboard native artifacts.

## Exact distributed-package audit

The four exact registry tarballs were downloaded without executing scripts, and each local SHA-512 matches its recorded registry integrity. None declares `preinstall`, `install`, `postinstall`, or `prepare` lifecycle scripts.

### Turnlock

`turnlock@0.9.0` is not executable under its declared Node runtime. An isolated pnpm installation followed by `await import("turnlock")` deterministically fails with `ERR_MODULE_NOT_FOUND` because the published ESM contains extensionless relative imports such as `./constants`. This reproduces with Node 22.19.0 before any consumer code runs.

The authoritative repository was cloned from `https://github.com/fanilosendrison/turnlock`. A patch release was prepared from tag `v0.9.0` at `21bd35e82f782a40031c472d47a7b87c5385989f` on branch `fix/node-esm-package`. The maintenance commit stack prepares `turnlock@0.9.1`: package fix `e27b053564833017db4bb7c46e85cb3db5aa0e70`, clean-tree typecheck fix `191e6fc8d9bff988f7195b3bc703397562f3c486`, and Bun discovery isolation `d6fdc6ad0f88978ee3f1c8d882d5bfd7183715b1`. The release candidate uses NodeNext output, explicit rewritten runtime extensions, a Node import test, a TypeScript consumer test, and Bun 1.3.14 plus Node 22.19/24 Linux/macOS CI.

The prepared package contains the same 150 distributed files. Canonical comparison of all 74 JavaScript and declaration outputs proves no semantic output difference other than module specifiers and harmless import formatting. Clean tarball installation and Node import pass. The initial `npm pack` audit artifact at release-candidate HEAD `d6fdc6ad0f88978ee3f1c8d882d5bfd7183715b1` has SHA-512 `464605828b828efa231219f1feb9880b72aff1d3ce56b0a1bfd04b686051ba6c9580f14863c9dad77c25258a20d62ee3acf5f82973c7d9121d2032b67648ea90`. `pnpm publish` normalizes only the distributed `package.json` by reordering scripts and removing the publish-time `prepack` hook; it does not change runtime fields, dependencies, exports, or any other distributed file.

The published `turnlock@0.9.1` tarball is reproduced byte-for-byte by `pnpm pack`. Both have SHA-512 `e379aeecb5207f472f579b417cfd5d115c706e55b190a72b80c52b26534ffb083ac97282f8d81a94d49daabe26e8e9931b1cbae49ed6121f0915483e44177d29`, registry integrity `sha512-43mu7LUgf0cvV5tBfP1dEVxwblWxkKcrgMUrJlNP+wg6yXKC+NgalNSdqr4m6OmTGxy65J7WEh8JFUg+RBd9KQ==`, and shasum `ab8e1898bd7c5bf7492ac9ee42fdb9f9169e0764`. An exact registry installation with lifecycle scripts disabled passes Node ESM runtime import and strict NodeNext TypeScript consumer compilation.

Cross-platform branch CI run `32897464178` and annotated-tag CI run `32898343128` pass Bun 1.3.14 and Node 22.19/24 on Linux and macOS. Tag `v0.9.1` points to the release-candidate HEAD, and the registry `latest` dist-tag resolves to 0.9.1.

### LLM runtime and Jiti

`@fanilosendrison/llm-runtime@0.1.2` ships 139 files, two runtime dependencies, no native artifact, no process spawning, no Bun runtime reference, and no lifecycle script. Its 20 exported bindings import successfully on High Sierra.

`jiti@2.7.0` ships 16 files, no runtime dependency, no native artifact, no lifecycle script, and no Bun runtime reference. Its development scripts mention optional Bun test lanes, but the shipped loader is Node-compatible. An isolated Jiti instance successfully loads and evaluates an erasable TypeScript fixture on High Sierra.

### Pi distribution

`@earendil-works/pi-coding-agent@0.84.2` ships 972 files and no install lifecycle script. Its runtime contains no Bun reference. Process spawning is explicit in shell, tool, clipboard, browser, editor, RPC, and Git integration modules. The direct tarball contains only an example WASM artifact; Photon WASM, terminal modifiers, and clipboard native artifacts arrive through declared dependencies.

An isolated pnpm graph installs 131 packages with no known high-severity vulnerability; `node-domexception@1.0.0` is deprecated. Root import, the `pi --version` CLI, Jiti TypeScript loading, Darwin terminal-modifier loading, native clipboard loading and resolution fallback, and Photon WASM image construction all pass on High Sierra.

Pi 0.84.2 declares caret ranges for its internal packages. pnpm therefore resolves Pi Agent Core, AI, Client, Protocol, and TUI to 0.84.3 unless constrained, unlike the package's npm shrinkwrap and the installed 0.84.2 distribution. The future dotpi pnpm manifest must override all six internal packages to exact 0.84.2:

- `@earendil-works/pi-agent-core`
- `@earendil-works/pi-ai`
- `@earendil-works/pi-client`
- `@earendil-works/pi-protocol`
- `@earendil-works/pi-telemetry`
- `@earendil-works/pi-tui`

The distributed examples contain one upstream maintainer absolute path and the changelog contains one illustrative absolute glob. Neither is imported by runtime code. The project Bun allowlist does not apply to third-party development scripts or examples under ignored `node_modules`.

## Final lock graph audit

The independent pnpm 11.24.0 lockfiles are materialized and reproducible. Dotagents lock SHA-256 is `7b7ca6b4c92f138738c25105ec73b5a9044e432c552f2652f70917cc320873c7`; it contains exactly 10 importers. Dotpi lock SHA-256 is `34e6bad6d8693880e6380cfcc684850b9827d2b25a480a081dcad25fe1b3cd05`; it contains only the root importer and excludes `extensions/pi-subagents-4-turnlock/**`. Two independent frozen installations per repository leave both locks unchanged. Both final graphs report zero known vulnerabilities at every severity.

The installed dotagents graph contains 21 unique packages and 3,483 distributed files. It declares no install lifecycle, native binary, or WASM artifact. Its runtime and tooling versions match the retained Bun locks except for `js-yaml`: the Bun-resolved 4.3.0 is vulnerable to `GHSA-5p4m-2wfm-xmqj` / `CVE-2026-59870`, so both manifests and locks intentionally select patched 4.3.1. No active source import of `js-yaml` exists in the audited tree.

The installed dotpi graph contains 133 unique packages and 14,299 distributed files. Fifteen packages retain lifecycle declarations, but no lifecycle was executed during either frozen installation. Fourteen declarations are publish-time `prepare` scripts or the `@google/genai` no-op preinstall; `protobufjs@7.6.5` declares the sole postinstall. The six native artifacts are the previously validated Pi TUI Darwin/Windows modifiers and optional Darwin clipboard binaries. The two WASM artifacts are the non-runtime Doom extension example and the previously executed Photon image module. The sole deprecation remains `node-domexception@1.0.0`.

All six Pi internal packages resolve exclusively to 0.84.2; no 0.84.3 package is present. Event-sink resolves to 0.1.0, Turnlock to 0.9.1, Pi Coding Agent/AI/TUI to 0.84.2, and Jiti to 2.7.0. Comparison against all seven Bun locks retains type-only drift in transitive `@types/node` and `undici-types`; dotpi now declares exact `@types/node@22.20.0` for its direct Node test surface while Bun and third-party transitives retain their independently locked type versions. Biome is held at the Bun-validated 2.5.2 and `@types/bun` at the Bun CI version 1.3.14.

## Event-sink package audit

The authoritative source was cloned from `https://github.com/fanilosendrison/event-sink` at commit `e62176dc44c5eddeb9d9ba46a8887eee55977364`. Its event envelope, atomic writer, error behavior, public API, and 41 test vectors were audited before packaging.

The prepared immutable identity is `@fanilosendrison/event-sink@0.1.0`. The package declares Node.js 22.19.0 or newer, exact pnpm 11.24.0, NodeNext ESM, TypeScript declarations, zero runtime dependencies, and `UNLICENSED` licensing because the source repository contains no license grant.

All 41 tests pass through `node:test`; typecheck, Biome 2.5.2, build, two clean frozen installations, publish dry-run, tarball inspection, and clean tarball installation smoke pass on High Sierra. The final local tarball SHA-512 is `f4f986f4770b03c036e500a8b4b289be451041bb448146ae5912fcda60084fbba35163cc5f60b6780fe3e23cede7670c096b276abded158f2b44a343ad308d99`.

The release source is committed as `e75692f34ef212c9ad173a37a73539f35f54c6ff` with annotated tag `v0.1.0`; both are pushed and GitHub CI run `32896680948` passes. The exact package is published as `@fanilosendrison/event-sink@0.1.0` with registry integrity `sha512-9PmG9HcLA8A25QCotLKJvkUQQbtEgUauWRL82mAIT7ujUWPMX2C2eA/j4jzt52cMCWsnar3tFY8rRKNDrTCNmQ==` and shasum `b2ce1c2bfcac2f142317d0b84ed3a7062c3234c1`. Its decoded SHA-512 exactly matches the sealed local tarball, and an exact clean registry installation with lifecycle scripts disabled passes the public-API smoke test. Its consumer manifest and final repository lock now pin the exact verified release.

## Gate status

`SECOND_RUNTIME_PORTABILITY_LOT_IN_PROGRESS`

The publication, manifest, lockfile, integrity, clean-install, transitive-file, vulnerability, Bun baseline, and green-tag gates are closed. The first runtime portability lot replaces dotpi event-sink source imports with the exact published package. Node run `32947362470` passes on Node 22.19.0/24 Linux/macOS with the Bun failure sentinel untouched, and retained Bun run `32947362415` passes all 25 historical surfaces on Linux/macOS.

The second lot replaces the git-commits-push stats logger source import with exact event-sink 0.1.0, removes the dotagents CI source alias, and preserves the telemetry envelope in a direct Node smoke. Local Node 22.19.0, physical and gateway paths, frozen install, no-Bun sentinel, Bun-lock integrity, and vulnerability gates pass; cross-platform Node 22/24 and retained Bun CI remain pending.
