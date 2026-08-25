---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "markdown-adr"
title: "Adopt Node.js and pnpm for active harness surfaces"
status: accepted
workspace: "dotagents and dotpi"
date: "2026-08-25"
step_id: 6
supersedes: "None"
author: [VegaCorp]
tags: [architecture, nodejs, typescript, pnpm]
---

# Adopt Node.js and pnpm for active harness surfaces

## Context

Active dotagents programs and tests, plus direct dotpi extension tests, depend on Bun-specific APIs, Bun test matchers, Bun lockfiles, and user-specific absolute imports. Dotagents and dotpi are independent Git repositories, but their active gateways and tests cross repository boundaries.

The migration must remove Bun as a runtime requirement without changing Turnlock protocol behavior, output channels, exit codes, telemetry, security enforcement, Git mutation behavior, queues, or gateway semantics. The minimum target is Node.js 22.19.0 with validation on Node.js 24, TypeScript, pnpm 11.24.0 through Corepack, and `node:test` with `node:assert/strict`. High Sierra compatibility is mandatory.

## Decision

Node.js 22.19.0 or newer is the required runtime, TypeScript is the implementation language, and pnpm 11.24.0 is the exact package manager for all active in-scope surfaces.

Dotagents and dotpi each own an independent `pnpm-lock.yaml`. Complex dotagents programs are compiled with `tsc`; erasable TypeScript tests execute directly through Node's native type stripping; dependency-free bootstraps use `.mjs`; and Pi production extensions remain TypeScript source loaded by Jiti 2.7.0.

Active Bun APIs, types, shebangs, and lockfiles are removed after package-level parity gates pass. Bun literals remain only when listed in a machine-readable allowlist for optional interoperability with external Bun projects or when contained in explicitly excluded upstream or historical material.

## Alternatives Considered

- **Keep Bun as a required runtime**: This retains duplicate runtime installation and test infrastructure, prevents the requested High Sierra-first Node baseline, and leaves active code dependent on Bun-only APIs.
- **Use Bun for tests but Node for production**: This fails to validate actual Node runtime semantics and preserves Bun test types, mocks, matchers, and lockfiles.
- **Execute complex production TypeScript without compilation**: Node type stripping does not transform every TypeScript syntax and does not provide deterministic production artifacts or asset copying.
- **Add a third-party TypeScript loader for tests**: Node 22.19.0 already supports erasable TypeScript syntax; another loader adds unnecessary runtime and configuration burden.
- **Share one lockfile across dotagents and dotpi**: The repositories have independent Git roots, release histories, installations, and gateway lifecycles.
- **Compile Pi production extensions**: Pi 0.84.2 intentionally loads TypeScript extensions through Jiti; changing that deployment model is outside the migration scope.

## Consequences

### Pros

- Establishes one mandatory runtime and one exact package manager.
- Tests production behavior under Node rather than under a compatibility runtime.
- Provides independent, reproducible dependency graphs for both repositories.
- Removes active user-specific source imports and Bun-only APIs.
- Preserves optional evaluation and commit support for external Bun projects.
- Supports deterministic builds, assets, test discovery, and gateway reconstruction.

### Cons

- Requires package-local build configuration and generated `dist/` artifacts.
- Requires explicit subprocess and YAML compatibility layers where Bun previously supplied built-ins.
- Requires maintaining Node 22 and Node 24 CI plus a High Sierra smoke environment.
- Requires a documented Bun interoperability allowlist and enforcement sweep.
- Requires temporary dual lockfile and historical Bun CI maintenance during parity migration.
- Requires immutable publication of the external event-sink package before implementation can proceed.
- Requires careful draining of persisted Turnlock runs and queues before the commit orchestrator cutover.

## References

- [Node.js TypeScript documentation](https://nodejs.org/api/typescript.html)
- [Node.js test runner documentation](https://nodejs.org/api/test.html)
- [Node.js assertion documentation](https://nodejs.org/api/assert.html)
- [pnpm workspaces documentation](https://pnpm.io/workspaces)
- [Corepack documentation](https://nodejs.org/api/corepack.html)
- [TypeScript `erasableSyntaxOnly`](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html)
- [Pi extension documentation](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/docs/extensions.md)
