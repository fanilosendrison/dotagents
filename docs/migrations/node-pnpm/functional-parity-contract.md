---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "contract"
domain: "runtime-migration"
severity: "strict"
name: "Node and pnpm functional parity contract"
version: "0.1.0"
---

# Node and pnpm functional parity contract

## Scope

The migration may change dependency installation, compilation, development and launch commands, and test infrastructure. It must not change business behavior.

The contract applies to active dotagents surfaces and direct dotpi extension tests. The upstream `extensions/pi-subagents-4-turnlock/**` tree is excluded.

## Required parity

Every migrated surface must preserve:

- Turnlock protocol versions, manifests, state schemas, delegation kinds, resume behavior, and fail-closed validation;
- stdout and stderr channel ownership, including Turnlock-only orchestrator stdout;
- process exit codes and signal outcomes;
- telemetry namespaces, event types, detail fields, timestamps, session identifiers, and destination semantics;
- trust-token issuance, one-shot consumption, permissions, and fail-closed behavior;
- secret-scanner findings, warning boundaries, blocking decisions, and redaction;
- Git discovery, validation, commit splitting, mutation order, hooks, pushes, and non-interactive execution;
- durable order identifiers, queue ordering, lock leases, stale-lock handling, retries, fallback boundaries, and dequeue behavior;
- gateway path semantics and temporary-home behavior;
- mutation names, property-test seeds, shrink paths, fixtures, and observable test vectors.

## Permitted differences

The following differences are permitted only when they do not alter the required parity surface:

- Bun APIs replaced by Node standard-library APIs or the shared Node runtime;
- Bun test matchers replaced by named strict-assert helpers;
- TypeScript source replaced by compiled JavaScript launch artifacts;
- Bun lockfiles replaced by repository-local pnpm lockfiles after parity gates pass;
- public launch syntax changed to the canonical pnpm command;
- internal resume and queue launches changed to `process.execPath` and compiled artifacts;
- test report encoding changed to TAP or JUnit while retaining test identity and outcomes.

## Evidence required per package

A package is green only when its parity-manifest rows are complete and the following evidence passes:

1. historical Bun parity CI against pnpm-installed dependencies during transition;
2. Node 22.19 test execution;
3. Node 24 test execution;
4. package build and typecheck;
5. lint;
6. observable output, exit, telemetry, filesystem, and Git comparisons;
7. gateway execution where the package is gateway-addressable;
8. no undeclared Bun invocation in the required no-Bun job.

## Fail-closed rule

Missing evidence, an unclassified observable difference, a changed protocol field, an unexpected test count, or an unallowlisted Bun occurrence fails the migration gate. Production code must not be changed solely to accommodate an artificial matcher difference introduced by `deepStrictEqual`.
