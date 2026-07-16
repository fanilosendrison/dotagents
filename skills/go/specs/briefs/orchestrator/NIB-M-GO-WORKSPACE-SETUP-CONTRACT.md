---
id: NIB-M-GO-WORKSPACE-SETUP-CONTRACT
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/workspace-setup-contract
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Workspace Setup Contract

VegaCorp — July 2026

---

## 1. Purpose

This module establishes the abstract contract and vocabulary boundaries for the `/go` workspace setup phase. It defines the required input parameters, the schema of the `WorkSession` business artifact, and the invariant rules that all concrete implementation strategies (such as Git Worktree or Sandbox Clone) must respect.

---

## 2. Inputs

```ts
type WorkspaceSetupInput = {
  runId: string;
  runDir: string;
  repoCapture: RepoCapture;
  dirtyStateDiff: DirtyStateDiffArtifact;
  policy: WorkflowPolicy;
  artefactRoot: string;
  workspaceRoot: string;
  skipSetup?: boolean; // Default: false
  clock: { nowWallIso: () => string };
};
```

- **Dependency Contracts**:
  - [NIB-M-GO-ORCHESTRATOR-SCHEMAS.md](./NIB-M-GO-ORCHESTRATOR-SCHEMAS.md) for schemas definition.
  - [NIB-M-GO-BOOTSTRAP-PERSISTENCE.md](./NIB-M-GO-BOOTSTRAP-PERSISTENCE.md) for checkpoint and path containment contracts.

---

## 3. Outputs

- Writes the parsed `WorkspaceSetupEvidence` JSON to:
  `<artefactRoot>/startup/workspace-setup/work-session.json`
- Writes the `BootstrapTaskCheckpoint` file `task-record.json` to:
  `<artefactRoot>/startup/workspace-setup/`
- Returns a Promise resolving to `WorkspaceSetupEvidence`:
  ```ts
  type WorkspaceSetupEvidence = {
    workSession: WorkSession;
    dirtyStateDiffAdoption?: DirtyStateDiffAdoption;
    createdDirectories: string[];
    workspaceProjectRoot?: string;
  };

  type WorkSession = {
    runId: string;
    repositoryRoot: string; // canonicalRepositoryRoot path
    sourceRepo?: string; // Origin remote URL (optional)
    workspaceRoot: string; // Path to checkout directory
    workspaceProjectRoot?: string; // Sub-project path inside workspace
    artefactRoot: string;
    baseBranch: string | null; // Null if HEAD is detached
    baseHeadSha: string;
    baseRemote?: string;
    defaultTargetBranch: string;
    dirtyStateDiffAdoption?: DirtyStateDiffAdoption;
    workBranch: `work/${string}`; // Format: work/<runId>
    workBranchCreatedAt: string;
  };

  type DirtyStateDiffAdoption = {
    captureArtifactId: string;
    replayedIntoWorkspace: boolean;
    workspaceStatusAfterReplayRef: string; // Relative path to status file
  };
  ```
- Throws a blocking `PhaseError` if setup fails.

---

## 4. Algorithm

### 4.1 Resolve Base Git Configuration
1. Resolve the target Git repository root (`canonicalRepositoryRoot` from `RepoCapture`).
2. Identify target branches and references:
   - `baseHeadSha`: The parent commit SHA of the current HEAD. If no commit exists (empty repo), initial commit must be handled by strategy.
   - `baseBranch`: Active branch name on source repository (resolved from HEAD). If HEAD is detached, set `baseBranch = null`.
   - `defaultTargetBranch`: Resolved from `origin/HEAD` or fallbacks (`main`/`master`).
3. Construct the workspace branch name: `work/<runId>`.

### 4.2 Workspace Creation
1. Delegate physical creation of the isolated `workspaceRoot` directory to the configured strategy (e.g. Git Worktree creation or Container Sandbox provisioning).
2. Suppress Git Hooks: Append `-c core.hooksPath=/dev/null` to all Git commands executed in the workspace to neutralize hook actions.
3. If submodules exist (presence of `.gitmodules`), run `git submodule update --init --recursive` inside the workspace.
4. If Git LFS filters exist (presence of `.gitattributes` filter tags), run `git lfs pull` inside the workspace (failing if binary missing).

### 4.3 Replay Dirty State Patch
If `dirtyStateDiff.initialDirtyState === "dirty"`:
1. Verify the patch applicability using `git apply --check --binary`.
2. Apply the patch atomically using `git apply --binary`.
3. Capture the porcelain status of the workspace post-patch application and write it to evidence file `status-after-replay.txt` under `<artefactRoot>/startup/workspace-setup/evidence/`.
4. Populate the `DirtyStateDiffAdoption` metadata:
   - `captureArtifactId`: `dirtyStateDiff.id`.
   - `replayedIntoWorkspace`: `true`.
   - `workspaceStatusAfterReplayRef`: `"startup/workspace-setup/evidence/status-after-replay.txt"`.

### 4.4 Save Evidence and Checkpoint
1. Set `workBranchCreatedAt` to `clock.nowWallIso()`.
2. Construct the `WorkSession` and `WorkspaceSetupEvidence` artifacts:
   - Map `workspaceProjectRoot` to the resolved sub-project path inside the workspace returned by the strategy (e.g. mapping `repoCapture.projectRoot` relative to `workspaceRoot`).
   - Populate `sourceRepo` with the strategy's resolved remote origin URL.
3. Save the evidence object atomically to `<artefactRoot>/startup/workspace-setup/work-session.json`.
4. **Checkpoint writing**:
   - `inputHash`: JCS hash of `{ runId, runDir, RepoCapture, dirtyStateDiffHash, artefactRoot, workspaceRoot, skipSetup }` (where `dirtyStateDiffHash` is the JCS hash of `dirtyStateDiff`, or the 64-zero sentinel hash if clean).
   - `repoCaptureHash`: JCS hash of `repoCapture`.
   - `workflowPolicyHash`: JCS hash of the input `policy.dirtyState`.
   - `captureContextHash`: `sha256:0000000000000000000000000000000000000000000000000000000000000000` (sentinel value).
   - `startedAt` and `endedAt`: Timestamps captured using `clock.nowWallIso()`.
   - `retryAttempt`: Set to the rebuild counter value managed by the task execution container.
5. Write the `BootstrapTaskCheckpoint` file `task-record.json` atomically.

---

## 5. Example

### 5.1 Workspace Setup Evidence
Saved `work-session.json`:
```json
{
  "workSession": {
    "runId": "01JTESTRUNID00000000000000",
    "repositoryRoot": "/Users/famillesendrison/Developper/Projects/target-repo",
    "workspaceRoot": "/Users/famillesendrison/Developper/Projects/target-repo/.turnlock/runs/01JTESTRUNID00000000000000/workspace",
    "artefactRoot": "/Users/famillesendrison/Developper/Projects/target-repo/.turnlock/runs/01JTESTRUNID00000000000000/artifacts",
    "baseBranch": "main",
    "baseHeadSha": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "defaultTargetBranch": "main",
    "workBranch": "work/01JTESTRUNID00000000000000",
    "workBranchCreatedAt": "2026-07-16T15:28:00.000Z"
  },
  "createdDirectories": [
    "/Users/famillesendrison/Developper/Projects/target-repo/.turnlock/runs/01JTESTRUNID00000000000000/workspace"
  ]
}
```

---

## 6. Edge cases

- **Detached HEAD**: Authorized. `baseBranch` resolves as `null`, and branch `work/<runId>` is checked out directly from `baseHeadSha`.
- **Empty repositories**: If no commits exist in the repository, the strategy must initialize the base commit (e.g. empty commit) to generate `baseHeadSha` before creating the branch.

---

## 7. Constraints

- **No mutations in source**: The main repository branch pointer (`HEAD` of the source repository) must never be altered or checkout-switched during workspace setup. All operations must target the private `workspaceRoot` directory.
- **Strict Isolation**: Runs must store artifacts and logs exclusively under `artefactRoot`, keeping the private workspace clean from runtime footprints.

---

## 8. Integration

Imported as part of the bootstrap execution:

```ts
import { setupWorkspace } from "./workspace.js";

const setupEvidence = await setupWorkspace({
  runId: state.runId,
  runDir: state.runDir,
  repoCapture,
  dirtyStateDiff,
  policy: state.policy,
  artefactRoot: state.artefactRoot,
  workspaceRoot: state.workspaceRoot,
  clock: context.clock
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
