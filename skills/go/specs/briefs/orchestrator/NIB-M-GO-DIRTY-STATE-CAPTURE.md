---
id: NIB-M-GO-DIRTY-STATE-CAPTURE
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/dirty-state-capture
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Dirty State Capture

VegaCorp — July 2026

---

## 1. Purpose

This module captures the uncommitted modifications (dirty state) of the developer's source repository before initializing the private workspace. It generates a binary diff patch and porcelain status record using an isolated temporary Git index, ensuring the source repository is never mutated, and enforces policy limits on uncommitted work.

---

## 2. Inputs

```ts
type DirtyStateInput = {
  runId: string;
  artefactRoot: string;
  repoCapture: RepoCapture;
  policy: WorkflowPolicy;
  clock: { nowWallIso: () => string };
};
```

- **Dependency Contracts**:
  - [DC-GIT-CLI-BOOTSTRAP.md](../DC-GIT-CLI-BOOTSTRAP.md) for diff commands.
  - [DC-BUN-SPAWN-ASYNC-RUNTIME.md](../DC-BUN-SPAWN-ASYNC-RUNTIME.md) for isolated index variables.
  - [NIB-M-GO-CANONICAL-HASHING.md](./NIB-M-GO-CANONICAL-HASHING.md) for patch hashing.
  - [NIB-M-GO-BOOTSTRAP-PERSISTENCE.md](./NIB-M-GO-BOOTSTRAP-PERSISTENCE.md) for atomic write patterns.

---

## 3. Outputs

- Writes the parsed `DirtyStateDiffArtifact` file `dirty-state-capture.json` to:
  `<artefactRoot>/startup/dirty-state-capture/`
- Writes the evidence files `status.txt` and `patch.diff` under:
  `<artefactRoot>/startup/dirty-state-capture/evidence/`
- Writes the `BootstrapTaskCheckpoint` file `task-record.json` to:
  `<artefactRoot>/startup/dirty-state-capture/`
- Returns a Promise resolving to `DirtyStateDiffArtifact`:
  ```ts
  type DirtyStateDiffArtifact = {
    schema: "go.dirty-state-diff.v1";
    runId: string;
    capturedAt: string;
    initialDirtyState: "clean" | "dirty";
    sourceStatusPorcelainRef?: string; // Relative path matching "startup/dirty-state-capture/evidence/status.txt"
    sourcePatchRef?: string; // Relative path matching "startup/dirty-state-capture/evidence/patch.diff"
    sourcePatchHash?: string; // sha256 hex digest of the patch file
  };
  ```
- Throws a blocking `PhaseError` if dirty policy is violated or if unmerged conflicts are detected.

---

## 4. Algorithm

### 4.1 Check Repository Existence and Empty HEAD
### 4.1 Check Repository Existence and Empty HEAD
1. If the target repository has no `.git` anchor (e.g. `canonicalRepositoryRoot` does not exist or has no `.git` subdirectory), proceed directly to Section 4.5 to construct and write the clean artifact and checkpoint, then terminate.
2. Run `git -C <canonicalRepositoryRoot> rev-parse --verify HEAD` asynchronously.
3. If the command fails (indicating an empty repository with no commits), proceed directly to Section 4.5 to construct and write the clean artifact and checkpoint, then terminate.

### 4.2 Check Merge Conflicts and Masked Files
1. Run `git -C <canonicalRepositoryRoot> -c core.quotePath=false status --porcelain` asynchronously.
   - The flag `-c core.quotePath=false` prevents octal escaping of non-ASCII file paths.
2. Scan the output line-by-line:
   - Check if any line starts with merge conflict status codes: `DD`, `AU`, `UD`, `UA`, `DU`, `AA`, `UU`.
   - If a conflict is found, throw a blocking error: "Repository contains unresolved merge conflicts" (resolves to `failed`).
3. Scan for modifications in hidden files:
   - Run `git -C <canonicalRepositoryRoot> -c core.quotePath=false ls-files -v`.
   - For every output line where the first character is `h` (assume-unchanged) or `S` (skip-worktree):
     - Extract the file path.
     - Query index metadata using `git -C <canonicalRepositoryRoot> ls-files -s <filePath>`.
     - Calculate the disk hash using `git -C <canonicalRepositoryRoot> hash-object <filePath>`.
     - Compare the index hash and the disk hash. If they are different, the hidden file is mutated. Throw a blocking error: "Modified skip-worktree or assume-unchanged files detected" (resolves to `failed`).

### 4.3 Evaluate Policy and Check Clean Status
1. If the status output is empty and no hidden files are mutated, the repository is clean:
   - Proceed directly to Section 4.5 to construct and write the clean artifact and checkpoint, then terminate.
2. If modifications are found, evaluate `policy.dirtyState.mode`:
   - If `"require-clean"`: Throw a blocking error: "Workspace policy requires a clean repository" (resolves to `failed`).
   - If `"human-gate-if-dirty"`: Register human gate and abort (resolves to `failed`).
   - If `"adopt-as-input"`: Proceed with patch capture.

### 4.4 Capture Patch Using Temporary Index
1. Create the target folders:
   - `evidenceDir = path.join(artefactRoot, "startup", "dirty-state-capture", "evidence")`
   - `tmpDir = path.join(artefactRoot, "startup", "dirty-state-capture", "tmp")`
2. Create both directories recursively.
3. Define the temporary index path:
   `tempIndex = path.join(tmpDir, "index")`
4. Setup environment variables: `GIT_INDEX_FILE: tempIndex`.
5. Execute the Git sequence sequentially:
   - `git read-tree HEAD` to write the tree to the temp index.
   - `git add --all` to add modifications.
   - `git diff --cached --binary --full-index` to print the binary patch bytes.
6. Delete the file `tempIndex` inside a `finally` block to prevent leaks.

### 4.5 Save Evidence and Create Artifact (Clean and Dirty States)
1. **Clean State Execution**: If the repository is clean (as directed by Sections 4.1 or 4.3):
   - Define `DirtyStateDiffArtifact` with `initialDirtyState: "clean"` (omitting status porcelain and patch references).
   - Save the artifact atomically to `<artefactRoot>/startup/dirty-state-capture/dirty-state-capture.json`.
   - Set `gitStateDigest` to the 64-zero sentinel value `sha256:0000000000000000000000000000000000000000000000000000000000000000`.
   - Compute `inputHash` as the JCS hash of `{ runId, RepoCapture, WorkflowPolicy.dirtyState, artefactRoot, gitStateDigest }`.
   - Compute the other checkpoint hashes as described in Step 3.
   - Write the `BootstrapTaskCheckpoint` file `task-record.json` atomically inside the task directory as described in Step 4, recording `startedAt` (task start time) and `endedAt` (`clock.nowWallIso()`).
   - Terminate task successfully.
2. **Dirty State Execution**: If the repository has modifications:
   - Write the porcelain status output to `<evidenceDir>/status.txt` atomically.
   - Write the binary patch output stream bytes to `<evidenceDir>/patch.diff` atomically.
   - Calculate the SHA-256 hash of the patch bytes.
   - Construct the `DirtyStateDiffArtifact` object with `initialDirtyState: "dirty"`, `sourceStatusPorcelainRef: "startup/dirty-state-capture/evidence/status.txt"`, `sourcePatchRef: "startup/dirty-state-capture/evidence/patch.diff"`, and `sourcePatchHash` set to the patch hash.
   - Save the artifact atomically to `<artefactRoot>/startup/dirty-state-capture/dirty-state-capture.json`.
   - Compute `gitStateDigest` as the SHA-256 hash of the string `git rev-parse HEAD` output concatenated with the porcelain status output.
   - Compute `inputHash` as the JCS hash of `{ runId, RepoCapture, WorkflowPolicy.dirtyState, artefactRoot, gitStateDigest }`.
3. Compute the other checkpoint hashes:
   - `repoCaptureHash`: JCS hash of the input `RepoCapture` object.
   - `workflowPolicyHash`: JCS hash of the input `WorkflowPolicy.dirtyState` object.
   - `captureContextHash`: Set to the deterministic 64-zero sentinel value `sha256:0000000000000000000000000000000000000000000000000000000000000000` (this task does not consume the capture context).
4. Write the `BootstrapTaskCheckpoint` file `task-record.json` atomically inside `<artefactRoot>/startup/dirty-state-capture/`, using the computed hashes and capturing `startedAt` and `endedAt` via the pipeline clock context (`clock.nowWallIso()`).

---

## 5. Example

### 5.1 Dirty State Diff Artifact
Saved `dirty-state-capture.json` when modifications exist:
```json
{
  "schema": "go.dirty-state-diff.v1",
  "runId": "01JTESTRUNID00000000000000",
  "capturedAt": "2026-07-16T15:28:00.000Z",
  "initialDirtyState": "dirty",
  "sourceStatusPorcelainRef": "startup/dirty-state-capture/evidence/status.txt",
  "sourcePatchRef": "startup/dirty-state-capture/evidence/patch.diff",
  "sourcePatchHash": "sha256:d8e9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1"
}
```

---

## 6. Edge cases

- **Untracked Files**: Untracked files are added to the temporary index and captured as additions, which is correct.
- **Empty Patch**: If status has dirty items but patch diff is empty, return the clean state or write empty evidence files.

---

## 7. Constraints

- **Absolute Read-Only Source**: Under no circumstances should the source repository's primary index file `.git/index` be touched.
- **Strict Cleanup**: The temp index file must be cleaned up in a `finally` block to prevent leaving locks or files.

---

## 8. Integration

Executed after repo capture:

```ts
import { captureDirtyState } from "./dirty-state.js";

const dirtyStateDiff = await captureDirtyState({
  runId: state.runId,
  artefactRoot: state.artefactRoot,
  repoCapture,
  policy: state.policy,
  clock: context.clock
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
