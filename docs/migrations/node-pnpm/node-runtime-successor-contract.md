---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "successor-contract"
domain: "runtime-migration"
severity: "strict"
name: "Node runtime successor for Bun-specific implementation clauses"
version: "0.1.0"
---

# Node runtime successor for Bun-specific implementation clauses

## Authority

This contract supersedes only runtime-specific clauses that require Bun APIs, Bun test infrastructure, Bun shebangs, or Bun launch commands in documents listed by `superseded-documents.json`. All business invariants, schemas, protocols, state transitions, security properties, and observable behavior in those documents remain authoritative.

## Runtime substitutions

Apply these substitutions without changing business behavior:

- `Bun.spawn` and `Bun.spawnSync` become the shared Node subprocess API;
- `Bun.file`, `Bun.write`, and Bun stdin streams become `node:fs/promises` and standard Node streams;
- `Bun.YAML` becomes `js-yaml` with an explicitly fixed schema;
- `Bun.argv` becomes `process.argv`;
- `import.meta.dir` becomes `import.meta.dirname` in Node-compatible source;
- `import.meta.main` becomes an explicit entrypoint comparison using file URLs and `process.argv[1]`;
- Bun timer types become `NodeJS.Timeout` or `ReturnType<typeof setInterval>`;
- Bun test APIs and matchers become `node:test` and `node:assert/strict`;
- Bun launch shebangs become Node `.mjs` bootstraps or compiled JavaScript entrypoints.

## Subprocess obligations

The shared Node API must cover shell-free argument arrays, explicit shell mode, cwd, environment, closed/text/stream stdin, separated output streams, exit codes, signals, missing executables, timeout, abort races, descendant termination, listener and timer cleanup, capture limits, backpressure, and paths containing spaces or non-ASCII characters.

## YAML obligations

The fixed schema and differential tests must cover booleans, numbers, null, duplicate keys, multiple documents, aliases, invalid YAML, and actionable errors. Runtime parsing must not rely on package-manager-specific coercion defaults.

## TypeScript obligations

Compiled packages use NodeNext module and resolution settings, rewritten relative import extensions, package-local roots and outputs, source maps, deterministic asset copying, and untracked `dist/`. Directly executed tests satisfy `erasableSyntaxOnly`.

## Non-superseded behavior

Turnlock stdout isolation, atomic writes, fail-closed validation, deterministic state transitions, queue semantics, Git behavior, telemetry schemas, security controls, and gateway behavior are unchanged.
