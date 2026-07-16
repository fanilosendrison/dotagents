---
id: NIB-M-GO-REPO-CAPTURE
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/repo-capture
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Repository Capture

VegaCorp — July 2026

---

## 1. Purpose

This module implements the repository discovery and validation logic for the `/go` workspace. It inspects the directory hierarchy upward from the invocation directory to identify the Git root without running Git commands, checks path containment against the run directory, and rejects contexts that match agent sentinel boundaries.

---

## 2. Inputs

```ts
type RepoCaptureInput = {
  invocationDirectory: string;
  runDir: string;
  runDirRoot?: string;
  artefactRoot: string;
  clock: { nowWallIso: () => string };
};
```

- **Dependency Contracts**:
  - [DC-BUN-SPAWN-ASYNC-RUNTIME.md](../DC-BUN-SPAWN-ASYNC-RUNTIME.md) for filesystem traversal, file checking, and path normalization.

---

## 3. Outputs

- Writes the parsed `RepoCapture` artifact to:
  `<artefactRoot>/startup/repo-capture/repo-capture.json`
- Writes the `BootstrapTaskCheckpoint` file `task-record.json` to:
  `<artefactRoot>/startup/repo-capture/`
- Returns a Promise resolving to `RepoCapture`:
  ```ts
  type RepoCapture = {
    schema: "go.repo-capture.v1";
    invocationDirectory: string;
    canonicalRepositoryRoot: string;
    projectRoot?: string;
    symlinkResolved: boolean;
    resolvedAt: string;
  };
  ```
- Throws a blocking `PhaseError` if validation rules are violated.

---

## 4. Algorithm

### 4.1 Ascendancy Search
1. Resolve and normalize `invocationDirectory` using `fs.realpath` to obtain the physical path.
2. Initialize `symlinkResolved` as `true` if `physicalPath !== invocationDirectory`, else `false`.
3. Set `currentDir` to `physicalPath`.
4. Initialize `resolvedGitRoot = null`.
5. Loop while `currentDir` is not the system root directory (e.g. `/`):
   - Check if `.git` exists under `currentDir`.
   - If `.git` exists (as a folder or a file):
     - Set `resolvedGitRoot = currentDir`.
     - Break the loop.
   - If not found, set `currentDir = path.dirname(currentDir)`.

### 4.2 Bare Repository Verification (Without Running Git)
If `.git` was found under `resolvedGitRoot`:
1. If `.git` is a directory:
   - Read `.git/config` as text.
   - Parse the `[core]` section and check if `bare = true` is set.
   - If `bare = true` is present, throw a blocking error: "Bare repositories are not supported" (resolves to `failed`).
2. If `.git` is a file (common inside Git worktrees or submodules):
   - Read `.git` contents, locate the `gitdir: <path>` reference.
   - Resolve the target `<path>` to its real physical folder.
   - Read the `config` file inside that target folder, check if `bare = true` is set.
   - If `bare = true` is present, throw a blocking error (resolves to `failed`).
3. Set `canonicalRepositoryRoot` to `resolvedGitRoot`.

### 4.3 Monorepo and Project Root Resolution
1. Compare `canonicalRepositoryRoot` with `physicalPath`:
   - If they are identical, `canonicalRepositoryRoot` is the root, and `projectRoot` is omitted.
   - If they differ, `canonicalRepositoryRoot` is set, and `projectRoot` is set to `physicalPath` (monorepo sub-project configuration). Verify that `projectRoot` is a sub-directory of `canonicalRepositoryRoot`. If not, throw `failed`.

### 4.4 Sentinel Gateways and Safe Roots (If No Dépôt Found)
If no `.git` was found:
1. Verify if the directory matches sentinel criteria:
   - If `physicalPath` contains any path segment (exact folder name) equal to `.agents`, `.codex`, `.pi`, or `.gravity`, throw a blocking error (resolves to `failed`).
   - If any file directly inside `physicalPath` has the exact basename `AGENTS.md`, `SKILL.md`, `CODEX.md`, or `GRAVITY.md`, throw a blocking error (resolves to `failed`).
2. Check System Root Guard:
   - If `physicalPath` is a system root directory (e.g. `/`, `/Users`, `/home`) or equals the user's home directory (`os.homedir()`), throw a blocking error: "Cannot initialize repository at system root or user home directory" (resolves to `failed`).
3. If guards pass, set `canonicalRepositoryRoot` to `physicalPath`. The initialization of Git is delegated to `workspace-setup`.

### 4.5 Validation of the Containment
1. If `runDirRoot` is not configured, check containment:
   - Resolve both `runDir` and `canonicalRepositoryRoot` to their canonical paths using `fs.realpath` to prevent symlink containment bypasses.
   - Verify that the resolved `runDir` does **not** sit inside the resolved `canonicalRepositoryRoot` (check `resolvedRunDir.startsWith(resolvedCanonicalRepositoryRoot)` is `false`).
2. If `runDir` is nested within the repository, throw a blocking error: "Containment violation: runDir is located inside target repository" (resolves to `failed`).

### 4.6 Save Artifact and Checkpoint
1. Set `resolvedAt` to the current timestamp retrieved from Turnlock's runtime clock passed via pipeline context (`clock.nowWallIso()`).
2. Construct the `RepoCapture` artifact object. **Preservation**: The `invocationDirectory` field must hold the *original, un-normalized* path string passed to inputs, while `canonicalRepositoryRoot` and `projectRoot` must contain their resolved canonical paths.
3. Save the object atomically to `<artefactRoot>/startup/repo-capture/repo-capture.json`.
4. Concurrently, compute `inputHash` as the JCS hash of `{ invocationDirectory, runDir }` (using the original un-normalized input values).
5. Compute `repoCaptureHash` as the JCS hash of the produced `RepoCapture` artifact.
6. Write the `BootstrapTaskCheckpoint` file `task-record.json` atomically, using `inputHash`, `repoCaptureHash`, recording `startedAt` (captured via `clock.nowWallIso()` at task start) and `endedAt` (captured via `clock.nowWallIso()` at write time), and fixing `workflowPolicyHash` and `captureContextHash` to the 64-zero sentinel value.

---

## 5. Example

### 5.1 Captured Monorepo Context
Expected saved `repo-capture.json`:
```json
{
  "schema": "go.repo-capture.v1",
  "invocationDirectory": "/Users/famillesendrison/Developper/Projects/monorepo/packages/core",
  "canonicalRepositoryRoot": "/Users/famillesendrison/Developper/Projects/monorepo",
  "projectRoot": "/Users/famillesendrison/Developper/Projects/monorepo/packages/core",
  "symlinkResolved": false,
  "resolvedAt": "2026-07-16T15:28:00.000Z"
}
```

---

## 6. Edge cases

- **Worktree links**: Reading `.git` as a file must support absolute and relative paths in `gitdir: ` references.
- **Empty configurations**: If the config file cannot be read, assume the repository is not bare but let down-stream git commands report issues.

---

## 7. Constraints

- **No Git CLI execution**: Checking for bare configurations and path ascendancy must be done using pure filesystem operations, without invoking any Git child processes.
- **Strict Sentinel Checks**: Compare exact components of path string to prevent matching substring false positives (e.g. do not block directory `/Users/user/happy-project`).

---

## 8. Integration

Executed after prerequisite validation:

```ts
import { captureRepository } from "./repo-capture.js";

const repoCapture = await captureRepository({
  invocationDirectory: state.invocationDirectory,
  runDir: state.runDir,
  runDirRoot: config.runDirRoot,
  artefactRoot: state.artefactRoot,
  clock: context.clock
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
