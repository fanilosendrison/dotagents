---
id: NIB-T-GO-TURNLOCK-ORCHESTRATOR
type: nib-test
version: "1.0.0"
scope: go-turnlock-orchestrator/test-suite
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-T — `/go` Turnlock Orchestrator Test Suite

VegaCorp — July 2026

---

## 1. Purpose

This test brief specifies the behavioral verification suite for the `/go` orchestrator. It establishes the concrete scenarios, assertions, and execution environments that the RED suite must implement to validate state transitions, bootstrap task correctness, retry logic, and error handling.

---

## 2. Inputs

Test suite execution environments require the following input resources:
- A mocked Turnlock execution context representing `io` (including runtime clock, logger, and locks).
- A local filesystem workspace with mock Git configurations.
- Mocked Provider API REST endpoints (configured to return success, HTTP 409 Conflict, or HTTP 5xx errors).

- **Dependency Contracts**:
  - [NIB-S-GO-TURNLOCK-ORCHESTRATOR.md](./NIB-S-GO-TURNLOCK-ORCHESTRATOR.md)
  - [DC-TURNLOCK-RUNTIME-v0.9.md](../DC-TURNLOCK-RUNTIME-v0.9.md)
  - [DC-GIT-CLI-BOOTSTRAP.md](../DC-GIT-CLI-BOOTSTRAP.md)

---

## 3. Outputs

- Execution of the test runner (e.g. `bun test`) yielding passing reports.
- Correctly formatted `output.json` artifacts generated during tests.

---

## 4. Test Scenarios (RED Behavior Suite)

All scenarios below must be executed by the test framework to validate orchestrator logic.

### 4.1 Scenario 1: Nominal Flow & Prompt Emission
- **Setup**: Clean directory with a valid Git repository containing 1 commit. Valid token in `~/.go/config.json`. No local modifications.
- **Execution**: Run `fresh` start configuration.
- **Assertions**:
  - Phase `run-init` completes with status code `0`.
  - Process stdout outputs a valid `@@TURNLOCK@@` protocol block specifying a delegate call to `implementation-settlement`.
  - The generated delegate block contains the correct prompt parsed into `prompt`.
  - Directory `artefactRoot` contains `prerequisite-validation.json`, `repo-capture.json`, `run-capture.json`, `dirty-state-capture.json`, `work-session.json`, and `project-discovery.json`.
  - The `WorkSession` has `baseBranch: "main"` (or default branch name) and `dirtyStateDiffAdoption` is absent.

### 4.2 Scenario 2: Checkout Retry & Checkpoint Adoption
- **Setup**: Execute Scenario 1 first. Run a retry execution with identical input arguments and `skipSetup: true`.
- **Execution**: Run `resume` configuration.
- **Assertions**:
  - The task setups detect existing checkpoints `task-record.json` and matching `inputHash` digests.
  - No Git worktrees are added or initialized (the step is skipped).
  - Diagnostic containment validation passes.
  - Phase execution terminates successfully.

### 4.3 Scenario 3: Checkout Rebuild on Corruption
- **Setup**: Execute Scenario 1. Manually damage the `.git` file inside `workspaceRoot` and set `skipSetup: false`. Run retry.
- **Execution**: Run `resume` configuration.
- **Assertions**:
  - The checkpoint check detects the corrupted worktree.
  - The orchestrator executes `git worktree unlock`, `git worktree remove --force`, and `git worktree prune` to clean the repository metadata.
  - The orchestrator deletes the directory and successfully rebuilds a fresh worktree.
  - If a subsequent corruption is forced and `retryAttempt > 1`, the orchestrator throws a terminal `PhaseError` and aborts (no infinite loop).

### 4.4 Scenario 4: Prerequisite Failure Handling
- **Setup**: Configure `~/.go/config.json` with an invalid provider token.
- **Execution**: Run `fresh` start.
- **Assertions**:
  - The pipeline halts immediately during `validatePrerequisites`.
  - The orchestrator writes a terminal `task-record.json` checkpoint specifying `status: "failed"`.
  - The process exits with code `1`.
  - No repository capture or workspace creation is attempted.

### 4.5 Scenario 5: Dirty State Containment and Replay
- **Setup**: A Git repository containing modified tracked files. Policy `dirtyState.mode: "adopt-as-input"`.
- **Execution**: Run `fresh` start.
- **Assertions**:
  - `dirty-state-capture` successfully writes a `patch.diff` and a status evidence file.
  - `workspace-setup` validates and applies the binary patch inside the new worktree using `git apply --binary`.
  - The worktree's status after application matches the original dirty state.
  - If a path containment breach is simulated (e.g. `workspaceRoot` resolved outside `runDir`), the orchestrator aborts with `errored`.

### 4.6 Scenario 6: Project Discovery & STACK_EVAL
- **Setup**: A project directory containing a valid `STACK_EVAL.yaml` declaring biome linter and vitest test runner.
- **Execution**: Run `fresh` start.
- **Assertions**:
  - The heuristc scan is bypassed.
  - The linter command resolves to `npx biome check` (if npm package manager is selected).
  - The test command resolves to `npx vitest`.
  - If the config files (`biome.json`) are missing from the worktree, the task aborts and throws `failed`.
  - If `STACK_EVAL.yaml` contains invalid syntax, the task aborts with `failed`.

### 4.7 Scenario 7: Abort Signal Propagation
- **Setup**: Trigger parallel fork. Force `captureRunContext` task to reject/throw an exception.
- **Execution**: Run `fresh` start.
- **Assertions**:
  - The pipeline catches the rejection.
  - The shared `AbortController` triggers `abort()`.
  - Concurrent `captureDirtyState` task catches the abort signal and terminates immediately.
  - The pipeline throws a unified error and fails cleanly.

---

## 5. Example

### 5.1 Test Spec Assertion excerpt
```ts
import { expect, test } from "bun:test";
import { executeBootstrapPipeline } from "../src/orchestrator/pipeline.js";

test("Scenario 4: Invalid configuration halts validation fast", async () => {
  const mockConfig = {
    bootstrapState: {
      runId: "01JTESTRUNID00000000000000",
      artefactRoot: "/tmp/run/artifacts",
      workspaceRoot: "/tmp/run/workspace",
      policy: {
        dirtyState: { mode: "require-clean" }
      },
      captureContext: { sessionRef: "test-session" },
      invocationDirectory: "/tmp/project"
    },
    runDir: "/tmp/run",
    clock: { nowWallIso: () => "2026-07-16T18:00:00.000Z" }
  };

  // Run execution with invalid config
  expect(
    executeBootstrapPipeline(mockConfig)
  ).rejects.toThrow();
});
```

---

## 6. Edge cases

- **Git missing from PATH**: If git is not installed, prerequisite validation must throw a fatal assertion error (fail-closed).
- **Submodule init failure**: If submodules are invalid or unreachable during creation, the task must catch it and throw `errored`.

---

## 7. Constraints

- **ReadOnly Source Repository Invariant**: Test assertions must verify that the developer's source repository index files and head pointers are never modified during any bootstrap test scenario.
- **Redaction verification**: Tests must verify that log outputs and checkpoint files never contain the provider API token.

---

## 8. Integration

Run using the test harness execution command:

```bash
bun test
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
