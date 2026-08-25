---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "policy"
domain: "testing"
severity: "strict"
name: "Node migration test-retention policy"
version: "0.1.0"
---

# Node migration test-retention policy

## Inventory boundary

The dotagents parity manifest contains exactly 74 Bun-coupled test surfaces: 73 test files and one shared assertion helper. The dotpi parity manifest contains exactly 25 direct test files. The upstream pi-subagents-4-turnlock tree is not part of either direct migration count.

Every source surface must retain one manifest row until migration completion. Rows may not be deleted to make counts pass.

## Required row fields

Each row must retain:

- Bun source file;
- Node target file;
- role as test or helper;
- mechanically extracted test-case names;
- table-driven declaration count;
- detected assertion families;
- parity status;
- explicit justification for every normative change.

A renamed target must preserve the source path in the row. A deleted test requires explicit user approval and a normative-change justification; infrastructure convenience is not sufficient.

## Assertion mapping

Use these default mappings:

- `toBe` to `assert.strictEqual`;
- `toEqual` to `assert.deepStrictEqual`;
- `toMatchObject` to `assert.partialDeepStrictEqual`;
- `toThrow` to `assert.throws`;
- asynchronous rejection matchers to `assert.rejects`;
- comparisons and collection matchers to named, independently tested helpers.

Matcher differences must not cause production behavior changes. Where Bun matcher semantics are intentionally looser, preserve the business assertion through a named helper rather than mutating production output.

## Runtime rules

Tests use `node:test` and `node:assert/strict`. Initial concurrency is one. Numeric Bun timeouts become Node test options. Module-level seams use dependency injection rather than experimental module mocks. `mock.fn()` and `mock.method()` must be restored after every test.

TypeScript test syntax must satisfy `erasableSyntaxOnly`; no third-party loader and no experimental module-mock flag are permitted.

## Property and mutation retention

Fast-check seeds and shrink paths must remain visible in failures. Mutation names and counts must remain identical. Generated fixtures must use `node:test`. The mutation workspace must include the pnpm workspace root, lockfile, required manifests, and offline dependency state.

## Completion rule

A row becomes `green` only after its Node test passes, historical parity evidence passes, observable behavior is compared, and any matcher or fixture change is documented. The manifests must report 74 green dotagents surfaces and 25 green dotpi surfaces at completion.
