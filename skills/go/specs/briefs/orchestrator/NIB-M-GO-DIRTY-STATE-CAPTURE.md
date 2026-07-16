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
};
```

- **Dependency Contracts**:
  - [DC-GIT-CLI-BOOTSTRAP.md](../DC-GIT-CLI-BOOTSTRAP.md) for diff commands.
  - [DC-BUN-SPAWN-ASYNC-RUNTIME.md](../DC-BUN-SPAWN-ASYNC-RUNTIME.md) for isolated index variables.
  - [NIB-M-GO-CANONICAL-HASHING.md](./NIB-M-GO-CANONICAL-HASHING.md) for patch hashing.
  - [NIB-M-GO-BOOTSTRAP-PERSISTENCE.md](./NIB-M-GO-BOOTSTRAP-PERSISTENCE.md) for atomic write patterns.

---

## 3. Outputs

```ts
type DirtyStateDiffArtifact = {
  schema: "go.dirty-state-diff.v1";
  id: string;
  runId: string;
  sourceStatusPorcelainRef: string; // Relative path matching "dirty-state-status.txt"
  sourcePatchRef: string; // Relative path matching "dirty-state-patch.patch"
  patchHash: string; // sha256 hex digest of the patch file
  capturedAt: string;
};
```

- Returns a Promise resolving to `DirtyStateDiffArtifact` if modifications are found, or `null` if the repository is clean.
- Throws a blocking `PhaseError` if dirty policy is violated or if unmerged conflicts are detected.

---

## 4. Algorithm

### 4.1 Check Clean Status
1. Run `git -C <canonicalRepositoryRoot> status --porcelain=v1 -z --ignore-submodules=none` asynchronously.
2. If the output stream is empty, the repository is clean. Return `null`.

### 4.2 Enforce Policy Check
If status output is non-empty (repository is dirty):
1. Evaluate `policy.dirtyState`:
   - If `require-clean`: Throw a blocking error: "Workflow policy requires a clean repository. Uncommitted changes detected".
   - If `human-gate-if-dirty`: Trigger a blocking human gate finding and abort execution.
   - If `adopt-as-input`: Proceed with patch extraction.

### 4.3 Setup Isolated Index
To generate the patch without modifying the developer's workspace index:
1. Define a temporary index file path under the artifacts folder:
   `tempIndex = path.join(artefactRoot, "git-dirty.index")`
2. Configure the subprocess execution environment to include:
   `GIT_INDEX_FILE: tempIndex`
3. Execute the following Git commands sequentially:
   - `git read-tree HEAD`: Writes the HEAD tree structure to `tempIndex`.
   - `git add --all`: Populates `tempIndex` with all on-disk modifications (tracked and untracked) without modifying the main `.git/index` file.
   - `git diff --cached --binary --full-index`: Outputs the binary diff patch stream comparing `tempIndex` against HEAD.
4. Delete the `tempIndex` file immediately upon completion, regardless of success or failure.

### 4.4 Check Conflicts and Assume-Unchanged
Before compiling results:
1. Run `git ls-files -v` to check for skip-worktree or assume-unchanged markers:
   - If any file has status tag `S` or lowercase ASCII characters, throw a blocking error: "Unsupported repository state: skip-worktree or assume-unchanged files detected".
2. If the diff command output contains conflict marker indicators or unmerged index entries (stage values $> 0$), throw a blocking error: "Repository contains unresolved merge conflicts".

### 4.5 Save Evidence and Create Artifact
1. Write the porcelain status output to `<artefactRoot>/dirty-state-status.txt` atomically.
2. Write the binary patch stream bytes to `<artefactRoot>/dirty-state-patch.patch` atomically.
3. Compute the SHA-256 hash of the patch bytes.
4. Generate a unique Crockford ULID string for the artifact `id`.
5. Construct and return the `DirtyStateDiffArtifact` object.

---

## 5. Example

### 5.1 Dirty State Diff Artifact
Expected output when modifications exist:
```json
{
  "schema": "go.dirty-state-diff.v1",
  "id": "01JTESTRUNID0000000000000B",
  "runId": "01JTESTRUNID00000000000000",
  "sourceStatusPorcelainRef": "dirty-state-status.txt",
  "sourcePatchRef": "dirty-state-patch.patch",
  "patchHash": "sha256:d8e9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1",
  "capturedAt": "2026-07-16T15:28:00.000Z"
}
```

---

## 6. Edge cases

- **Untracked files deletion**: If a file is untracked on the host, `git add --all` records its content to `tempIndex` and `git diff` serializes it as a creation patch. This is fully supported.
- **Empty Patch**: If status is dirty but diff output is empty (e.g. only untracked empty directories or ignored file modifications), write empty files and return the sentinel hash.

---

## 7. Constraints

- **Source Immutability**: The on-disk index file `.git/index` of the developer's repository must **never** be touched or locked. The `tempIndex` file must be used for all operations.
- **Index Cleanup**: The `tempIndex` file must be deleted within a `finally` block to ensure filesystem cleanup even if Git commands fail.

---

## 8. Integration

Executed after repo capture:

```ts
import { captureDirtyState } from "./dirty-state.js";

const dirtyStateDiff = await captureDirtyState({
  runId: state.runId,
  artefactRoot: runInit.artefactRootRef,
  repoCapture,
  policy: state.policy
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
