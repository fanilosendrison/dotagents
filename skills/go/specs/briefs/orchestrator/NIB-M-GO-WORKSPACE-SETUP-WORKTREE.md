---
id: NIB-M-GO-WORKSPACE-SETUP-WORKTREE
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/workspace-setup-worktree
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Workspace Setup (Git Worktree Strategy)

VegaCorp — July 2026

---

## 1. Purpose

This module implements the concrete Git Worktree strategy for the `/go` workspace setup task. It uses Git CLI commands to instantiate a private physical worktree, manages submodules, Git LFS downloads, branch locking, and provides rigorous cleanup and recovery logic on retry runs.

---

## 2. Inputs

- **Inputs**: `WorkspaceSetupInput` context block.
- **Dependency Contracts**:
  - [DC-GIT-CLI-BOOTSTRAP.md](../DC-GIT-CLI-BOOTSTRAP.md) for Git commands signature.
  - [DC-PROVIDER-APIS-GITHUB-GITLAB.md](../DC-PROVIDER-APIS-GITHUB-GITLAB.md) for repo creation.
  - [NIB-M-GO-WORKSPACE-SETUP-CONTRACT.md](./NIB-M-GO-WORKSPACE-SETUP-CONTRACT.md) for abstract outputs.

---

## 3. Outputs

- Creates a physical worktree folder under `workspaceRoot` on host disk.
- Writes the validation `work-session.json` evidence file.
- Returns a Promise resolving to `WorkspaceSetupEvidence`.

---

## 4. Algorithm

### 4.1 Repository Validation and Init
If a Git repository exists at `canonicalRepositoryRoot`:
1. Verify that `git -C <canonicalRepositoryRoot> rev-parse --show-toplevel` resolved via `realpath` matches `realpath(canonicalRepositoryRoot)`. If not, throw `failed`.
2. Check that the option `core.worktree` is empty in the source repository config. If set, throw `failed`.
3. Retrieve remote origin URL using `git config --get remote.origin.url` and save it to populate the `sourceRepo` field.
If no repository exists:
1. Initialize a new repo using `git -c core.hooksPath=/dev/null init`.
2. Resolve default branch from config `init.defaultBranch` (fallback `"main"`).
3. Set HEAD: `git -c core.hooksPath=/dev/null symbolic-ref HEAD refs/heads/<defaultBranch>`.
4. Add all existing files using `git -c core.hooksPath=/dev/null add -A`.
5. Commit files using `git -c core.hooksPath=/dev/null commit -m "initial"` (or `--allow-empty` if no files exist).
6. Create remote repository using Provider API client. Wrap the API call in a try/catch block:
   - The remote repository must be named exactly after the basename of the target folder (`canonicalRepositoryRoot`).
   - If the creation fails with HTTP 409 Conflict (e.g., repo name already taken), throw `errored` immediately (terminal error, fail-closed).
   - If the creation fails with a transient network error (e.g. DNS failure, connection timeout, HTTP 5xx Server Error, or HTTP 429 Rate Limit): throw a transient `PhaseError` without writing a terminal checkpoint to disk, enabling Turnlock's FSM runner to retry the task.
7. Associate the remote: `git remote add origin <remoteUrl>`, and push branch: `git -c core.hooksPath=/dev/null push -u origin <defaultBranch>`. Set `sourceRepo` to `<remoteUrl>`.

### 4.1bis Resolve Git Base Pointers
1. **`baseHeadSha`**: Resolve from source repo using `git rev-parse --verify HEAD^{commit}`.
2. **`baseBranch`**: Resolve using `git branch --show-current`. If HEAD is detached, set to `null`.
3. **`defaultTargetBranch`**: Query using `git symbolic-ref refs/remotes/origin/HEAD` and parse the short name. If it fails, fallback by testing existence of `refs/remotes/origin/main` then `refs/remotes/origin/master`. If none exists, throw `failed`.

### 4.2 Branch and Worktree Add
1. **Pre-cleanup**: Execute `git worktree prune` inside the source repository.
2. Create work branch `work/<runId>` from `baseHeadSha` via `git branch` (without checkouts).
   - If the branch exists:
     - On retry (valid checkpoint present): verify that `git merge-base work/<runId> <baseHeadSha>` returns `baseHeadSha`. If yes, reuse; else force branch reset `git branch -f work/<runId> <baseHeadSha>`.
     - On fresh runs: throw `failed` (unexpected branch collision).
3. **Double Realpath Resolution**:
   - Resolve the physical parent directory of `workspaceRoot` via `realpath` and join the basename of `workspaceRoot` to compute `resolvedWorkspaceRoot`.
   - Add the worktree:
     `git worktree add <resolvedWorkspaceRoot> work/<runId>`
   - Post-creation: verify `realpath(workspaceRoot)` matches `resolvedWorkspaceRoot` (case-insensitive string comparison on macOS/Windows, strict on Linux). If they mismatch, throw `errored`.
4. Lock the worktree:
   `git worktree lock <workspaceRoot> --reason "go-run:<runId>"`
5. **Project Root Mapping**: If `RepoCapture.projectRoot` is defined, set `workspaceProjectRoot` to the corresponding folder path inside the newly created worktree (re-resolving via realpath to prevent symlink traversal).

### 4.3 Workspace Initialization
From within the `workspaceRoot`:
1. **Submodules**: If `.gitmodules` exists, run `git -c core.hooksPath=/dev/null submodule update --init --recursive`. If it fails, throw `errored`.
2. **Git LFS**:
   - **Detection**: Read `.gitattributes` file in the workspace root. Scan its contents for any rule declaring `filter=lfs`.
   - If LFS filters are present, run `git lfs pull`. If `git-lfs` CLI is missing on the host, throw `failed` (missing prerequisite dependency). If pull execution fails, throw `errored`.

### 4.4 Apply Diff Patch
If dirty state diff patch is present:
1. Run `git -c core.hooksPath=/dev/null apply --check --binary <patchPath>` inside `workspaceRoot`. If it fails, throw `failed`.
2. Run `git -c core.hooksPath=/dev/null apply --binary <patchPath>`.

### 4.5 Retry and Reconstruction (`skipSetup` Handling)
1. **`skipSetup = true` (Diagnostic mode)**:
   - Check containment: verify that `realpath(workspaceRoot)` starts with `realpath(runDir)`. If not, throw `errored`.
   - Check if `.git` file exists and contains a valid pointer.
   - If the `.git` link is broken, run `git worktree repair <workspaceRoot>` (if Git $\ge$ 2.31). If repair fails or Git is $< 2.31$, throw `errored`.
   - Verify active branch is `work/<runId>` and `baseHeadSha` is ancestor of HEAD.
2. **`skipSetup = false` (Reconstruction)**:
   - Verify branch, ancestor, and patch status.
   - If corruption is found, check if `retryAttempt <= 1` inside `BootstrapTaskCheckpoint.retryAttempt` (optional schema parameter). If `retryAttempt > 1`, throw `errored` (prevents infinite rebuild loops).
   - If `retryAttempt <= 1`, perform strict cleanup:
     - Run `git worktree unlock <workspaceRoot>`.
     - Run `git worktree remove --force <workspaceRoot>`.

     - Run `git worktree prune`.
     - Verify containment (`realpath(workspaceRoot)` nested inside `realpath(runDir)`), then run `rm -rf <workspaceRoot>` physically.
     - Verify that `git worktree list` no longer references the directory.
     - Increment `retryAttempt` in task metadata and proceed with normal creation (Section 4.2).

---

## 5. Example

### 5.1 Spawned Subprocesses during Creation
- `git worktree prune`
- `git branch work/01JTESTRUNID00000000000000 a1b2c3...`
- `git worktree add /path/to/run/workspace work/01JTESTRUNID00000000000000`
- `git worktree lock /path/to/run/workspace --reason go-run:01JTESTRUNID00000000000000`

---

## 6. Edge cases

- **Worktree removal failure**: If `git worktree remove` fails because the workspace path is unknown to Git, proceed to prune and verify filesystem containment before running `rm -rf`.
- **Merge Base Ancestry on retry**: When verify is run, use `git merge-base --is-ancestor <baseHeadSha> HEAD` instead of comparing SHAs directly, because the workspace HEAD may have advanced during subsequent implementation commits.

---

## 7. Constraints

- **Hooks prevention**: All mutating Git commands executed in the worktree must include `-c core.hooksPath=/dev/null`.
- **Git version prerequisites**: Requires Git $\ge$ 2.18 for `worktree remove --force`, and Git $\ge$ 2.31 for `worktree repair`.

---

## 8. Integration

Invoked during the bootstrap pipeline:

```ts
import { setupWorkspaceWorktree } from "./workspace-worktree.js";

const setupEvidence = await setupWorkspaceWorktree(inputs);
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
