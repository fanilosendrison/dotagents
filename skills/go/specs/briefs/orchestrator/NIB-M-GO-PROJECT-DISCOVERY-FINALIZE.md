---
id: NIB-M-GO-PROJECT-DISCOVERY-FINALIZE
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/project-discovery-finalize
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Project Discovery & Finalize

VegaCorp — July 2026

---

## 1. Purpose

This module specifies the startup task `project-discovery-finalize`, the final task of the `/go` bootstrap phase. It validates target project directories, parses stack configuration files (`STACK_EVAL.yaml`) or runs heuristic ecosystem directory scans to build the mechanical gate execution matrix, and produces the `ProjectDiscovery` business artifact.

---

## 2. Inputs

```ts
type ProjectDiscoveryInput = {
  runId: string;
  workSession: WorkSession;
  repoCapture: RepoCapture;
  workspaceRoot: string;
  artefactRoot: string;
  policy: WorkflowPolicy;
  clock: { nowWallIso: () => string };
};
```

- **Dependency Contracts**:
  - [NIB-M-GO-WORKSPACE-SETUP-CONTRACT.md](./NIB-M-GO-WORKSPACE-SETUP-CONTRACT.md) for workspace paths and `WorkSession` structure.
  - [NIB-M-GO-ORCHESTRATOR-SCHEMAS.md](./NIB-M-GO-ORCHESTRATOR-SCHEMAS.md) for `ProjectDiscovery` Zod schemas.

---

## 3. Outputs

- Writes the compiled `ProjectDiscovery` artifact JSON to:
  `<artefactRoot>/startup/project-discovery-finalize/project-discovery.json`
- Writes the `BootstrapFindings` artifact JSON to:
  `<artefactRoot>/startup/project-discovery-finalize/bootstrap-findings.json`
- Writes the `BootstrapTaskCheckpoint` file `task-record.json` to:
  `<artefactRoot>/startup/project-discovery-finalize/`
- Returns a Promise resolving to `ProjectDiscovery`.
- Throws `PhaseError` if validation fails.

---

## 4. Algorithm

### 4.1 Workspace Initialization
1. Verify `workSession` is readable and valid.
2. Resolve effective workspace path:
   `effectiveDir = workSession.workspaceProjectRoot ?? workSession.workspaceRoot`
3. Verify that the physical path `effectiveDir` exists on disk.

### 4.2 Declarative Path (`STACK_EVAL.yaml`)
1. Check if `STACK_EVAL.yaml` exists in `effectiveDir`. If absent and `workSession.workspaceProjectRoot` is configured, fallback to checking `workSession.workspaceRoot`.
2. If present, parse the YAML file and extract decisions:
   - Language, runtime, package manager, linter, test runner, type checker, CI configuration.
   - **Malformed YAML**: If parsing throws a syntax or formatting exception, throw `failed` immediately.
3. Validate decisions: Verify extracted values match recognized languages/runtimes and package managers. If any decision is unknown or unrecognized, throw `failed`.
4. Construct command candidates based on decisions (mapping `<pm-runner>` syntax like `bun run`, `npm run`, etc.).
5. Verify that expected configuration files declared by decisions exist in the worktree (e.g. `biome.json` for Biome linter). If files are missing, throw `failed`.
6. Compute SHA-256 hashes of all checked configuration files.
7. Populate `ProjectDiscovery` with `discoveryMethod: "stack-eval"` and save a copy of the parsed YAML under evidence folder. Proceed to Section 4.4.

### 4.3 Heuristic Path (Ecosystem Scan)
If `STACK_EVAL.yaml` is absent:
1. **Optimized I/O**: Execute a single `fs.readdir(effectiveDir)` call to gather on-disk file names. Do not use repeated `existsSync` queries.
2. Compare directory entries against registered language ecosystem markers in priority sequence:
   - **JavaScript/TypeScript**: lockfiles (`bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`), manifests (`package.json`, `deno.json`).
   - **Rust**: `Cargo.toml`, `Cargo.lock`.
   - **Go**: `go.mod`, `go.sum`.
   - **Python**: `uv.lock`, `poetry.lock`, `requirements.txt`, `pyproject.toml`.
   - **C/C++**: `CMakeLists.txt`, `Makefile`, `meson.build`.
   - **Java/Kotlin**: `pom.xml`, `build.gradle`, `build.gradle.kts`.
   - **.NET**: `*.csproj`, `*.fsproj`, `packages.lock.json`.
   - **Generic Task Runners**: `Makefile`, `justfile`, `Taskfile.yml`, `Taskfile.yaml`.
3. Resolve Package Manager: If manifests exist without lockfiles, search parent directories up to `workspaceRoot`. If no lockfile is found, resolve packageManager to `"unknown"`.
4. Resolve Python Virtualenvs: If checking Python projects, inspect directories for local virtual environments (`.venv/`, `venv/`, `.virtualenvs/`). If found, resolve linter/test runners to virtualenv absolute binaries (e.g. `<venv>/bin/pytest`).
5. Scan configurations: Collect tooling config files (e.g. `.eslintrc.*`, `tsconfig.json`, `clippy.toml`, etc.). Compute SHA-256 hashes for all non-gitignored files.
6. Set `discoveryMethod: "ecosystem-scan"`.

### 4.4 Matrix Construction and Tool Availability Checks
1. Filter commands matching `policy.gates.requiredKinds` (e.g. `lint`, `test`, `typecheck`, `build`).
2. If a required gate is not detected:
   - If `policy.discovery.noReliableGateBehavior === "human-gate"`: Proceed, and register a blocking condition to be written in the findings artifact.
   - If `"fail"`: Throw `failed` immediately.
   - If `"allow-with-evidence"`: Proceed, listing absent gates in evidence.
3. Deduplicate Commands: Choose specific local scripts/ resolvers (e.g. cargo clippy) over generic task runners (e.g. make lint). Mark generic entries as `"disabled-by-precedence"` in logs.
4. Tool Availability: Verify command visibility:
   - If the command path is relative (e.g., pointing to `.venv/bin/pytest`), verify that the file physically exists inside the workspace. If missing, log a warning.
   - Otherwise, verify that the binaire (first token of command) is visible in the runtime `PATH`. If missing, log a warning (keep the command registered).
5. **BootstrapFindings Artifact**:
   - If the gate matrix construction produced blocking conditions (e.g. required gate not detected with policy `"human-gate"`):
     - Construct a `BootstrapFindings` object containing findings with `severity: "blocking"`, `resolution: "human-gate"`, and a clear message describing the missing gate.
   - If no blocking conditions exist:
     - Construct a `BootstrapFindings` object with `findings: []` (empty array).
   - Write this `BootstrapFindings` artifact JSON atomically to:
     `<artefactRoot>/startup/project-discovery-finalize/bootstrap-findings.json`

### 4.5 Save Evidence and Checkpoint
1. Write the final `ProjectDiscovery` object to `<artefactRoot>/startup/project-discovery-finalize/project-discovery.json`. Assign `finalizedAgainstWorkspaceRoot` to `workSession.workspaceRoot`, and `provenance` to `"workspace-rerun"`.
2. Compute checkpoint hashes:
   - `inputHash`: JCS hash of `{ runId, artefactRoot, workspaceRoot, projectRoot: workSession.workspaceProjectRoot ?? null }`.
   - `repoCaptureHash`: Transitive matching JCS hash of `repoCapture`.
   - `workflowPolicyHash`: JCS hash of `{ discovery: policy.discovery, gates: policy.gates }`.
   - `captureContextHash`: `sha256:0000000000000000000000000000000000000000000000000000000000000000` (sentinel value).
   - `startedAt` and `endedAt`: ISO timestamps.
3. Write `task-record.json` atomically.

### 4.6 Retry and Cache-Adoption
On retry runs:
1. If the checkpoint is present and hashes match:
   - Scan and re-compute SHA-256 hashes of all `inspectedFiles` currently on disk.
   - If all computed file hashes match the stored hashes in `inspectedFiles`: adopt the previous `ProjectDiscovery` artifact.
   - If any file hash differs: discard cache and execute a full scan (Section 4.2 or 4.3).

---

## 5. Example

### 5.1 Project Discovery JSON
```json
{
  "discoveryMethod": "ecosystem-scan",
  "packageManager": "npm",
  "lockfiles": [
    "package-lock.json"
  ],
  "commands": [
    {
      "id": "gate-lint",
      "kind": "lint",
      "command": ["npm", "run", "lint"],
      "required": true,
      "workingDirectory": "/path/to/workspace"
    }
  ],
  "inspectedFiles": [
    {
      "path": "package.json",
      "hash": "sha256:d8e9a2b3c4d5e6f...",
      "requiredForFinalization": true
    }
  ],
  "finalizedAgainstWorkspaceRoot": "/path/to/workspace",
  "provenance": "workspace-rerun"
}
```

### 5.2 Bootstrap Findings JSON (Empty / Nominal)
```json
{
  "findings": []
}
```

### 5.3 Bootstrap Findings JSON (Blocking Condition Example)
```json
{
  "findings": [
    {
      "id": "finding-01JTESTRUNID00000000000000",
      "severity": "blocking",
      "resolution": "human-gate",
      "message": "Required check linter is missing and policy specifies 'human-gate'"
    }
  ]
}
```

---

## 6. Edge cases

- **Absent tools during discovery**: Acceptable. Discovery registers the command, and runtime gates will verify presence again immediately before launch.
- **Gitignored configuration files**: Ensure all tooling files listed in `.gitignore` are excluded from `inspectedFiles` using `git check-ignore`.

---

## 7. Constraints

- **No executions**: Do not run unit tests, compilers, or tooling commands. Only compile execution matrices and check command path visibility.
- **No existsSync loops**: Read directory entries using `fs.readdir` to optimize CPU/disk footprint.

---

## 8. Integration

Executed as the final bootstrap task:

```ts
import { finalizeDiscovery } from "./discovery.js";

const discovery = await finalizeDiscovery({
  runId: state.runId,
  workSession,
  repoCapture,
  workspaceRoot: state.workspaceRoot,
  artefactRoot: state.artefactRoot,
  policy: state.policy,
  clock: context.clock
});
```


---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
