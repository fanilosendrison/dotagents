---
id: PLAN-GO-TURNLOCK-ORCHESTRATOR-PHASE-1
type: construction-plan
scope: go-turnlock-orchestrator-phase-1
status: active
---

# Plan - `/go` Turnlock Orchestrator Phase 1

This document records the approved construction plan for the minimal Turnlock
orchestrator used by the `/go` workflow in Phase 1.

It is a planning document only. It is not a NIB, not a Dependency Contract, and
not an implementation artifact. Its purpose is to define the future brief set
to write before RED/GREEN construction starts.

## 1. Objective

Phase 1 establishes a minimal working Turnlock orchestrator around the existing
`/go` workflow contracts.

The target behavior is:

```text
fresh invocation
-> build BootstrapState
-> run Turnlock runOrchestrator(config)
-> execute run-init
-> produce initial WorkflowState
-> emit implementation delegation
-> exit through Turnlock protocol
-> resume into implementation-settlement
-> consume implementation result
-> transition to dummy-phase
-> done
```

This phase proves that `/go` can enter a Turnlock-managed run, perform the
bootstrap work required before agentic implementation, delegate once, and resume
from the persisted snapshot.

## 2. Source Documents

The future briefs must be derived from the active design documents below:

- `../../roadmap.md`
- `../../CONTEXT.md`
- `../../working/orchestrator/turnlock-bridge.md`
- `../../contracts/go-workflow-contract.md`
- `../../contracts/workflow-artifacts.md`
- `../../working/run-init/run-init.md`
- `../../working/run-init/prerequisite-validation.md`
- `../../working/run-init/repo-capture.md`
- `../../working/run-init/run-capture.md`
- `../../working/run-init/dirty-state-capture.md`
- `../../working/run-init/workspace-setup.md`
- `../../working/run-init/workspace-setup.worktree.md`
- `../../working/run-init/project-discovery-finalize.md`
- `../../standards/canonical-hashing.md`
- `../../standards/external-primitives.md`
- `../../standards/canonical-vocabulary.md`
- `../stage-harness/`

The stage harness is already implemented. The orchestrator briefs must consume
its public contract where needed and must not re-specify or reimplement it.

## 3. Scope

Phase 1 includes:

- A Turnlock-backed `/go` orchestrator entrypoint.
- The minimal `RuntimeState` union:
  `BootstrapState | WorkflowState`.
- A Zod schema set for all Phase 1 state and artefacts.
- The `run-init` Turnlock phase.
- The internal bootstrap tasks of `run-init`.
- Host-side Git worktree workspace setup.
- Project discovery from `STACK_EVAL.yaml` or deterministic ecosystem scan.
- The first `implementation` prompt delegation.
- A temporary `implementation-settlement` phase.
- A temporary `dummy-phase` terminal phase.
- Behavioral RED tests for the observable Phase 1 contract.

Phase 1 excludes:

- OCI sandbox workspace setup.
- Any Docker, OrbStack, Colima, Podman, or Lima implementation.
- Real downstream stages after implementation settlement.
- Pull request publishing.
- Packaging, package verification, branch materialization, and CI review.
- Re-specification of the stage harness internals.
- A standalone CLI beyond what is required to invoke the orchestrator entry.
- A second lock, retry, resume, event, or state runtime outside Turnlock.

## 4. Runtime Boundary

Turnlock owns:

- `state.json`.
- The runtime lock.
- Runtime event logging.
- Run id generation and validation.
- Phase dispatch.
- Resume dispatch.
- Signal handling.
- Protocol blocks on stdout.
- Atomic persistence of stable transitions.

`/go` owns:

- The shape of `StateFile.data`.
- The workflow policy snapshot.
- The bootstrap task graph.
- The typed business artefacts.
- The implementation delegation prompt.
- The interpretation of bootstrap findings.

The future NIB-S must make this boundary explicit. `/go` must not create a
parallel runtime for locking, journaling, retries, resume, stdout protocol, or
atomic state persistence.

## 5. Phase 1 FSM

The roadmap says "two initial phases", but the current bridge design is more
precise. Phase 1 must document three runtime phases:

```text
run-init
  -> io.delegate(label="implementation", resumeAt="implementation-settlement")

implementation-settlement
  -> io.consumePendingResult(...)
  -> io.transition("dummy-phase", state)

dummy-phase
  -> io.done(...)
```

`implementation-settlement` is required because Turnlock requires a resume
phase to consume the pending delegation result. `dummy-phase` is a temporary
terminal placeholder that keeps the FSM complete until Phase 2 replaces it with
the next real stage wiring.

> **Errata (superseded by the brief set).** This section was written against
> Turnlock v0.8, which supported `io.transition()`. Turnlock v0.9
> ([DC-TURNLOCK-RUNTIME-v0.9.md](./DC-TURNLOCK-RUNTIME-v0.9.md), "No
> transition chaining") removed transition chaining, so `dummy-phase` is
> unreachable. The realized Phase 1 FSM has exactly two phases —
> `run-init -> implementation-settlement` — with `implementation-settlement`
> terminal via `io.done()`. All `dummy-phase` references in this plan,
> including the `DC-TURNLOCK-RUNTIME-v0.8.md` naming, are superseded by
> [NIB-S-GO-TURNLOCK-ORCHESTRATOR.md §4.1](./NIB-S-GO-TURNLOCK-ORCHESTRATOR.md).

## 6. Future Brief Set

The approved brief set is:

- One System Brief.
- Fifteen Module Briefs.
- One TDD Tests Brief.
- Five Dependency Contracts.

The expected directory is:

```text
specs/briefs/orchestrator/
```

The construction briefs should use the same metadata conventions and section
style as `../stage-harness/`.

## 7. System Brief

### 7.1 `NIB-S-GO-TURNLOCK-ORCHESTRATOR.md`

Purpose:

- Define the complete Phase 1 orchestrator system.
- Establish the Turnlock runtime boundary.
- Define the Phase 1 FSM.
- Define module boundaries and data flow.
- Define global invariants and cross-cutting policies.
- Define the target file tree for future implementation.
- Define the final output contract of Phase 1.

Required contents:

- System objective.
- Construction scope and non-goals.
- Runtime boundary between Turnlock and `/go`.
- Pipeline architecture.
- Module boundary list for all NIB-Ms.
- Canonical `run-init` graph.
- Phase 1 FSM:
  `run-init -> implementation-settlement -> dummy-phase`.
- Global invariants.
- Cross-cutting policies.
- Output contract.
- Orchestration pseudocode.
- Dependency Contract references.
- TDD brief reference.

Key global invariants:

- State-authoritative after `run-init`.
- Turnlock snapshot-authoritative at runtime level.
- Policy-authoritative for workflow decisions.
- Fail-closed on missing, invalid, or ambiguous evidence.
- JSON-only between workflow units.
- Typed business artefacts for durable payloads.
- No hidden judgment in mechanical transitions.
- No stdout pollution outside Turnlock protocol blocks.
- No token persistence.
- No source repository mutation during bootstrap except explicit new-repo
  initialization in workspace setup.
- Artefacts remain outside the workspace.
- The work agent never operates in the source repository.
- Bootstrap branches never mutate `WorkflowState` directly.

Explicit exclusions:

- OCI sandbox.
- Real implementation stage logic.
- Real stage chain after `dummy-phase`.
- Stage harness internals.
- PR, package, and CI workflows.

## 8. Module Briefs

### 8.1 `NIB-M-GO-ORCHESTRATOR-BRIDGE.md`

Purpose:

- Specify how `/go` consumes Turnlock.
- Define the entrypoint shape and `OrchestratorConfig`.
- Define fresh versus resume initial state behavior.

Primary source:

- `../../working/orchestrator/turnlock-bridge.md`

Required contents:

- Package dependency on Turnlock.
- `runOrchestrator(config)` invocation.
- `definePhase` usage.
- Phase registry:
  `run-init`, `implementation-settlement`, `dummy-phase`.
- `GO_ENTRY_PATH` resolution.
- `resumeCommand(runId)`.
- `runDirRoot` resolution.
- `logging` policy.
- Zod 4 to Turnlock Zod 3 cast boundary.
- `buildInitialState()` behavior:
  fresh invocation builds real `BootstrapState`;
  resume invocation builds a valid dummy `BootstrapState` without I/O.
- Boundary with `NIB-M-GO-RUN-INIT-PIPELINE`.

Out of scope:

- Bootstrap task algorithms.
- State schema internals beyond references to the schema module.
- Git command details.

### 8.2 `NIB-M-GO-ORCHESTRATOR-SCHEMAS.md`

Purpose:

- Define all Zod schemas required by the Phase 1 orchestrator.
- Convert the shared TypeScript contracts from `workflow-artifacts.md` into
  runtime validation schemas.

Primary sources:

- `../../contracts/workflow-artifacts.md`
- `../../contracts/go-workflow-contract.md`
- `../../working/orchestrator/turnlock-bridge.md`

Required schemas:

- `BootstrapState`.
- `WorkflowState`.
- `RuntimeState`.
- `WorkflowPolicy` and all sub-policies.
- `CaptureContext`.
- `RepoCapture`.
- `RunInitRecord`.
- `TurnlockRunRef`.
- `RunInitOwnershipMarker`.
- `BootstrapTaskName`.
- `BootstrapTaskRecord`.
- `BootstrapTaskCheckpoint`.
- `WorkflowExecutionRecord`.
- `RepositoryContext`.
- `PrerequisiteValidation`.
- `RunCaptureArtifact`.
- `DirtyStateDiffArtifact`.
- `DirtyStateDiffAdoption`.
- `WorkSession`.
- `ProjectDiscovery`.
- `MechanicalCheckDefinition`.
- `BootstrapFinding`.
- `ImplementationResult`.

Required exports:

- `bootstrapStateSchema`.
- `workflowStateSchema`.
- `runtimeStateSchema`.
- Per-artifact schemas used by bootstrap tasks.
- Narrow TypeScript types derived from Zod schemas.

Important rule:

- Phase 1 may use `.passthrough()` only where the bridge spec explicitly allows
  forward-compatible fields. Every other schema should be strict.

### 8.3 `NIB-M-GO-CANONICAL-HASHING.md`

Purpose:

- Define canonical hashing utilities used by run-init, checkpoints, and
  artefacts.
- Keep hashing separate from path containment.

Primary source:

- `../../standards/canonical-hashing.md`

Required contents:

- `sha256:<lowercase-hex>` format.
- SHA-256 byte hashing for files, patches, prompt text, and raw config input.
- RFC 8785 / JCS hashing for JSON business payloads.
- Domain normalization before JCS.
- Sentinel hash value:
  `sha256:0000000000000000000000000000000000000000000000000000000000000000`.
- Prompt text normalization:
  Unicode NFC, CRLF to LF, exactly one trailing newline, UTF-8 without BOM.
- Explicit non-cases:
  Git object ids, `trackedWorktreeHash`, patch byte hashes, and file byte hashes
  do not use JCS.

Implementation choice to settle in the NIB-M:

- Either use a maintained JCS library, or implement a small internal JCS helper
  tested against RFC 8785 vectors.
- No separate `DC-JCS-LIBRARY.md` is planned.

### 8.4 `NIB-M-GO-BOOTSTRAP-PERSISTENCE.md`

Purpose:

- Define the `/go` artefact persistence model used during `run-init`.
- Define ownership, checkpoints, containment, adoption, and quarantine rules.

Primary sources:

- `../../working/run-init/run-init.md`
- `../../contracts/workflow-artifacts.md`

Required contents:

- `artefactRoot` layout.
- Startup subdirectory layout.
- `RunInitOwnershipMarker`.
- `BootstrapTaskCheckpoint`.
- `WorkflowExecutionRecord`.
- Atomic JSON write behavior for `/go` artefacts.
- Adoption rules on retry.
- Mismatch rules on retry.
- Quarantine rules for partial, invalid, or temporary files.
- Path containment rules:
  `runDir` outside source repo;
  `artefactRoot` outside workspace;
  startup task refs under `artefactRoot`;
  `workspaceRootReservedPath` under the run namespace.
- Evidence ref validation.
- No direct mutation of Turnlock `state.json`.

Out of scope:

- Turnlock state persistence internals.
- Stage harness persistence internals.

### 8.5 `NIB-M-GO-ASYNC-GIT-RUNNER.md`

Purpose:

- Define the shared process runner for Git and other long-running subprocesses
  used by bootstrap tasks.

Primary sources:

- `../../working/orchestrator/turnlock-bridge.md`
- `../../standards/external-primitives.md`

Required contents:

- Async subprocess execution only.
- Abort propagation through `AbortSignal`.
- Child process termination on abort.
- Concurrent draining of stdout and stderr pipes.
- Capturing stdout; never inheriting child stdout.
- Human diagnostics routed to stderr, logs, or evidence files.
- Lock refresh during long-running operations.
- Exit code handling.
- Redaction requirements.
- Command result shape.

Out of scope:

- Specific Git command semantics. Those belong in task NIB-Ms or
  `DC-GIT-CLI-BOOTSTRAP.md`.

### 8.6 `NIB-M-GO-RUN-INIT-PIPELINE.md`

Purpose:

- Specify the `run-init` phase as an orchestration module.
- Wire bootstrap tasks, cancellation, joins, projection, and delegation.

Primary source:

- `../../working/run-init/run-init.md`

Required contents:

- Entry validation: input must be `BootstrapState`.
- Sequential prefix:
  `prerequisite-validation -> repo-capture`.
- Parallel branches after `repo-capture`:
  `run-capture`;
  `dirty-state-capture -> workspace-setup -> project-discovery-finalize`.
- Shared `AbortController`.
- `abortOnReject` behavior.
- `Promise.allSettled` join.
- First failure cancels active branches.
- Cancelled tasks write terminal checkpoints if possible.
- Projection into `WorkflowState` only after validation.
- `BootstrapFinding` handling:
  blocking findings prevent implementation delegation and route according to
  policy.
- Delegation construction:
  `io.delegate({ kind: "prompt", label: "implementation", ... },
  "implementation-settlement", workflowState)`.
- Retry behavior for existing initialized state.

Out of scope:

- Individual bootstrap task internals.
- Implementation prompt content beyond calling the dedicated prompt builder.

### 8.7 `NIB-M-GO-PREREQUISITE-VALIDATION.md`

Purpose:

- Validate the minimum environment before any resource allocation or Git
  bootstrap work.

Primary source:

- `../../working/run-init/prerequisite-validation.md`

Required contents:

- Git version check.
- Provider config path resolution.
- Provider config JSON parsing.
- Provider config schema validation.
- Token syntax validation without token persistence.
- POSIX permissions warning behavior.
- `PrerequisiteValidation` artefact.
- Checkpoint hash composition.
- Retry adoption and mismatch rules.
- Failure status mapping.

Phase 1 provider scope:

- GitHub and GitLab only.
- Syntax validation only.
- No network token verification.

### 8.8 `NIB-M-GO-REPO-CAPTURE.md`

Purpose:

- Resolve the target repository and optional project subdirectory from the
  invocation directory.

Primary source:

- `../../working/run-init/repo-capture.md`

Required contents:

- `invocationDirectory` as the sole target authority.
- Realpath normalization.
- Ascending `.git` discovery.
- Support for `.git` directory and `.git` file.
- Bare repository rejection.
- No-repository behavior.
- System root and home directory guard.
- Gateway sentinel rejection.
- Monorepo `projectRoot`.
- Nested repository behavior.
- `runDir` containment check.
- `RepoCapture` artefact.
- Checkpoint hash composition.
- Retry adoption and mismatch rules.
- Failure status mapping.

Out of scope:

- Git history integrity.
- Remote and branch discovery.
- Repository initialization.

### 8.9 `NIB-M-GO-RUN-CAPTURE.md`

Purpose:

- Mechanically capture the user invocation moment for later review and audit.

Primary source:

- `../../working/run-init/run-capture.md`

Required contents:

- `CaptureContext` consumption.
- `sessionRef` validation.
- Prompt validation.
- Prompt evidence write.
- Prompt text normalization.
- Prompt byte hash.
- `RunCaptureArtifact`.
- Relative evidence refs only.
- Checkpoint hash composition.
- Retry adoption and evidence re-verification.
- Failure status mapping.

Out of scope:

- Summarizing the prompt.
- Inferring intent.
- Resolving specs.

### 8.10 `NIB-M-GO-DIRTY-STATE-CAPTURE.md`

Purpose:

- Capture the source repository dirty state without mutating the source
  repository.

Primary source:

- `../../working/run-init/dirty-state-capture.md`

Required contents:

- Missing repository means clean dirty-state artefact.
- Empty repository or unborn HEAD behavior.
- Merge conflict detection.
- Masked file modification detection.
- Clean repository behavior.
- Dirty state policy validation.
- Temporary index patch capture.
- `git diff --binary --full-index`.
- Evidence files:
  status and patch.
- Patch byte hash.
- `DirtyStateDiffArtifact`.
- Checkpoint hash composition.
- Retry adoption and mismatch rules.
- Race condition limitation.
- Failure status mapping.

Hard invariant:

- The source repository index must never be modified.

### 8.11 `NIB-M-GO-WORKSPACE-SETUP-CONTRACT.md`

Purpose:

- Define the strategy-agnostic workspace setup contract.

Primary source:

- `../../working/run-init/workspace-setup.md`

Required contents:

- Workspace is physical and private.
- Artefacts are outside workspace.
- `baseHeadSha` is immutable.
- Detached HEAD support.
- Dirty state adoption contract.
- `WorkSession`.
- `DirtyStateDiffAdoption`.
- `WorkspaceSetupEvidence`.
- `skipSetup` semantics at the contract level.
- Checkpoint hash composition.
- Retry adoption and mismatch rules.
- Failure status mapping.

Out of scope:

- Git worktree command sequence.
- OCI sandbox strategy.

### 8.12 `NIB-M-GO-WORKSPACE-SETUP-WORKTREE.md`

Purpose:

- Specify the Phase 1 host-side Git worktree strategy for workspace setup.

Primary source:

- `../../working/run-init/workspace-setup.worktree.md`

Required contents:

- Repository validation.
- New repository initialization.
- Initial commit behavior.
- Remote repository creation via provider API.
- Remote `origin` setup.
- Default branch resolution.
- `baseHeadSha`, `baseBranch`, and `defaultTargetBranch`.
- Work branch creation:
  `work/<runId>`.
- `git worktree prune` pre-clean.
- Worktree creation.
- Realpath handling for missing workspace path.
- Worktree lock.
- Submodule initialization.
- Git LFS initialization.
- Hook disabling for mutating Git commands.
- Dirty patch check and application.
- Workspace status after replay.
- `skipSetup = true` diagnostic path.
- `skipSetup = false` retry cleanup and one-shot reconstruction.
- Failure status mapping.

Out of scope:

- OCI container lifecycle.
- Stage command execution.
- Post-run workspace cleanup beyond documenting that it belongs to later
  workflow finalization.

### 8.13 `NIB-M-GO-PROJECT-DISCOVERY-FINALIZE.md`

Purpose:

- Produce the authoritative Phase 1 `ProjectDiscovery` against the private
  workspace.

Primary source:

- `../../working/run-init/project-discovery-finalize.md`

Required contents:

- WorkSession prerequisite.
- Workspace existence check.
- Effective directory resolution.
- Declarative `STACK_EVAL.yaml` path.
- Heuristic ecosystem scan path.
- No repository mutation.
- Policy filtering by required gate kinds.
- Missing reliable gate behavior.
- Blocking `BootstrapFinding` production.
- Human-gate resolution marker shape.
- Command deduplication.
- Tool availability checks.
- Evidence writes.
- `ProjectDiscovery` artefact.
- Checkpoint hash composition.
- Retry adoption with inspected file rehash.
- Failure status mapping.

Boundary with registry module:

- This module owns the pipeline and policy behavior.
- `NIB-M-GO-PROJECT-DISCOVERY-REGISTRY.md` owns the ecosystem matrices.

### 8.14 `NIB-M-GO-PROJECT-DISCOVERY-REGISTRY.md`

Purpose:

- Specify the deterministic ecosystem signal registry and command matrix used by
  project discovery.

Primary source:

- `../../working/run-init/project-discovery-finalize.md`

Required contents:

- `STACK_EVAL.yaml` decision to command mapping.
- Package manager runner mapping.
- JavaScript and TypeScript signals.
- Rust signals.
- Go signals.
- Python signals.
- C and C++ signals.
- Java and Kotlin signals.
- .NET signals.
- Ruby signals.
- PHP signals.
- Elixir signals.
- Generic task runner signals.
- Tooling config signals.
- Priority ordering.
- Multi-ecosystem behavior.
- Generic runner disable-by-precedence behavior.

Out of scope:

- Filesystem scanning algorithm.
- Artefact persistence.
- Policy handling.

### 8.15 `NIB-M-GO-IMPLEMENTATION-DELEGATION-STUB.md`

Purpose:

- Specify the temporary Phase 1 behavior around the first implementation
  delegation and resume settlement.

Primary sources:

- `../../working/orchestrator/turnlock-bridge.md`
- `../../contracts/go-workflow-contract.md`

Required contents:

- `buildImplementationPrompt(workflowState)`.
- Delegation request shape:
  `kind: "prompt"`, `label: "implementation"`.
- `resumeAt: "implementation-settlement"`.
- `implementationResultSchema`.
- `implementation-settlement` phase:
  `consumePendingResult` must be called before transition.
- Stub behavior:
  no semantic judgment;
  no snapshot capture;
  no real stage chain;
  transition to `dummy-phase`.
- `dummy-phase` behavior:
  return `io.done(...)`.
- Phase 2 replacement note.

Out of scope:

- Real implementation evaluation.
- `change-snapshot`.
- Mechanical gates.
- Review.

## 9. TDD Tests Brief

### 9.1 `NIB-T-GO-TURNLOCK-ORCHESTRATOR.md`

Purpose:

- Define RED-only behavioral tests for the Phase 1 orchestrator.

The NIB-T must not prescribe tests that pass trivially after type scaffolding.
Export checks, constants, package shape checks, and schema instantiation checks
belong in a GREEN Layer 1 companion list.

Fixture areas:

- Temporary source repositories.
- Temporary run roots.
- Provider config fixtures.
- Turnlock protocol capture.
- Bootstrap state builders.
- Workspace assertions.
- Git command fixtures.
- `STACK_EVAL.yaml` fixtures.
- Ecosystem scan fixtures.
- Retry checkpoint fixtures.

Acceptance test groups:

- Fresh run delegates implementation after successful run-init.
- Resume consumes implementation result and reaches `dummy-phase`.
- Missing provider config fails before repo capture.
- Invalid provider config never persists token values.
- Git version failure maps to the expected failure status.
- Repository capture accepts normal repository roots.
- Repository capture handles monorepo subdirectories.
- Repository capture rejects gateway sentinels.
- Repository capture rejects unsafe no-repository roots.
- Repository capture rejects bare repositories.
- Clean dirty-state path produces clean artefact.
- Dirty source with reject policy fails closed.
- Dirty source with adopt policy captures patch evidence.
- Merge conflicts fail closed.
- Modified skip-worktree or assume-unchanged files fail closed.
- Worktree setup creates private `work/<runId>` workspace.
- Worktree setup does not mutate the source repository.
- Dirty patch replay appears in the private workspace.
- Worktree setup handles detached HEAD.
- Worktree setup fails when `origin` cannot resolve a target branch.
- `STACK_EVAL.yaml` discovery takes priority over heuristic scan.
- Invalid `STACK_EVAL.yaml` fails without heuristic fallback.
- Heuristic scan detects a JavaScript or TypeScript project.
- Heuristic scan detects a Python project with virtualenv.
- Heuristic scan detects multiple ecosystems deterministically.
- Missing required gates create blocking bootstrap findings or fail according to
  policy.
- Retry adopts valid checkpoints.
- Retry rejects hash mismatches.
- Retry re-runs project discovery when inspected file hashes differ.
- First branch failure cancels active bootstrap branches.
- Cancelled task writes terminal checkpoint when possible.
- No child process output pollutes Turnlock stdout.
- Token values never appear in artefacts, logs, stderr, errors, or state.
- Artefact refs cannot escape `artefactRoot`.
- `runDir` cannot be inside the target repository.
- `artefactRoot` cannot be inside the workspace.

Property tests:

- Canonical JSON hashes are deterministic for semantically identical objects.
- RFC 8785 vector compatibility for JCS hashing.
- Prompt hash normalization is stable across CRLF/LF and Unicode NFC/NFD forms.
- Evidence refs are always contained under `artefactRoot`.
- Checkpoint adoption is idempotent for unchanged inputs.
- Any hash mismatch prevents checkpoint adoption.
- Child stdout never reaches parent stdout except Turnlock protocol.
- Source repository tracked content is unchanged by read-only bootstrap tasks.
- Work branch names are derived only from valid run ids.

Contract invariants:

- Every successful fresh run produces a `WorkflowState`.
- `WorkflowState.runId` equals Turnlock `runId`.
- `currentStage` is `"implementation"` while the first delegation is pending.
- All projected bootstrap task records refer to valid business artefacts.
- All evidence refs are relative and contained.
- No token field is projected into `WorkflowState`.
- The first delegation label is exactly `"implementation"`.
- The first resume phase is exactly `"implementation-settlement"`.
- `dummy-phase` is the only terminal placeholder in Phase 1.

GREEN Layer 1 companion list:

- Public exports.
- File tree shape.
- Package dependency declarations.
- Constants.
- Schema object creation.
- Type aliases.
- Trivial constructor behavior.

## 10. Dependency Contracts

### 10.1 `DC-TURNLOCK-RUNTIME-v0.8.md`

Purpose:

- Define how `/go` consumes the Turnlock runtime.

Scope:

- `runOrchestrator`.
- `definePhase`.
- `OrchestratorConfig`.
- `Phase`, `PhaseIO`, and `PhaseResult`.
- `io.delegate`, `io.transition`, `io.done`, `io.fail`.
- `io.consumePendingResult`.
- `io.runId`, `io.runDir`, `io.clock`, `io.logger`, `io.signal`,
  `io.refreshLock`.
- Runtime stdout protocol.
- Resume command semantics.
- State schema validation boundary.
- Zod 3 expectations at the Turnlock boundary.

Out of scope:

- Turnlock internals.
- Reimplementing runtime behavior.

### 10.2 `DC-GIT-CLI-BOOTSTRAP.md`

Purpose:

- Define the Git CLI surface used by run-init bootstrap tasks.

Scope:

- `git --version`.
- `git rev-parse`.
- `git status --porcelain`.
- `git ls-files`.
- `git hash-object`.
- `git read-tree`.
- `git add`.
- `git diff --cached --binary --full-index`.
- `git apply --check --binary`.
- `git apply --binary`.
- `git init`.
- `git config --get init.defaultBranch`.
- `git symbolic-ref`.
- `git commit --allow-empty`.
- `git remote add`.
- `git remote set-url`.
- `git push -u`.
- `git branch`.
- `git branch --show-current`.
- `git branch -r --list`.
- `git merge-base --is-ancestor`.
- `git worktree add`.
- `git worktree lock`.
- `git worktree unlock`.
- `git worktree remove --force`.
- `git worktree prune`.
- `git worktree repair`.
- `git worktree list`.
- `git submodule update --init --recursive`.
- `git lfs pull`.
- `git check-ignore`.

Required constraints:

- Mutating workspace setup commands disable hooks with
  `core.hooksPath=/dev/null`.
- Source repository dirty-state capture uses temporary index only.
- stdout must be captured, never inherited.
- Exit code semantics must be explicit.

### 10.3 `DC-PROVIDER-APIS-GITHUB-GITLAB.md`

Purpose:

- Define the minimal provider API usage needed by Phase 1 workspace setup.

Phase 1 scope:

- Token authentication.
- Endpoint defaults.
- Repository creation only.
- Empty repository creation without automatic README or initial files.
- Error handling for repository name conflicts.

Out of scope until later phases:

- Pull request creation.
- CI status checks.
- Provider diff review.
- Branch protection.
- Merge operations.
- Commenting.

### 10.4 `DC-ZOD-3-4-COMPAT.md`

Purpose:

- Define the boundary between `/go` Zod 4 schemas and Turnlock Zod 3 typed
  inputs.

Scope:

- Runtime API compatibility for `safeParse`.
- Runtime API compatibility for `error.issues`.
- TypeScript incompatibility and allowed cast/adaptor pattern.
- Where casts may appear.
- Where casts must not spread.
- Future alignment path.

Constraint:

- Casts must be isolated at the Turnlock configuration boundary or in a named
  adapter. They must not appear throughout task logic.

### 10.5 `DC-BUN-SPAWN-ASYNC-RUNTIME.md`

Purpose:

- Define the Bun and Node process-management surface needed for async
  bootstrap execution.

Scope:

- `Bun.spawn` or approved Node async subprocess equivalent.
- `AbortSignal`.
- Process termination.
- Pipe draining.
- Exit status collection.
- `os.homedir`.
- POSIX permission inspection.
- Timer-based lock refresh.

Relationship to existing contracts:

- This is not a replacement for
  `../stage-harness/DC-NODE-RUNTIME-FS-PATH-CRYPTO.md`.
- That existing contract covers filesystem, path, and crypto primitives for the
  stage harness.
- This new contract covers async process behavior for the orchestrator.

## 11. Construction Sequence

The future construction sequence remains RED then GREEN.

Conception order:

1. Write `NIB-S-GO-TURNLOCK-ORCHESTRATOR.md`.
2. Write the five Dependency Contracts and the fifteen NIB-Ms.
3. Write `NIB-T-GO-TURNLOCK-ORCHESTRATOR.md` after module interfaces are
   stable.
4. Review inter-brief coherence before any production implementation.

RED order:

1. Implement the tests described by the NIB-T.
2. Add only minimal compile scaffolding.
3. Verify that behavioral tests fail for real runtime reasons.
4. Keep GREEN Layer 1 companion checks out of RED.

GREEN order:

1. Orchestrator bridge.
2. Schemas.
3. Canonical hashing.
4. Bootstrap persistence.
5. Async Git runner.
6. Run-init pipeline shell.
7. Prerequisite validation.
8. Repo capture.
9. Run capture.
10. Dirty-state capture.
11. Workspace setup contract.
12. Workspace setup worktree strategy.
13. Project discovery registry.
14. Project discovery finalization.
15. Implementation delegation settlement stub.

Verification commands for implementation phase:

```bash
bun test
bun tsc --noEmit
```

If formatting or lint tooling is introduced later, it must follow the active
project rules and avoid adding hook managers.

## 12. Expected Future File Layout

The future implementation should extend the current `/go` package without
mixing stage harness internals into the orchestrator.

Planned source areas:

```text
src/
+-- orchestrator/
|   +-- index.ts
|   +-- config.ts
|   +-- initial-state.ts
|   +-- schemas.ts
|   +-- phases/
|   |   +-- run-init.ts
|   |   +-- implementation-settlement.ts
|   |   +-- dummy-phase.ts
|   +-- run-init/
|   |   +-- pipeline.ts
|   |   +-- prerequisite-validation.ts
|   |   +-- repo-capture.ts
|   |   +-- run-capture.ts
|   |   +-- dirty-state-capture.ts
|   |   +-- workspace-setup-contract.ts
|   |   +-- workspace-setup-worktree.ts
|   |   +-- project-discovery-finalize.ts
|   |   +-- project-discovery-registry.ts
|   +-- runtime/
|   |   +-- async-process.ts
|   |   +-- canonical-hash.ts
|   |   +-- persistence.ts
|   |   +-- path-containment.ts
|   +-- delegation/
|       +-- implementation-prompt.ts
+-- stage-harness/
    +-- ...
```

Planned test areas:

```text
tests/
+-- orchestrator/
|   +-- acceptance/
|   +-- fixtures/
|   +-- helpers/
|   +-- properties/
+-- stage-harness/
    +-- ...
```

This file layout is guidance for the NIB-S. The NIB-S may refine names if it
finds a clearer boundary, but it must preserve the separation between
orchestrator modules and the existing stage harness.

## 13. Coherence Checklist

Before writing implementation code, verify that the future brief set satisfies:

- Every module named by the NIB-S has one NIB-M.
- Every NIB-M has explicit inputs, outputs, algorithms, examples, edge cases,
  constraints, and integration points.
- Every non-trivial external component consumed by a module is covered by a DC.
- The NIB-T contains only RED behavioral tests.
- GREEN Layer 1 companion checks are separated from RED tests.
- `implementation-settlement` is documented as a real Phase 1 resume phase.
- `dummy-phase` is documented as temporary.
- OCI sandbox is excluded from Phase 1.
- `DC-JCS-LIBRARY.md` is not created.
- Provider API DC scope is limited to Phase 1 repository creation.
- Path containment belongs to bootstrap persistence and task validation, not
  hashing.
- Turnlock owns runtime state persistence, stdout protocol, locks, resume, and
  signals.
- `/go` owns workflow payloads, policy, artefacts, and transitions.

## 14. Open Decisions

The following decisions should be closed while writing the NIB-Ms, before the
NIB-T is finalized:

- Whether canonical JSON hashing uses a maintained JCS dependency or an
  internal helper tested against RFC 8785 vectors.
- The exact default `runDirRoot` for Phase 1.
- The exact provider repository naming rule for newly initialized repositories.
- The exact `ImplementationResult` schema consumed by the settlement stub.
- Whether `project-discovery-finalize` emits a blocking bootstrap finding as an
  artefact only, or also projects it immediately into `WorkflowState`.

No production implementation should begin until these decisions are represented
in the relevant NIB-Ms or Dependency Contracts.

## 15. Final Approved Adjustments

The approved adjustments from plan review are:

- Rename runtime state schemas brief to
  `NIB-M-GO-ORCHESTRATOR-SCHEMAS.md`.
- Rename canonical hashing and paths brief to
  `NIB-M-GO-CANONICAL-HASHING.md`.
- Move path containment rules to bootstrap persistence and task-specific
  validation.
- Remove `DC-JCS-LIBRARY.md` from the plan.
- Rename Bun and Node runtime DC to
  `DC-BUN-SPAWN-ASYNC-RUNTIME.md`.
- Limit provider API DC to Phase 1 repository creation.
- Clarify the Phase 1 FSM:
  `run-init -> implementation-settlement -> dummy-phase`.
- Specify `BootstrapFinding` handling inside
  `NIB-M-GO-PROJECT-DISCOVERY-FINALIZE.md`, with a reference from
  `NIB-M-GO-RUN-INIT-PIPELINE.md`.

This plan is now the authoritative checklist for producing the Phase 1
orchestrator NIBs and Dependency Contracts.
