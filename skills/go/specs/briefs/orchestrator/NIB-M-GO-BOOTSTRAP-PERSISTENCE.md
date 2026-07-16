---
id: NIB-M-GO-BOOTSTRAP-PERSISTENCE
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/bootstrap-persistence
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Bootstrap Persistence

VegaCorp — July 2026

---

## 1. Purpose

This module defines the filesystem layout, atomic file-writing protocols, checkpoint serialization, and path containment invariants used during the `/go` orchestrator's onboarding phase. It guarantees that task execution outcomes are persisted reliably, are immune to race conditions, and can be adopted safely across execution retries.

---

## 2. Inputs

- **Context Parameters**: `runId`, `runDir`, `workspaceRoot`, `artefactRoot`.
- **Reference Specification**: [workflow-artifacts.md](../../working/contracts/workflow-artifacts.md) for checkpoint schemas.
- **Dependency Contracts**:
  - [DC-BUN-SPAWN-ASYNC-RUNTIME.md](../DC-BUN-SPAWN-ASYNC-RUNTIME.md).

---

## 3. Outputs

- Writes serialized JSON artifacts and task checkpoints directly to the filesystem.
- Resolves check statuses for checkpoint adoption on run retries.

---

## 4. Algorithm

### 4.1 Directory Structure
The module organizes the run directory namespace according to the following layout:
```text
<runDir>/
  ├── state.json (Turnlock FSM state)
  ├── events.ndjson (Turnlock execution events)
  ├── logs/ (internal task stdout/stderr logs and turnlock events)
  └── <artefactRoot>/
        ├── run-init-ownership.json (ownership marker)
        └── startup/
              ├── prerequisite-validation/
              │     └── task-record.json (checkpoint)
              ├── repo-capture/
              │     └── task-record.json
              └── ... (directories per task name)
```

### 4.2 Path Containment Invariants
Every path generated, resolved, or stored by bootstrap tasks must comply with these rules:
1. `runDir` must be outside the target source repository.
2. `artefactRoot` (passed dynamically by config) must reside outside the workspace directory (`workspaceRoot`).
3. **No Traversal Escapes**: Every resolved evidence file or checklist reference must sit within `artefactRoot`. The path must be resolved using `fs.realpath` and checked:
   `resolvedPath.startsWith(artefactRoot)`
   If `false`, throw a `ProtocolError` immediately to prevent file system traversal.

### 4.3 Atomic File Writing
To prevent partial writes or corruptions in case of crashes or power failures, all JSON files (checkpoints, markers, artifacts) must be written atomically:
1. Write the JSON payload to a temporary file in the same target folder:
   `<target_file_path>.<random_ulid>.tmp`
2. Perform a file system rename (`fs.rename`) to overwrite the target path:
   `fs.rename(tempPath, targetPath)`
3. If any step fails, catch the error, delete the temp file, and throw a `PhaseError`.

### 4.4 Ownership Verification Marker
During the initialization of `run-init`, write the `run-init-ownership.json` file inside `artefactRoot`.
- On fresh runs: Write the `RunInitOwnershipMarker` documenting the `runId`, the `TurnlockRunRef`, and the hashes of the input parameters (`repoCaptureHash`, `workflowPolicyHash`, `captureContextHash`).
- On resume/retry: Before starting any task, read the ownership marker.
  - If the marker matches the active `runId` and all input hashes, adopt the directory.
  - If the marker has mismatches or is missing, throw `StateCorruptedError` or fail-closed.

### 4.5 Checkpoint Adoption
When a task starts:
1. Read `<artefactRoot>/startup/<taskName>/task-record.json`.
2. If present, validate the schema and compare `inputHash`, `repoCaptureHash`, `workflowPolicyHash`, and `captureContextHash` with the current run parameters.
3. If they match, skip task execution, mark status as `passed` (or the status stored in the checkpoint), and project the cached `businessArtifactIds` into `WorkflowState`.
4. If there is a mismatch, discard the checkpoint and execute the task.

### 4.6 Timestamping
Every task checkpoint (`BootstrapTaskCheckpoint`) must record:
- `startedAt`: String ISO 8601 representation of the clock time captured at the task's entry point.
- `endedAt`: String ISO 8601 representation of the clock time captured immediately before the checkpoint is written.
These properties are mandatory under the Zod schema and must be passed to the checkpoint writer.

---

## 5. Example

### 5.1 Checkpoint Adoption Flow
Task `repo-capture` starts on a retry run:
- Reads `<artefactRoot>/startup/repo-capture/task-record.json`.
- Compares checkpoint `inputHash` to current computed hash.
- Match confirmed: skips execution, returning the existing checkpoint artifact IDs.

---

## 6. Edge cases

- **Corrupt Checkpoints**: If reading a `task-record.json` throws a parsing or Zod schema error, the checkpoint is ignored, deleted, and the task execution is forced to start fresh.
- **Quarantining**: If the directory is occupied by another `runId` or has mismatched hashes that cannot be safely parsed, the run must abort without cleaning the directory to preserve files for user diagnostics.

---

## 7. Constraints

- **Single Writer**: Mutating files under `artefactRoot` must occur from a single asynchronous loop. No multi-threaded writes are allowed.
- **No Direct Turnlock Mutation**: Bootstrap tasks must never write to Turnlock's `state.json` directly. That file is owned exclusively by the Turnlock runtime.

---

## 8. Integration

Imported by tasks to record progress and persist results:

```ts
import { writeCheckpoint } from "./persistence.js";

await writeCheckpoint("repo-capture", {
  status: "passed",
  inputHash,
  businessArtifactIds,
  startedAt: taskStartTime,
  endedAt: clock.nowWallIso()
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
