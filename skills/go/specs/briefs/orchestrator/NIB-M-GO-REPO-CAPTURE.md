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

This module implements the repository discovery and validation logic for the `/go` workspace. It inspects the directory hierarchy upward from the invocation directory, verifies repository characteristics, and rejects execution contexts that cross agent sentinel boundaries.

---

## 2. Inputs

```ts
type RepoCaptureInput = {
  invocationDirectory: string;
  policy: WorkflowPolicy;
};
```

- **Dependency Contracts**:
  - [DC-GIT-CLI-BOOTSTRAP.md](../DC-GIT-CLI-BOOTSTRAP.md) for target verification.
  - [DC-BUN-SPAWN-ASYNC-RUNTIME.md](../DC-BUN-SPAWN-ASYNC-RUNTIME.md) for path normalization.

---

## 3. Outputs

```ts
type RepoCaptureOutput = {
  schema: "go.repo-capture.v1";
  invocationDirectory: string;
  canonicalRepositoryRoot: string;
  projectRoot?: string;
  symlinkResolved: boolean;
  resolvedAt: string;
};
```

- Returns a Promise resolving to `RepoCaptureOutput`.
- Throws a blocking `PhaseError` if validation rules are violated.

---

## 4. Algorithm

### 4.1 Ascendancy Search and Sentinel Checks
1. Normalize `invocationDirectory` using `fs.realpath` to resolve symlinks and obtain the canonical path.
2. Initialize `currentDir` to the normalized `invocationDirectory`.
3. Check for the presence of sentinel files or directories under `currentDir`:
   - Sentinel folders: `.agents`, `.codex`, `.pi`, `.gravity`.
   - Sentinel files: `AGENTS.md`.
   - If any sentinel is detected, throw a blocking error immediately: "Execution blocked: Invocation directory crosses agent gateway boundary".
4. Check if `.git` (folder or file) exists under `currentDir`.
   - If found, stop search and set `resolvedGitRoot` to `currentDir`.
   - If not found, check if `currentDir` is the system root `/`. If yes, stop search.
   - If not root, set `currentDir` to `path.dirname(currentDir)` and repeat from Step 3.

### 4.2 Bare Repository Verification
If a `.git` reference was found:
1. Run `git -C <resolvedGitRoot> rev-parse --is-bare-repository` asynchronously.
2. If the command exits non-zero or outputs `true`, throw a blocking error: "Bare Git repositories are not supported".

### 4.3 Monorepo and Project Root Resolution
1. Run `git -C <invocationDirectory> rev-parse --show-toplevel` to fetch the authoritative top-level repository root.
2. Resolve the output to its canonical absolute path.
3. Compare the resolved repository root with the normalized `invocationDirectory`:
   - If they are identical, `canonicalRepositoryRoot` is the root and `projectRoot` is omitted.
   - If they differ, `canonicalRepositoryRoot` is set to the repository root, and `projectRoot` is set to the normalized `invocationDirectory` path (monorepo sub-project configuration).
4. If no `.git` reference was found throughout the search:
   - If policy allows workspace initialization, return the `RepoCaptureOutput` with `canonicalRepositoryRoot` set to the normalized `invocationDirectory` and delegate setup to the workspace creation task. Otherwise, throw a blocking error.

---

## 5. Example

### 5.1 Monorepo Sub-Project Capture
- Invocation directory: `/Users/famillesendrison/Developper/Projects/monorepo/packages/core`.
- Git root folder found at `/Users/famillesendrison/Developper/Projects/monorepo/.git`.
Expected output:
```json
{
  "schema": "go.repo-capture.v1",
  "invocationDirectory": "/Users/famillesendrison/Developper/Projects/monorepo/packages/core",
  "canonicalRepositoryRoot": "/Users/famillesendrison/Developper/Projects/monorepo",
  "projectRoot": "/Users/famillesendrison/Developper/Projects/monorepo/packages/core",
  "symlinkResolved": true,
  "resolvedAt": "2026-07-16T15:28:00Z"
}
```

---

## 6. Edge cases

- **Worktree References**: If `.git` is a file (common inside Git worktrees or submodules), parse it as a regular file. If it contains a `gitdir: <path>` pointer, resolve it using `fs.realpath`.
- **System Root Escape**: If the ascendancy loop reaches the system root `/` without identifying any `.git` anchor, the task must evaluate if the folder matches the policy guidelines before rejecting the run.

---

## 7. Constraints

- **Sentinel Gateways Protection**: Verification of sentinel boundaries (e.g. `~/.agents`, `~/.pi`) must happen at every level of the directory ascension to prevent execution within the agent's own settings folders.
- **No File Writes**: This task is read-only and must not modify or write files on disk.

---

## 8. Integration

Executed after prerequisite validation:

```ts
import { captureRepository } from "./repo-capture.js";

const repoCapture = await captureRepository({
  invocationDirectory: state.invocationDirectory,
  policy: state.policy
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
