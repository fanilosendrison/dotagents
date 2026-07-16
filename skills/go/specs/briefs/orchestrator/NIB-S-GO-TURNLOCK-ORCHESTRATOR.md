---
id: NIB-S-GO-TURNLOCK-ORCHESTRATOR
type: nib-system
version: "1.0.0"
scope: go-turnlock-orchestrator
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-S — `/go` Turnlock Orchestrator Phase 1

VegaCorp — July 2026

---

## 1. System objective

Establish the minimal, working, Turnlock-backed orchestrator skeleton for the `/go` workflow. It executes the bootstrap/onboarding phase (`run-init`), runs all internal startup tasks (prerequisite validation, repository capture, run capture, dirty-state capture, workspace setup, and project discovery), delegates execution to the agentic `implementation` prompt, and handles the resume phase (`implementation-settlement`) to conclude the run.

---

## 2. Construction scope

This System Brief covers the Phase 1 orchestrator structure and its in-process bootstrap tasks.

### 2.1 In Scope
- **Turnlock integration entrypoint**: `src/orchestrator/index.ts`.
- **FSM skeleton**: Exactly two phases (`run-init` and `implementation-settlement`).
- **Bootstrap tasks** (executed as parallel/sequential in-process tasks inside `run-init`):
  - Prerequisite validation (Git version, provider config).
  - Target repository capture (directory resolution, sentinel guards).
  - Run capture (user prompt, session reference).
  - Dirty-state capture (source repository diff).
  - Workspace setup (host-side Git worktree creation, LFS, submodules, patch replay).
  - Project discovery (ecosystem scanning, `STACK_EVAL.yaml` evaluation).
- **First delegation**: Emitting the `implementation` prompt and writing the delegation manifest.
- **Resume settlement**: Resuming from implementation, validating findings, and completing the workflow.
- **RED behavior test suite** verifying the complete startup sequence, resume, and error conditions.

### 2.2 Out of Scope
- OCI container sandboxing (deferred to Phase 1.b).
- Downstream stages (change-snapshot, conduct-settled, mechanical-gates, global review, packaging, PR publishing, CI review).
- Standalone CLI parsing beyond basic launch args required to call Turnlock.

---

## 3. Canonical types

The orchestrator uses the following TypeScript types mapped to Zod validation schemas:

```ts
type RuntimeState = BootstrapState | WorkflowState;

type BootstrapState = {
  schema: "go.bootstrap-state.v1";
  invocationDirectory: string;
  policy: WorkflowPolicy;
  captureContext: CaptureContext;
};

type WorkflowState = {
  schema: "go.workflow-state.v1";
  runId: string;
  runInit: RunInitRecord;
  policy: WorkflowPolicy;
  repository: RepositoryContext;
  currentStage: "implementation" | null;
  bootstrapTasks: BootstrapTaskRecord[];
  runCapture?: RunCaptureArtifact;
  workSession?: WorkSession;
  projectDiscovery?: ProjectDiscovery;
  bootstrapFindings?: any[];
  snapshots: any[];
  executionRecords: WorkflowExecutionRecord[];
  businessArtifacts: BusinessArtifactRecord[];
  checks: any[];
  findings: any[];
  humanGates: any[];
  remediations: any[];
  branches: any[];
  commits: any[];
  pullRequests: any[];
  mergeTracking: any[];
};

type RunInitRecord = {
  schema: "go.run-init.v1";
  runId: string;
  repoCapture: RepoCapture;
  repoCaptureHash: string;
  workflowPolicyHash: string;
  captureContextHash: string;
  turnlockRun: TurnlockRunRef;
  artefactRootRef: string;
  workflowLogRootRef?: string;
  workspaceRootReservedPath: string;
  ownershipMarkerRef: string;
  initializedAt: string;
  dirtyStateDiff?: DirtyStateDiffArtifact;
};

type RepoCapture = {
  schema: "go.repo-capture.v1";
  invocationDirectory: string;
  canonicalRepositoryRoot: string;
  projectRoot?: string;
  symlinkResolved: boolean;
  resolvedAt: string;
};

type TurnlockRunRef = {
  runId: string;
  runDirRef: string;
  stateFileRef: string;
  eventsRef?: string;
};

type RunInitOwnershipMarker = {
  schema: "go.run-init-ownership.v1";
  runId: string;
  turnlockRun: TurnlockRunRef;
  artefactRootRef: string;
  workflowLogRootRef?: string;
  workspaceRootReservedPath: string;
  repoCaptureHash: string;
  workflowPolicyHash: string;
  captureContextHash: string;
  createdAt: string;
};

type BootstrapTaskRecord = {
  task: BootstrapTaskName;
  status: "not-started" | "running" | "passed" | "failed" | "errored" | "cancelled";
  startedAt?: string;
  endedAt?: string;
  checkpointRef?: string;
  executionRecordId?: string;
  businessArtifactIds: string[];
  requiredBefore: WorkflowUnitName[];
};

type BootstrapTaskCheckpoint = {
  schema: "go.startup-task-checkpoint.v1";
  runId: string;
  task: BootstrapTaskName;
  status: "passed" | "failed" | "errored" | "cancelled";
  inputHash: string;
  repoCaptureHash: string;
  workflowPolicyHash: string;
  captureContextHash: string;
  businessArtifactIds: string[];
  evidenceRefs: string[];
  startedAt: string;
  endedAt: string;
};

type WorkflowExecutionRecord = {
  id: string;
  unit: string;
  envelopeKind: "stage-output" | "startup-output" | "turnlock-transition";
  startedAt: string;
  endedAt: string;
  artefactDir: string;
  outputJsonPath: string;
  status: "passed" | "failed" | "skipped" | "errored";
  evidenceRefs: string[];
  businessArtifactIds: string[];
  errors: any[];
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
};

type BusinessArtifactRecord = {
  id: string;
  unit: string;
  kind: string;
  schema: string;
  ref: string;
  executionRecordId: string;
  validationStatus: "passed" | "failed" | "errored";
};

type BootstrapTaskName =
  | "prerequisite-validation"
  | "repo-capture"
  | "dirty-state-capture"
  | "run-capture"
  | "workspace-setup"
  | "project-discovery-finalize";

type WorkflowUnitName = BootstrapTaskName | "implementation";

type RunCaptureArtifact = {
  schema: "go.run-capture.v1";
  id: string;
  runId: string;
  sessionRef: string;
  promptAtGoRef: string;
  promptHash: string;
  capturedAt: string;
};

type DirtyStateDiffAdoption = {
  captureArtifactId: string;
  replayedIntoWorkspace: boolean;
  workspaceStatusAfterReplayRef: string;
};

type WorkSession = {
  runId: string;
  repositoryRoot: string;
  sourceRepo?: string;
  workspaceRoot: string;
  workspaceProjectRoot?: string;
  artefactRoot: string;
  baseBranch: string | null;
  baseHeadSha: string;
  baseRemote?: string;
  defaultTargetBranch: string;
  dirtyStateDiffAdoption?: DirtyStateDiffAdoption;
  workBranch: string;
  workBranchCreatedAt: string;
};

type ProjectDiscovery = {
  provenance?: "draft-finalized" | "workspace-rerun";
  finalizedFromDraftId?: string;
  finalizedAgainstWorkspaceRoot: string;
  discoveryMethod: "stack-eval" | "ecosystem-scan";
  stackEvalRef?: string;
  inspectedFiles: any[];
  packageManager?: string;
  lockfiles: string[];
  commands: any[];
};
```

---

## 4. Execution architecture

### 4.1 FSM State Transitions
Phase 1 implements exactly 2 phases in the Turnlock FSM:

```text
Launch Fresh (args)
  ├── 1. Read /go env variables & entrypath
  └── 2. Call runOrchestrator(config)

Phase: run-init (Process 1)
  ├── 1. Validate BootstrapState
  ├── 2. Run Internal Bootstrap Pipeline (async tasks)
  ├── 3. Validate & Project Artifacts into WorkflowState
  └── 4. return io.delegate(promptReq, "implementation-settlement", workflowState)
        └── Exit 0 (writes manifest, protocol block, releases lock)

      [Process suspended: Turnlock waits for prompt results to be populated by parent]

Launch Resume (args + --resume + --run-id)
  └── Call runOrchestrator(config)

Phase: implementation-settlement (Process 2)
  ├── 1. const result = io.consumePendingResult(schema)
  └── 2. return io.done(state)
        └── Exit 0 (writes output.json, DONE block, releases lock)
```

### 4.2 Internal Bootstrap Pipeline Graph
Inside the `run-init` phase, the execution sequences as follows:

```text
run-init phase entry
  └── prerequisite-validation (sequential, fail-fast)
        └── repo-capture (sequential)
              ├── run-capture (parallel branch A)
              └── dirty-state-capture (parallel branch B)
                    └── workspace-setup (sequential)
                          └── project-discovery-finalize (sequential)
                                └── Join run-capture (validate final projection)
                                      └── Emit delegation
```

---

## 5. Module boundaries

### 5.1 M1 — GO-ORCHESTRATOR-BRIDGE
- **Inputs**: CLI process arguments.
- **Outputs**: Instantiated `OrchestratorConfig`.
- **Responsibility**: Wires Turnlock integration config, resolves entry points, intercepts fresh vs resume initial states, and wraps calls to `runOrchestrator`.

### 5.2 M2 — GO-ORCHESTRATOR-SCHEMAS
- **Responsibility**: Declares all Zod schemas v4 for validation of run states, config files, checklists, task records, and artifacts.

### 5.3 M3 — GO-CANONICAL-HASHING
- **Responsibility**: Provides deterministic hashing for files and JCS JSON serialization according to RFC 8785, plus prompt normalization (NFC Unicode, EOL LF conversion).

### 5.4 M4 — GO-BOOTSTRAP-PERSISTENCE
- **Responsibility**: Owns file structure under `artefactRoot/`, atomic temp-file+rename writes, path containment checks, checkpoint file writing (`task-record.json`), and retry quarantining.

### 5.5 M5 — GO-ASYNC-GIT-RUNNER
- **Responsibility**: Handles subprocess spawns via `Bun.spawn` asynchronously, drains standard streams safely (stdout captured in-memory, never inherited), and triggers lock lease refreshes during long Git operations.

### 5.6 M6 — GO-RUN-INIT-PIPELINE
- **Responsibility**: Coordinates the `run-init` internal task sequence, implements parallel AbortControllers, handles branch errors, performs join validation, and projects outputs into `WorkflowState`.

### 5.7 M7 — GO-PREREQUISITE-VALIDATION
- **Responsibility**: Performs environment verification (Git CLI presence/version, `ProviderConfig` syntax check) and exits early if prerequisites are absent.

### 5.8 M8 — GO-REPO-CAPTURE
- **Responsibility**: Inspects directory hierarchy upward from invocation directory, resolves realpaths, identifies repository roots, and rejects sentinels matching gateway roots.

### 5.9 M9 — GO-RUN-CAPTURE
- **Responsibility**: Writes user-provided prompt text to evidence files, hashes it deterministically, and produces the initial `RunCaptureArtifact`.

### 5.10 M10 — GO-DIRTY-STATE-CAPTURE
- **Responsibility**: Generates porcelain status and binary diff patches from the source repository to evaluate local modifications. Uses temporary indexes to keep the source repository unmodified.

### 5.11 M11 — GO-WORKSPACE-SETUP-CONTRACT
- **Responsibility**: Formulates the abstract boundaries of the private workspace (isolation, clean state, head immutability) regardless of workspace implementation strategies.

### 5.12 M12 — GO-WORKSPACE-SETUP-WORKTREE
- **Responsibility**: Executes the worktree creation commands (`git worktree add`), pulls LFS and submodules, applies dirty patch diffs, and validates HEAD state.

### 5.13 M13 — GO-PROJECT-DISCOVERY-FINALIZE
- **Responsibility**: Audits project dependencies and lockfiles against the private workspace, validates gate configurations, and flags blocking project conditions.

### 5.14 M14 — GO-PROJECT-DISCOVERY-REGISTRY
- **Responsibility**: Maintains the database of ecosystem indicators (JavaScript, Python, Rust, Go, etc.) to determine the project runtime type.

### 5.15 M15 — GO-IMPLEMENTATION-DELEGATION-STUB
- **Responsibility**: Compiles the implementation prompt context, issues the delegation structure, and implements the temporary `implementation-settlement` phase that wraps up Phase 1 by calling `io.done()`.

---

## 6. Global invariants

- **Snapshot-authoritative**: `state.json` written by Turnlock remains the sole execution truth. `/go` never writes or overrides `state.json` directly.
- **Fail-closed**: Any unexpected startup error, validation failure, path collision, or invalid schema terminates process execution instantly with code 1.
- **JSON-only data exchange**: All artifacts exchanged between tasks or stages are serialized JSON schemas or evidence files stored inside `artefactDir`.
- **State-authoritative progress**: All task milestones are tracked inside `WorkflowState.bootstrapTasks`.
- **Policy-authoritative decisions**: All execution decisions (such as dirty state adoption or gate enforcement) must be checked against `WorkflowState.policy`.
- **No stdout pollution**: `process.stdout` is strictly reserved for the `@@TURNLOCK@@` protocol block. All debug logs must go to `process.stderr`.
- **Exclusivity of Workspace**: The agent execution occurs entirely inside the isolated workspace (`worktree/` directory). No modifications are made to the developer's source repository during bootstrap.
- **No Token persistence**: API tokens must be verified in memory and never serialized to any artifact, checkpoint, state, or diagnostic log.
- **Containment of paths**: All paths resolved during bootstrap must reside within the allocated `runDir` parent namespace. No task may resolve external absolute paths using symlinks or directory escapes.

---

## 7. Cross-cutting policies

- **C1: Separation of Execution Concerns**: Turnlock manages transaction control, persistence, signal capturing, and exit boundaries. `/go` governs business logic schemas, task validation, and transition criteria.
- **C2: Atomic Task checkpoints**: Each startup task must serialize its execution outcome to a `task-record.json` checkpoint. On retry, tasks with matching input hashes are adopted without execution.
- **C3: Abort Propagation**: If any parallel bootstrap branch fails, the pipeline triggers the shared `AbortController`, cancels concurrent branches, waits for their exit, and errors the phase.
- **C4: Worktree verification on resume**: Resuming a process does not reconstruct the workspace. The setup task validates existing directories and checks HEAD compatibility.

---

## 8. Output contract

Upon successful completion, the orchestrator produces `output.json` under `<runDir>/output.json` containing the final `WorkflowState` JSON object.
The exit code of the final resume process is exactly `0`.

---

## 9. Orchestration pseudocode

```ts
import { definePhase, runOrchestrator } from "turnlock";

// Phase 1: Bootstrap & Onboard
export const runInitPhase = definePhase<object>(
  async (rawState, io) => {
    const validation = bootstrapStateSchema.safeParse(rawState);
    if (!validation.success) {
      return io.fail(new Error("run-init expects BootstrapState structure"));
    }
    const state = validation.data;
    
    // Execute async startup pipeline (M6)
    const workflowState = await executeBootstrapPipeline({
      invocationDirectory: state.invocationDirectory,
      policy: state.policy,
      captureContext: state.captureContext,
      runId: io.runId,
      runDir: io.runDir,
      logger: io.logger,
      clock: io.clock,
      signal: io.signal,
      refreshLock: () => io.refreshLock(),
    });
    
    const prompt = buildImplementationPrompt(workflowState);
    
    return io.delegate(
      { kind: "prompt", label: "implementation", prompt },
      "implementation-settlement",
      workflowState
    );
  }
);

// Phase 2: Resume & Terminate (stub for Phase 1)
export const implementationSettlementStub = definePhase<object>(
  async (state, io) => {
    const result = io.consumePendingResult(implementationResultSchema as any);
    
    // Conclude workflow
    return io.done(state);
  }
);
```

---

## 10. Required NIB-M set

The system construction requires the implementation of the 15 Module Briefs defined in Section 5. They must be placed under `specs/briefs/orchestrator/` and named `NIB-M-GO-*.md` in uppercase kebab-case.

---

## 11. Dependency contracts

Construction relies on the following Dependency Contracts:
- `DC-TURNLOCK-RUNTIME-v0.9.md`
- `DC-GIT-CLI-BOOTSTRAP.md`
- `DC-PROVIDER-APIS-GITHUB-GITLAB.md`
- `DC-ZOD-3-4-COMPAT.md`
- `DC-BUN-SPAWN-ASYNC-RUNTIME.md`

The implementing agent must verify that dependency usage adheres to these contracts.

---

## 12. Explicit non-goals

The following capabilities are excluded:
- Initializing OCI containers (OrbStack, Colima, Docker).
- Running downstream test checks or linter scripts.
- Packaging stacked commits or resolving PR reviews.

---

## 13. Construction consumption

This NIB-S is the authority for the system architecture. It must be consumed during RED to formulate the initial behavioral test suite, then during GREEN to write the production code.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
