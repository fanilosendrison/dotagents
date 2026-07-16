---
id: DC-TURNLOCK-RUNTIME-v0.9
type: dependency-contract
version: "1.0.0"
dependency_version: "0.9.0"
scope: turnlock
status: active
consumers: [claude-code]
referenced_by: [NIB-S-GO-TURNLOCK-ORCHESTRATOR, NIB-M-GO-ORCHESTRATOR-BRIDGE, NIB-M-GO-IMPLEMENTATION-DELEGATION-STUB]
superseded_by: []
---

# Dependency Contract — Turnlock Runtime v0.9.0

VegaCorp — July 2026

---

## 0. Identity
- **Component name**: `turnlock`
- **Version**: `0.9.0`
- **Source**: Internal monorepo repository (linked during development via relative file path `file:../../../VegaCorp/turnlock` or equivalent).
- **Role in the consuming system**: Acts as the deterministic mechanical state machine runtime. It drives process lifecycle, persistence, locking, signal trapping, and delegation communication protocol blocks.

---

## 1. Interface

Turnlock exports the following core API from its entry point:

```ts
import type { ZodSchema } from "zod"; // Zod v3

// Engine Execution
export function runOrchestrator<State extends object>(
  config: OrchestratorConfig<State>
): Promise<void>;

// Helper for type definitions
export function definePhase<State extends object = object, Output = unknown>(
  phaseFn: Phase<State, Output>
): Phase<State, Output>;

// Core Types
export interface OrchestratorConfig<State extends object = object> {
  readonly name: string;
  readonly initial: string;
  readonly phases: Readonly<Record<string, Phase<State, unknown>>>;
  readonly initialState: State;
  readonly resumeCommand: (runId: string) => string;
  readonly stateSchema?: ZodSchema<State>;
  readonly retry?: RetryPolicy;
  readonly timeout?: TimeoutPolicy;
  readonly logging?: LoggingPolicy;
  readonly retentionDays?: number;
  readonly runDirRoot?: string;
}

export type Phase<State extends object = object, Output = unknown> = (
  state: State,
  io: PhaseIO<State>
): Promise<PhaseResult<State, Output>>;

export interface PhaseIO<State extends object> {
  delegate(
    req: PromptDelegationRequest,
    resumeAt: string,
    nextState: State
  ): PhaseResult<State>;
  delegateBatch(
    req: BatchDelegationRequest,
    resumeAt: string,
    nextState: State
  ): PhaseResult<State>;

  done<FinalOutput>(output: FinalOutput): PhaseResult<State, FinalOutput>;
  fail(error: Error): PhaseResult<State>;

  readonly logger: OrchestratorLogger;
  readonly clock: Clock;
  readonly runId: string;
  readonly args: readonly string[];
  readonly runDir: string;
  readonly signal: AbortSignal;

  consumePendingResult<T>(schema: ZodSchema<T>): T;
  consumePendingBatchResults<T>(schema: ZodSchema<T>): readonly T[];

  refreshLock(): void;
}

export type PhaseResult<State extends object = object, Output = unknown> =
  | {
      readonly kind: "delegate";
      readonly request: DelegationRequest;
      readonly resumeAt: string;
      readonly nextState: State;
    }
  | { readonly kind: "done"; readonly output: Output }
  | { readonly kind: "fail"; readonly error: Error };

export type DelegationRequest =
  | PromptDelegationRequest
  | BatchDelegationRequest;

export interface PromptDelegationRequest {
  readonly kind: "prompt";
  readonly worker?: string;
  readonly prompt: string;
  readonly label: string;
  readonly retry?: RetryPolicy;
  readonly timeout?: TimeoutPolicy;
}

export interface BatchDelegationRequest {
  readonly kind: "batch";
  readonly worker?: string;
  readonly jobs: ReadonlyArray<{
    readonly id: string;
    readonly prompt: string;
  }>;
  readonly label: string;
  readonly retry?: RetryPolicy;
  readonly timeout?: TimeoutPolicy;
}

export interface Clock {
  nowWall(): Date;
  nowWallIso(): string;
  nowEpochMs(): number;
  nowMono(): number;
}
```

---

## 2. Behavioral contract

### 2.1 `runOrchestrator`
- **Preconditions**:
  - `config.name` matches `/^[a-z][a-z0-9-]*$/`.
  - `config.phases` must be a non-empty object containing the registry of available `Phase` callbacks.
  - `config.initial` must match a valid key in `config.phases`.
  - `config.initialState` must conform to `config.stateSchema` (if supplied) under Zod parsing.
  - `process.argv` determines if this is a fresh launch (no `--resume`) or resume (contains `--resume` and `--run-id <runId>`).
- **Postconditions**:
  - Never returns (either loops internally, delegates to a parent process, or exits due to completion/errors).
  - Guarantees single-process execution using an active `O_EXCL` `.lock` file under the run directory.
  - Traps `SIGINT` and `SIGTERM` signals, propagating cancel events to the active phase through `AbortSignal`.
  - Cleans up lock leases on completion or error.

### 2.2 `PhaseIO` methods
- `delegate(req, resumeAt, nextState)`:
  - **Behavior**: Writes the delegation manifest payload into `<runDir>/delegations/<label>-<attempt>.json` and updates `state.json` with `nextState` and the `pendingDelegation` tracking record.
  - **Output**: Emits the standard `@@TURNLOCK@@DELEGATE:{...}@@END@@` block on `process.stdout` and calls `process.exit(0)`.
- `done(output)`:
  - **Behavior**: Serializes and writes `output` into `<runDir>/output.json`. Writes `state.json` with final metadata.
  - **Output**: Emits the standard `@@TURNLOCK@@DONE:{...}@@END@@` block on `process.stdout`, releases the process lock, and calls `process.exit(0)`.
- `fail(error)`:
  - **Behavior**: Registers the failure record in the execution log.
  - **Output**: Emits the standard `@@TURNLOCK@@ERROR:{...}@@END@@` block on `process.stdout`, releases the process lock, and calls `process.exit(1)`.
- `consumePendingResult(schema)`:
  - **Preconditions**: Must be invoked as the first schema operation in a resume phase context.
  - **Postconditions**: Reads the result manifest of the pending delegation. Validates the manifest schema against the provided Zod schema. Returns the parsed value, incrementing the consumption counter.
  - **Failure behavior**: Throws `DelegationSchemaError` if validation fails. Throws `ProtocolError` if invoked multiple times or in an inappropriate phase.

---

## 3. Error semantics

Turnlock classifies errors into concrete classes deriving from `OrchestratorError`:

| Error Class | Origin / Cause | Expected Handling Strategy |
|---|---|---|
| `PhaseError` | Phase callback threw an unhandled error or returned without emitting a `PhaseResult` | Fatal. Turnlock intercepts, updates state, writes `ERROR` to stdout, and exits 1. |
| `RunLockedError` | Attempted to run an orchestrator that is already running (failed lock lease check) | Intercepted at entry. Aborts execution immediately, exits 1. |
| `StateCorruptedError` | `state.json` file is present but contains invalid or corrupted JSON | Fatal. System exits 1 to prevent writing over corrupt states. |
| `StateMissingError` | Resuming a run but `state.json` is missing from the directory | Fatal. Cannot reconstruct FSM context; exits 1. |
| `StateVersionMismatchError` | `state.json` schema version is incompatible with current Turnlock version | Fatal. Requires manual remediation or migration; exits 1. |
| `ProtocolError` | Invalid API usage (e.g. `consumePendingResult` called twice, resume phase mismatch) | Fatal. Exits 1. |
| `DelegationSchemaError` | The returned delegation output does not conform to the expected Zod schema | Non-fatal if retry is scheduled. Triggers retry backoff sequence. If max attempts reached, aborts. |
| `DelegationTimeoutError` | A delegation remained pending past its scheduled deadline | Intercepted by parent launcher/Turnlock. Aborts and transitions to fail. |

---

## 4. Integration patterns

### 4.1 Dependency Setup
The parent consumer (`/go` package) depends on Turnlock relative linking:
```json
{
  "dependencies": {
    "turnlock": "file:../../../VegaCorp/turnlock",
    "zod": "4.4.3"
  }
}
```
> [!IMPORTANT]
> **Compilation Prerequisite**: Turnlock must be built before resolving the link. Run `bun run build` in the Turnlock directory to generate `./dist/index.js` and `./dist/index.d.ts`.

### 4.2 Lifecycle Configuration
Turnlock owns the directory lifecycle:
- Creation of `runDir`: `<runDirRoot>/<orchestratorName>/<runId>`.
- Writing of `state.json` and `events.ndjson`.
- Lock lease refresh (default 30 mins). Long-running operations must call `io.refreshLock()` periodically (e.g., every 20-25 mins) to prevent lease expiry.

---

## 5. Consumer constraints

- **Process stdout is sacred**: `process.stdout` is completely reserved for protocol blocks (`@@TURNLOCK@@ ... @@END@@`). Consuming code (phases or internal libraries) **must never** write to `process.stdout` or use `console.log`. All diagnostics and logs must go to `process.stderr` (via `io.logger`) or specific files.
- **Signals trapping**: Turnlock sets handlers for `SIGINT` and `SIGTERM`. Phases must not override these handlers; they must check `io.signal` for cancellation.
- **Process exit discipline**: The orchestrator exits processes automatically upon phase resolution. User phases must return or throw; they must not call `process.exit()`.
- **No static state**: No module-level variables should carry mutable execution context. All run-specific data must be held within the Turnlock `State` object or under unique run directory paths.

---

## 6. Known limitations

- **Zod Version Incompatibility**: Turnlock uses Zod v3. `/go` uses Zod v4. When providing `config.stateSchema` or schema to `consumePendingResult`, typescript throws type mismatch errors. The consumer must cast the Zod v4 schema to `any` or wrap it explicitly at the Turnlock boundary.
- **No transition chaining**: Turnlock v0.9.0 does not support `io.transition()`. Moving to another phase is **impossible** without terminating (`done`), failing (`fail`), or performing a delegation (`delegate`).

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
