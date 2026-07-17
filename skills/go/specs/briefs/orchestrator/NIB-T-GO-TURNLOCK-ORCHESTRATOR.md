---
id: NIB-T-GO-TURNLOCK-ORCHESTRATOR
type: nib-test
version: "2.1.0"
scope: go-turnlock-orchestrator/test-suite
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-T — `/go` Turnlock Orchestrator Test Suite

VegaCorp — July 2026

---

## 1. Purpose

This test brief specifies the behavioral verification suite for the `/go` orchestrator. It establishes the concrete scenarios, assertions, and execution environments that the RED suite must implement to validate state transitions, bootstrap task correctness, retry logic, error handling, token safety, session settlement, and hashing invariants.

GREEN Layer 1 companion checks (exports, constants, schema instantiation, type aliases, file tree shape, trivial constructors) are explicitly excluded from this NIB-T. They belong in a companion checklist managed separately per [PLAN-GO-TURNLOCK-ORCHESTRATOR-PHASE-1.md §9.1](./PLAN-GO-TURNLOCK-ORCHESTRATOR-PHASE-1.md).

---

## 2. Inputs

Test suite execution environments require the following input resources:

### 2.1 Fixture Interfaces

Each scenario must be backed by concrete fixture builders. The following interfaces define the minimum required shape:

```ts
interface FixtureContext {
  /** Deterministic clock — MUST inject a fixed clock, never Date.now() */
  clock: { nowWallIso: () => string; nowWall: () => Date };
  /** Temporary source repository path (created per-test, cleaned on teardown) */
  sourceRepoDir: string;
  /** Temporary run root path */
  runDir: string;
  /** artefactRoot inside runDir */
  artefactRoot: string;
  /** workspaceRoot inside runDir */
  workspaceRoot: string;
  /** Turnlock io mock */
  io: MockedPhaseIO;
  /** AbortController shared across pipeline tasks */
  abortController: AbortController;
}
```

### 2.2 Required Resources

- A mocked Turnlock execution context representing `io` (including `delegate`, `done`, `consumePendingResult`, runtime clock, logger, locks, signal).
- A local filesystem workspace with mock Git configurations (initialized repositories, controlled commit history).
- Mocked Provider API REST endpoints (configured to return success, HTTP 409 Conflict, or HTTP 5xx errors).
- `~/.go/config.json` fixture templates (valid token, invalid format, missing file).
- Deterministic injected clock (e.g. fixed to `"2026-07-16T18:00:00.000Z"`).

### 2.3 Dependency Contracts

- [NIB-S-GO-TURNLOCK-ORCHESTRATOR.md](./NIB-S-GO-TURNLOCK-ORCHESTRATOR.md)
- [DC-TURNLOCK-RUNTIME-v0.9.md](./DC-TURNLOCK-RUNTIME-v0.9.md)
- [DC-GIT-CLI-BOOTSTRAP.md](./DC-GIT-CLI-BOOTSTRAP.md)
- [DC-PROVIDER-APIS-GITHUB-GITLAB.md](./DC-PROVIDER-APIS-GITHUB-GITLAB.md)
- [DC-BUN-SPAWN-ASYNC-RUNTIME.md](./DC-BUN-SPAWN-ASYNC-RUNTIME.md)

---

## 3. Outputs

- Execution of the test runner (e.g. `bun test`) yielding passing reports.
- Correctly formatted `output.json` artifacts generated during tests.
- Task-record checkpoint files written to `<artefactRoot>/startup/<task-name>/task-record.json`.
- Verbose test output written to `stderr` only (no `stdout` pollution).

---

## 4. Test Scenarios (RED Behavior Suite)

Each scenario below includes a `validates` tag referencing the NIB-M module(s) it exercises.

### 4.1 Scenario 1: Nominal Flow & Prompt Emission

- **Validates**: NIB-M-GO-RUN-INIT-PIPELINE, NIB-M-GO-PREREQUISITE-VALIDATION, NIB-M-GO-REPO-CAPTURE, NIB-M-GO-RUN-CAPTURE, NIB-M-GO-DIRTY-STATE-CAPTURE, NIB-M-GO-WORKSPACE-SETUP-CONTRACT, NIB-M-GO-PROJECT-DISCOVERY-FINALIZE, NIB-M-GO-IMPLEMENTATION-DELEGATION-STUB
- **Setup**: Clean directory with a valid Git repository containing 1 commit on `main`. Valid provider token in `~/.go/config.json` (format: `ghp_xxxxxxxxxxxxxxxxxxxx`). No local modifications. Injected clock returning `"2026-07-16T18:00:00.000Z"`.
- **Execution**: Call `executeBootstrapPipeline(mockConfig)` with `BootstrapState` formed from the above.
- **Assertions**:
  1. Phase `run-init` completes with status code `0`.
  2. `io.delegate` is called exactly once with:
     - `req.label === "implementation"`
     - `resumeAt === "implementation-settlement"`
  3. Process stdout outputs a `@@TURNLOCK@@DELEGATE:{...}@@END@@` protocol block (not a generic `@@TURNLOCK@@` prefix).
  4. The delegate block JSON payload contains a `prompt` string field.
  5. The artefact tree under `artefactRoot` contains these files at the exact subdirectory paths:
     - `<artefactRoot>/startup/prerequisite-validation/task-record.json`
     - `<artefactRoot>/startup/repo-capture/task-record.json`
     - `<artefactRoot>/startup/run-capture/task-record.json`
     - `<artefactRoot>/startup/dirty-state-capture/task-record.json`
     - `<artefactRoot>/startup/workspace-setup/task-record.json` and `<artefactRoot>/startup/workspace-setup/work-session.json`
     - `<artefactRoot>/startup/project-discovery-finalize/task-record.json`
     - `<artefactRoot>/run-init-ownership.json`
  6. The `WorkSession` inside `work-session.json` has:
     - `baseBranch === "main"`
     - `dirtyStateDiffAdoption` is absent (`undefined` or `null`)
  7. `WorkflowState.currentStage === "implementation"`.
  8. Source repository tracked content is unchanged (verify via `git diff --exit-code` on source repo).

### 4.2 Scenario 2: Checkpoint Adoption & Workspace Skip

- **Validates**: NIB-M-GO-BOOTSTRAP-PERSISTENCE, NIB-M-GO-WORKSPACE-SETUP-WORKTREE
- **Setup**: Execute Scenario 4.1 first to produce valid checkpoints. Run a retry execution with identical input arguments, `skipSetup: true`, and matching `inputHash` digests across all task checkpoints.
- **Execution**: Call `executeBootstrapPipeline` with same `BootstrapState` and `skipSetup: true`.
- **Assertions**:
  1. Each bootstrap task reads its existing `<artefactRoot>/startup/<task-name>/task-record.json` checkpoint.
  2. All checkpoints have matching `inputHash`, `repoCaptureHash`, `workflowPolicyHash`, and `captureContextHash` against current run parameters.
  3. Tasks are skipped (no re-execution). No Git worktrees are added or initialized.
  4. `realpath(workspaceRoot).startsWith(realpath(runDir))` — workspace is contained within runDir.
  5. The `.git` file inside `workspaceRoot` (if worktree) is a valid gitdir pointer.
  6. Phase execution terminates successfully with exit code `0`.

### 4.3 Scenario 3: Worktree Rebuild on Corruption

- **Validates**: NIB-M-GO-WORKSPACE-SETUP-WORKTREE, NIB-M-GO-BOOTSTRAP-PERSISTENCE
- **Setup**: Execute Scenario 4.1. Manually damage the `.git` file inside `workspaceRoot` (replace with invalid content). Set `skipSetup: false`.
- **Execution**: Run with same `BootstrapState` (resume context).
- **Assertions**:
  1. The checkpoint check detects the corrupted worktree (`.git` file malformed or missing).
  2. The orchestrator executes `git worktree unlock`, `git worktree remove --force`, and `git worktree prune` to clean repository metadata.
  3. The orchestrator deletes the directory and successfully rebuilds a fresh worktree.
  4. After rebuild, the worktree HEAD matches the expected `baseHeadSha`.
  5. If a subsequent corruption is forced and `retryAttempt > 1` (tracked in checkpoint's optional `retryAttempt` field), the orchestrator throws a terminal `PhaseError` and aborts with exit code `1` (no infinite loop).

### 4.4 Scenario 4: Prerequisite Failure & Token Redaction

- **Validates**: NIB-M-GO-PREREQUISITE-VALIDATION, NIB-M-GO-ORCHESTRATOR-SCHEMAS
- **Setup**: Configure `~/.go/config.json` with an invalid provider token (e.g. `"token": "invalid-format-no-prefix"`).
- **Execution**: Call `executeBootstrapPipeline` with fresh `BootstrapState`.
- **Assertions**:
  1. The pipeline halts immediately during `validatePrerequisites` before any other task.
  2. The orchestrator writes a terminal task-record checkpoint at:
     `<artefactRoot>/startup/prerequisite-validation/task-record.json`
     with `status: "failed"`.
  3. The process exits with code `1`.
  4. No repository capture or workspace creation is attempted (no directories under `startup/` for repo-capture, dirty-state-capture, workspace-setup, or project-discovery-finalize).
  5. **Token Redaction**: Recursively read all JSON files under `artefactRoot/` and verify that no field value matches any known token prefix pattern (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `glpat-`). The token string must never appear in any artifact, checkpoint, or marker.
  6. Grep `stderr` output (captured during test) for the token value — zero hits required.

### 4.5 Scenario 5: Dirty State Containment & Replay

- **Validates**: NIB-M-GO-DIRTY-STATE-CAPTURE, NIB-M-GO-WORKSPACE-SETUP-CONTRACT, NIB-M-GO-WORKSPACE-SETUP-WORKTREE
- **Setup**: A Git repository containing 2 modified tracked files (one staged, one unstaged). Policy set to `dirtyState.mode: "adopt-as-input"`.
- **Execution**: Call `executeBootstrapPipeline` with fresh `BootstrapState`.
- **Assertions**:
  1. `dirty-state-capture` writes a `patch.diff` evidence file and a porcelain status evidence file under `<artefactRoot>/startup/dirty-state-capture/evidence/`.
  2. `workspace-setup` pre-validates the patch using `git apply --check --binary` before applying.
  3. `workspace-setup` applies the validated binary patch inside the new worktree using `git apply --binary`.
  4. The worktree's `git -c core.quotePath=false status --porcelain` output, when sorted line-by-line, is byte-identical to the original source repository's porcelain status output (same file set, same status codes, same paths).
  5. `DirtyStateDiffAdoption` in the `WorkSession` has:
     - `replayedIntoWorkspace === true`
     - `workspaceStatusAfterReplayRef` pointing to `"startup/workspace-setup/evidence/status-after-replay.txt"`.
  6. If a path containment breach is simulated (e.g. `realpath(workspaceRoot)` resolves outside `realpath(runDir)`), the orchestrator aborts with `errored` and exit code `1`.
  7. **Temp index cleanup**: The temporary Git index file created by `dirty-state-capture` (e.g. `<artefactRoot>/startup/dirty-state-capture/tmp/index`) must not exist after the pipeline completes, regardless of success or failure (per NIB-M-GO-DIRTY-STATE-CAPTURE §4.4 step 6 and §7).

### 4.6 Scenario 6: Project Discovery & STACK_EVAL

- **Validates**: NIB-M-GO-PROJECT-DISCOVERY-FINALIZE, NIB-M-GO-PROJECT-DISCOVERY-REGISTRY
- **Setup**: A project directory containing a valid `STACK_EVAL.yaml` declaring `biome` as linter and `vitest` as test runner, with corresponding config files (`biome.json`, `vitest.config.ts`) present in the worktree.
- **Execution**: Call `executeBootstrapPipeline` with fresh `BootstrapState`.
- **Assertions**:
  1. `ProjectDiscovery.provenance === "workspace-rerun"` (per NIB-M-GO-PROJECT-DISCOVERY-FINALIZE §4.5 — always `"workspace-rerun"` in Phase 1).
  2. `discoveryMethod === "stack-eval"`.
  3. The heuristic scan is bypassed (`inspectedFiles` contains no heuristic-detected entries).
  4. The linter command resolves to `npx biome check`.
  5. The test command resolves to `npx vitest`.
  6. If the required config files (`biome.json`) are missing from the worktree, the task aborts with `status: "failed"`.
  7. If `STACK_EVAL.yaml` contains invalid YAML syntax, the task aborts with `status: "failed"`.

### 4.7 Scenario 7: Abort Signal Propagation

- **Validates**: NIB-M-GO-RUN-INIT-PIPELINE, NIB-M-GO-ASYNC-GIT-RUNNER
- **Setup**: Trigger parallel fork with `captureRunContext` task configured to reject with a known error. No other errors configured.
- **Execution**: Call `executeBootstrapPipeline` with fresh `BootstrapState`.
- **Assertions**:
  1. The pipeline catches the rejection from `captureRunContext`.
  2. The shared `AbortController` triggers `abort()`.
  3. Concurrent `captureDirtyState` task catches the abort signal and terminates immediately without side effects.
  4. The pipeline throws a unified error.
  5. The process exits with code `1`.
  6. No checkpoint is guaranteed to be written by a cancelled task (NIB-M-GO-RUN-INIT-PIPELINE §4.2 does not mandate checkpoint writes on cancellation). The test must verify only that `Promise.allSettled` completes and that the pipeline throws a unified error. Checkpoint-on-cancel behavior, if observed, must not collide with existing artifacts.

### 4.8 Scenario 8: Implementation-Settlement Resume

- **Validates**: NIB-M-GO-IMPLEMENTATION-DELEGATION-STUB
- **Setup**: Execute Scenario 4.1 to completion. Capture the delegation output artifact (`delegations/implementation-1.json` under runDir). Launch resume with `--resume --run-id <runId>`.
- **Execution**: Call the Turnlock resume entry point with `BootstrapState` and the existing run directory.
- **Assertions**:
  1. The phase `implementation-settlement` is entered (not `run-init`).
  2. `io.consumePendingResult` is called exactly once with `implementationResultSchema` (the Zod `.passthrough()` object defined in NIB-M-GO-ORCHESTRATOR-SCHEMAS §5).
  3. `io.done(state)` is called after consuming the pending result.
  4. The process exits with code `0`.
  5. `<runDir>/output.json` is written and contains the final `WorkflowState`.
  6. stdout outputs a `@@TURNLOCK@@DONE:{...}@@END@@` protocol block (not `DELEGATE`).

### 4.9 Edge-Case Scenarios

Each edge case below is a standalone test that validates a specific failure mode from the NIB-M edge-case sections.

#### 4.9.1 Malformed `~/.go/config.json`

- **Validates**: NIB-M-GO-PREREQUISITE-VALIDATION §6
- **Setup**: `~/.go/config.json` contains invalid JSON (`{ token: "ghp_xxx" }` — missing quotes around key).
- **Assertions**: Pipeline throws `failed` with message containing "Failed to parse ~/.go/config.json". Exit code `1`.

#### 4.9.2 Bare Repository Rejection

- **Validates**: NIB-M-GO-REPO-CAPTURE §4.2
- **Setup**: Source directory is a bare Git repository (created via `git init --bare`).
- **Assertions**: `repo-capture` rejects with `failed`. Pipeline aborts before workspace setup.

#### 4.9.3 Gateway Sentinel Rejection

- **Validates**: NIB-M-GO-REPO-CAPTURE §4.4
- **Setup**: Source directory resolves to a path matching a gateway sentinel (e.g. path contains `.agents/`, `.pi/`, `.codex/`, `.gravity/`).
- **Assertions**: `repo-capture` rejects with `failed`. Pipeline aborts.

#### 4.9.4 Detached HEAD (Non-Empty Repository)

- **Validates**: NIB-M-GO-WORKSPACE-SETUP-CONTRACT §4.1
- **Setup**: Source Git repository with at least one commit, but HEAD is detached (e.g. `git checkout --detach`).
- **Assertions**: `workspace-setup` handles detached HEAD gracefully. `baseBranch` is `null`. Pipeline does not crash.

> **Note on empty repositories**: If the source repo has zero commits, NIB-M-GO-WORKSPACE-SETUP-CONTRACT §6 mandates that the strategy initializes a base commit before creating the work branch, producing a non-null `baseBranch`. The empty-repo path is exercised indirectly through the worktree creation flow and does not require a dedicated edge-case scenario.

#### 4.9.5 Empty Dirty-State Patch

- **Validates**: NIB-M-GO-DIRTY-STATE-CAPTURE §6
- **Setup**: Source repository has dirty files in `git status --porcelain` but `git diff` produces an empty patch (e.g. file mode changes only).
- **Assertions**: `dirty-state-capture` writes an empty evidence file or sets `initialDirtyState: "clean"`. Pipeline continues.

#### 4.9.6 Git LFS Binary Missing

- **Validates**: NIB-M-GO-WORKSPACE-SETUP-WORKTREE §4.2
- **Setup**: Source repository has `.gitattributes` with LFS filter patterns. `git lfs` is not installed on `PATH`.
- **Assertions**: `workspace-setup` calls `git lfs pull`, the command fails, and the task errors with `status: "errored"`.

#### 4.9.7 Abort After Completion Race

- **Validates**: NIB-M-GO-RUN-INIT-PIPELINE §4.2
- **Setup**: Parallel branch A completes successfully before branch B rejects. Controller is aborted after A finishes.
- **Assertions**: Pipeline correctly records A's successful checkpoint and B's error. Process exits with code `1` (pipeline error takes precedence over partial success).

#### 4.9.8 Empty-Collection Invariant — Non-Empty Rejection

- **Validates**: NIB-S-GO-TURNLOCK-ORCHESTRATOR §3 (Phase 1 empty-collection invariant), NIB-M-GO-ORCHESTRATOR-SCHEMAS §4.4
- **Setup**: A crafted `WorkflowState` payload where `snapshots: [{ id: "forced", stage: "implementation" as any }]` — i.e., any of the nine Phase 2+ fields contains at least one element.
- **Assertions**: `workflowStateSchema.parse(payload)` must throw a `ZodError`. The error path must reference the offending field. Repeat for each of the nine constrained fields: `snapshots`, `checks`, `findings`, `humanGates`, `remediations`, `branches`, `commits`, `pullRequests`, `mergeTracking`. `executionRecords` and `businessArtifacts` are exempt: they are legitimately populated in Phase 1.

### 4.10 Property Tests

The following properties must hold across all valid inputs. Implement as parameterized/fuzz tests.

| ID | Property | Verification Method | NIB-M Source |
| --- | --- | --- | --- |
| P1 | JCS-serialized semantically identical objects produce identical SHA-256 hashes. | `hash(serialize({a:1, b:2})) === hash(serialize({b:2, a:1}))` | NIB-M-GO-CANONICAL-HASHING |
| P2 | RFC 8785 test vectors produce expected JCS output. | Compare against known RFC 8785 example vectors. | NIB-M-GO-CANONICAL-HASHING |
| P3 | Prompt hash normalization is stable across CRLF/LF line endings. | `normalize("a\r\nb") === normalize("a\nb")` | NIB-M-GO-CANONICAL-HASHING |
| P4 | Prompt hash normalization is stable across Unicode NFC/NFD forms. | `normalize("é") === normalize("e\u0301")` | NIB-M-GO-CANONICAL-HASHING |
| P5 | All evidence refs in `BootstrapTaskCheckpoint.evidenceRefs` are relative paths contained under `artefactRoot`. | For each ref: `realpath(resolve(artefactRoot, ref)).startsWith(realpath(artefactRoot))` | NIB-M-GO-BOOTSTRAP-PERSISTENCE |
| P6 | Checkpoint adoption is idempotent: `adopt(cp, ctx) === adopt(adopt(cp, ctx), ctx)`. | Double adoption produces same result as single adoption. | NIB-M-GO-BOOTSTRAP-PERSISTENCE §4.5 |
| P7 | Any hash mismatch (`inputHash`, `repoCaptureHash`, etc.) prevents checkpoint adoption. | Force mismatches one at a time; each must cause fresh task execution. | NIB-M-GO-BOOTSTRAP-PERSISTENCE §4.5 |
| P8 | Child process stdout is never written to parent stdout (except Turnlock protocol block). | `Bun.spawn` with `stdout: "pipe"` captured in-memory, never inherited. | NIB-M-GO-ASYNC-GIT-RUNNER |
| P9 | Source repository tracked content is unchanged by any bootstrap task. | `git diff --exit-code HEAD` on source repo before and after pipeline. | NIB-S-GO-TURNLOCK-ORCHESTRATOR §6 |
| P10 | Work branch name has the exact format `work/<runId>`. | RunId must be a valid ULID. Regex: `/^work\/[0-7][0-9A-HJKMNP-TV-Z]{25}$/` | NIB-M-GO-WORKSPACE-SETUP-CONTRACT §3 |

---

## 5. Example

### 5.1 Test Spec Assertion Excerpt (Prerequisite Failure)

```ts
import { expect, test } from "bun:test";
import { executeBootstrapPipeline } from "../src/orchestrator/pipeline.js";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

test("Scenario 4: Invalid configuration halts validation fast & redacts token", async () => {
  const runDir = mkdtempSync("/tmp/go-test-");
  const artefactRoot = join(runDir, "artifacts");
  mkdirSync(artefactRoot, { recursive: true });

  const mockConfig = {
    bootstrapState: {
      runId: "01JTESTRUNID00000000000000",
      artefactRoot,
      workspaceRoot: join(runDir, "workspace"),
      policy: { dirtyState: { mode: "require-clean" } },
      captureContext: { sessionRef: "test-session" },
      invocationDirectory: "/tmp/project",
    },
    runDir,
    clock: { nowWallIso: () => "2026-07-16T18:00:00.000Z" },
  };

  // Run execution with invalid config (no valid token)
  await expect(
    executeBootstrapPipeline(mockConfig)
  ).rejects.toThrow();

  // Verify artefact root only contains prerequisite-validation
  const startupDirs = readdirSync(join(artefactRoot, "startup"));
  expect(startupDirs).toEqual(["prerequisite-validation"]);

  // Verify no token leaked into any artifact
  const allFiles = readdirSync(artefactRoot, { recursive: true });
  for (const file of allFiles.filter(f => f.endsWith(".json"))) {
    const content = readFileSync(join(artefactRoot, file), "utf-8");
    expect(content).not.toMatch(/ghp_|gho_|ghu_|ghs_|ghr_|glpat-/);
  }
});
```

### 5.2 Property Test Example (JCS Determinism)

```ts
import { test, expect } from "bun:test";
import { hash, serialize } from "../src/hashing.js";

test("P1: JCS deterministic hashing", () => {
  const a = { a: 1, b: [2, 3], c: { d: "e" } };
  const b = { b: [2, 3], c: { d: "e" }, a: 1 };

  expect(hash(serialize(a))).toBe(hash(serialize(b)));
});
```

---

## 6. Constraints

### 6.1 Read-Only Source Repository Invariant

Test assertions must verify that the developer's source repository index files and head pointers are never modified during any bootstrap test scenario. Verify after each scenario using:

```bash
git -C <sourceRepoDir> diff --exit-code HEAD
git -C <sourceRepoDir> ls-files --modified
```

### 6.2 Token Redaction Invariant

All test scenarios (nominal and error paths) must verify that provider API tokens never appear in:

- Any artifact file under `artefactRoot/` (recursively scan `.json`)
- Any checkpoint `task-record.json` fields
- `stderr` output captured during execution
- Error messages or exception strings

Recursive scan must check all string-typed JSON values against known token prefix patterns:

`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `glpat-`.

### 6.3 Contract Invariants

Every successful fresh run MUST satisfy:

- The pipeline produces a valid `WorkflowState` conforming to the schema in NIB-S §3.
- `WorkflowState.runId` equals the Turnlock `runId`.
- `currentStage` is `"implementation"` while the first delegation is pending.
- All projected bootstrap task records refer to valid business artifacts with non-empty `businessArtifactIds`.
- All evidence refs are relative paths contained within `artefactRoot`.
- No token field is projected into `WorkflowState`.
- The first delegation label is exactly `"implementation"`.
- The first resume phase is exactly `"implementation-settlement"`.

### 6.4 Deterministic Execution

All tests must use a deterministic injected clock. No test may use `Date.now()`, `new Date()`, or any ambient time source. The injected clock must return fixed ISO-8601 strings (e.g. `"2026-07-16T18:00:00.000Z"`).

---

## 7. Scenario-to-NIB-M Coverage Map

```text
Scenario                        NIB-M(s) Covered                                Edge Cases Covered
───────────────────────────────────────────────────────────────────────────────────────────────
4.1 Nominal Flow                RUN-INIT-PIPELINE, PREREQUISITE-VALIDATION,      None (happy path)
                                REPO-CAPTURE, RUN-CAPTURE,
                                DIRTY-STATE-CAPTURE, WORKSPACE-SETUP-CONTRACT,
                                PROJECT-DISCOVERY-FINALIZE,
                                IMPLEMENTATION-DELEGATION-STUB
4.2 Checkpoint Adoption         BOOTSTRAP-PERSISTENCE,                           Skip-setup mode,
                                WORKSPACE-SETUP-WORKTREE                         .git file validity
4.3 Worktree Rebuild            WORKSPACE-SETUP-WORKTREE,                        Corrupt checkpoint,
                                BOOTSTRAP-PERSISTENCE                            retryAttempt > 1
4.4 Prerequisite Failure        PREREQUISITE-VALIDATION,                         Invalid token format,
                                ORCHESTRATOR-SCHEMAS                             no token redaction bypass
4.5 Dirty State Containment     DIRTY-STATE-CAPTURE,                             Path containment breach,
                                WORKSPACE-SETUP-CONTRACT,                        patch pre-validation
                                WORKSPACE-SETUP-WORKTREE
4.6 STACK_EVAL Discovery        PROJECT-DISCOVERY-FINALIZE,                      Missing config files,
                                PROJECT-DISCOVERY-REGISTRY                       invalid YAML
4.7 Abort Propagation           RUN-INIT-PIPELINE,                               Parallel cancellation
                                ASYNC-GIT-RUNNER
4.8 Implementation Settlement   IMPLEMENTATION-DELEGATION-STUB                   consumePendingResult,
                                                                                 io.done terminal
4.9.1 Malformed Config          PREREQUISITE-VALIDATION                          Malformed JSON
4.9.2 Bare Repository           REPO-CAPTURE                                     Bare repo rejection
4.9.3 Gateway Sentinel          REPO-CAPTURE                                     Sentinel pattern match
4.9.4 Detached HEAD             WORKSPACE-SETUP-CONTRACT                         baseBranch null, detached HEAD
4.9.5 Empty Patch               DIRTY-STATE-CAPTURE                              Empty diff after status
4.9.6 LFS Missing               WORKSPACE-SETUP-WORKTREE                         lfs pull failure
4.9.7 Abort After Completion    RUN-INIT-PIPELINE                                Late cancellation race
4.9.8 Empty-Collection Guard    ORCHESTRATOR-SCHEMAS                             Nine fields reject non-empty []
4.10 Property Tests (P1-P10)    CANONICAL-HASHING,                               All hash/containment/
                                BOOTSTRAP-PERSISTENCE,                           isolation invariants
                                ASYNC-GIT-RUNNER,
                                WORKSPACE-SETUP-CONTRACT
```

---

## 8. Integration

Run using the test harness execution command:

```bash
bun test
```

All scenarios must pass on both fresh and resumed orchestrator configurations. No test may depend on system-wide Git hooks or ambient environment variables beyond `PATH`, `HOME`, and `TMPDIR`.

---

## 9. References

- [PLAN-GO-TURNLOCK-ORCHESTRATOR-PHASE-1.md §9.1](./PLAN-GO-TURNLOCK-ORCHESTRATOR-PHASE-1.md) — authoritative test-design checklist
- [NIB-S-GO-TURNLOCK-ORCHESTRATOR.md](./NIB-S-GO-TURNLOCK-ORCHESTRATOR.md) — system architecture & canonical types
- [DC-TURNLOCK-RUNTIME-v0.9.md §2.2](./DC-TURNLOCK-RUNTIME-v0.9.md) — protocol block format
- [NIB-M-GO-BOOTSTRAP-PERSISTENCE.md §4.1](./NIB-M-GO-BOOTSTRAP-PERSISTENCE.md) — directory / artefact layout

GREEN Layer 1 companion checks (exports, constants, schema instantiation, type aliases, file tree shape, trivial constructors) are explicitly excluded from this RED test brief. They belong in a separate GREEN Layer 1 companion checklist as specified by [PLAN-GO-TURNLOCK-ORCHESTRATOR-PHASE-1.md §9.1](./PLAN-GO-TURNLOCK-ORCHESTRATOR-PHASE-1.md).

---

## 10. Deferred Coverage (Known Limitations)

The following areas are explicitly deferred and are not covered by this RED suite. Each deferral is intentional and tracked as a known limitation for a future hardening pass (v2 scope):

- **`git worktree repair` diagnostic path (Git ≥ 2.31)**: Scenario 4.3 tests the destroy-and-rebuild reconstruction path only. The repair-in-place path defined in NIB-M-GO-WORKSPACE-SETUP-WORKTREE is deferred.
- **`runDirRoot` default resolution when `TURNLOCK_RUN_DIR_ROOT` is absent**: Fixtures always provide an explicit `runDir`; default `.turnlock/runs` behavior is owned by the Turnlock runtime (DC-TURNLOCK-RUNTIME-v0.9) and is not re-tested here.
- **`apiEndpoint` default fallback for GitHub/GitLab**: Scenarios use mocked provider API endpoints; live default endpoint resolution is deferred.
- **Submodule init failure during workspace setup**: NIB-M-GO-WORKSPACE-SETUP-WORKTREE specifies that `git submodule update --init --recursive` failure resolves to `errored`; a dedicated edge-case scenario is deferred.
- **Temp-file cleanup across all error paths**: Assertion 7 of Scenario 4.5 covers the `dirty-state-capture` temporary index only. A global temp-artifact sweep across every task and error path is deferred.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
