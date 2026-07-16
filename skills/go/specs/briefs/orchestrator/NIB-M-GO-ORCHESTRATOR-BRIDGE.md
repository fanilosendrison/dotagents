---
id: NIB-M-GO-ORCHESTRATOR-BRIDGE
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/bridge
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Orchestrator Bridge

VegaCorp — July 2026

---

## 1. Purpose

This module coordinates the launch interface of the `/go` workflow. It translates process parameters and environment configurations into a Turnlock `OrchestratorConfig`, manages fresh vs resume state instantiation, and executes the Turnlock process-level loop.

---

## 2. Inputs

- **Process Environment**: `process.env` and `process.argv`.
- **Dependency Contracts**:
  - [DC-TURNLOCK-RUNTIME-v0.9.md](../DC-TURNLOCK-RUNTIME-v0.9.md) for orchestrator configuration rules.
  - [DC-ZOD-3-4-COMPAT.md](../DC-ZOD-3-4-COMPAT.md) for type casting at boundary checks.

---

## 3. Outputs

- Calls Turnlock `runOrchestrator(config)` which terminates the process execution asynchronously.

---

## 4. Algorithm

### 4.1 Resolve Environment Variables
1. **Entry Path**: Look up `process.env.GO_ENTRY_PATH`.
   - If missing, check if `process.argv[1]` contains a valid path. If yes, fallback to `process.argv[1]`.
   - If still missing, throw an `InvalidConfigError` indicating that `GO_ENTRY_PATH` is required for gateway harness execution.
2. **Run Directory Root**: Look up `process.env.TURNLOCK_RUN_DIR_ROOT`.
   - If present, resolve it to an absolute path using `fs.realpath`.
   - If absent, default to path `.turnlock/runs` under the current directory.

### 4.2 Parse Command Arguments
1. Inspect `process.argv` to check if `--resume` is present.
2. **Resume Mode**:
   - Verify `--run-id <runId>` is supplied, where `<runId>` matches the ULID Crockford 26-character alphanumeric pattern. If missing or invalid, throw `InvalidConfigError`.
   - Construct a **dummy/empty state** conforming to the `BootstrapState` schema. Turnlock requires a valid initial state to validate against `config.stateSchema` at process boot, which is immediately replaced by the loaded snapshot. Do not perform any disk I/O or directory scans during dummy state construction.
3. **Fresh Mode**:
   - Resolve `invocationDirectory` from `process.cwd()` using `fs.realpath`.
   - Resolve `WorkflowPolicy` from workspace settings or load `buildDefaultWorkflowPolicy()`.
   - **GO_PROMPT Contract**: The parent harness must supply the user prompt string via the `process.env.GO_PROMPT` environment variable or as the final trailing parameter in process arguments. Resolve `CaptureContext` from this input.
   - Construct the initial `BootstrapState`.

### 4.3 Configure Orchestrator
Instantiate the `OrchestratorConfig` options block:

- `name`: `"go"`.
- `initial`: `"run-init"`.
- `phases`: Registry mapping `"run-init"` to `runInitPhase` and `"implementation-settlement"` to `implementationSettlementStub`.
- `initialState`: The `BootstrapState` resolved in Section 4.2.
- `stateSchema`: `runtimeStateSchema` cast `as any` (Zod v4 to Zod v3 conversion).
- `resumeCommand`: `(runId) => "bun run \"" + GO_ENTRY_PATH + "\" --resume --run-id " + runId` (quoted to support paths containing spaces).
- `runDirRoot`: The resolved run directory path from Section 4.1.
- `logging`: `{ enabled: true, persistEventLog: true }`.

### 4.4 Invoke Orchestrator
Execute `runOrchestrator(config)` and handle any synchronous setup rejections by writing a protocol error block to `process.stdout` and exiting with code `1`.

---

## 5. Example

### 5.1 Fresh Invocation Environment
Process launched:
```bash
GO_ENTRY_PATH="/Users/famillesendrison/.agents/skills/go/src/orchestrator/index.ts" bun run src/orchestrator/index.ts
```
Expected instantiated config object:
```ts
{
  name: "go",
  initial: "run-init",
  phases: {
    "run-init": runInitPhase,
    "implementation-settlement": implementationSettlementStub
  },
  initialState: {
    schema: "go.bootstrap-state.v1",
    invocationDirectory: "/Users/famillesendrison/Developper/Projects/target-repo",
    policy: { ...defaultPolicy },
    captureContext: {
      schema: "go.capture-context.v1",
      sessionRef: "session-123",
      promptAtGo: "Implement feature X"
    }
  },
  stateSchema: runtimeStateSchema,
  resumeCommand: (runId) => `bun run /Users/famillesendrison/.agents/skills/go/src/orchestrator/index.ts --resume --run-id ${runId}`,
  runDirRoot: "/Users/famillesendrison/Developper/Projects/target-repo/.turnlock/runs"
}
```

---

## 6. Edge cases

- **Relative paths in `GO_ENTRY_PATH`**: If the path is relative, it must be resolved against the process current directory before constructing the `resumeCommand` string to prevent relative traversal bugs on process resumption.
- **Argv Parsing Race Condition**: If both `--resume` and fresh arguments are supplied, resume arguments take absolute precedence.

---

## 7. Constraints

- **No early file changes**: This module must not write files or mutate directory structure. State initialization is managed exclusively by the Turnlock runtime inside `runOrchestrator`.
- **No stdout pollution**: Console statements (`console.log`) are strictly prohibited to prevent corruption of the Turnlock protocol stream.

---

## 8. Integration

The module acts as the entry point script for `/go` execution:

```ts
// src/orchestrator/index.ts
import { runOrchestrator } from "turnlock";
import { buildConfig } from "./config.js";

const config = buildConfig(process.argv, process.env);
await runOrchestrator(config);
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
