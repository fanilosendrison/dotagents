---
id: NIB-M-GO-ASYNC-GIT-RUNNER
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/async-git-runner
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Async Git Runner

VegaCorp — July 2026

---

## 1. Purpose

This module implements the execution wrapper for Git commands and other subprocesses launched during the `/go` bootstrap phase. It ensures non-blocking asynchronous execution, captures and isolates process outputs, manages abort signals, refreshes Turnlock runtime locks, and redacts sensitive credentials from stderr logs.

---

## 2. Inputs

```ts
type GitRunnerInput = {
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  signal?: AbortSignal;
  refreshLock?: () => void;
};
```

- **Dependency Contracts**:
  - [DC-GIT-CLI-BOOTSTRAP.md](file:///Users/famillesendrison/Developper/Projects/dotagents/skills/go/specs/briefs/orchestrator/DC-GIT-CLI-BOOTSTRAP.md).
  - [DC-BUN-SPAWN-ASYNC-RUNTIME.md](file:///Users/famillesendrison/Developper/Projects/dotagents/skills/go/specs/briefs/orchestrator/DC-BUN-SPAWN-ASYNC-RUNTIME.md).

---

## 3. Outputs

```ts
type GitRunnerOutput = {
  exitCode: number;
  stdout: Buffer;
  stderr: Buffer;
};
```

- Returns a Promise resolving to `GitRunnerOutput`.
- Throws an error on execution failure (e.g. binary not found) or on abort cancellation.

---

## 4. Algorithm

### 4.1 Process Spawning
1. Verify `args` is a non-empty string array.
2. If the command modifies repository state (e.g. `init`, `commit`, `apply`, `submodule`, `push`), ensure `-c core.hooksPath=/dev/null` is present in the arguments list.
3. Spawn the child process using `Bun.spawn`:
   ```ts
   const proc = Bun.spawn(args, {
     cwd,
     env,
     stdout: "pipe",
     stderr: "pipe"
   });
   ```

### 4.2 Stream Draining
1. Consume `proc.stdout` and `proc.stderr` concurrently to prevent OS buffer deadlocks:
   ```ts
   const stdoutPromise = new Response(proc.stdout).arrayBuffer();
   const stderrPromise = new Response(proc.stderr).arrayBuffer();
   ```
2. Wait for process exit and buffers to resolve using `Promise.all`:
   ```ts
   const [exitCode, stdoutBuf, stderrBuf] = await Promise.all([
     proc.exited,
     stdoutPromise,
     stderrPromise
   ]);
   ```

### 4.3 Abort Signal Propagation
1. If `signal` is provided, monitor `signal.aborted` status.
2. If aborted before spawn, throw a `CancelError` immediately.
3. If aborted during execution, register a listener:
   `signal.addEventListener("abort", () => proc.kill())`
4. On process completion, remove the abort listener. If process exited due to abort signal, map exit to cancellation.

### 4.4 Lock Refresh Loop
1. If the `refreshLock` callback is supplied, instantiate a periodic timer during process execution.
2. **Interval**: Trigger `refreshLock()` every 2 minutes while `proc.exited` remains pending.
3. Clear the timer immediately upon process exit or error.

### 4.5 Token Redaction
Before throwing or logging any command failure, scan the `stderr` string and redaction targets:
1. Locate potential security token signatures matching Git credentials or HTTP Bearer tokens (e.g. standard PAT formats: `ghp_[a-zA-Z0-9]{36}`, `glpat-[a-zA-Z0-9_-]{20}`).
2. Replace matching sequences with the string `[REDACTED_TOKEN]`.
3. Throw the sanitized error.

---

## 5. Example

### 5.1 Simple Execution
Input command:
```ts
const result = await runGit({
  args: ["git", "-C", "/repo", "status", "--porcelain"]
});
```
Expected output:
```ts
{
  exitCode: 0,
  stdout: Buffer.from("M file.txt\0"),
  stderr: Buffer.alloc(0)
}
```

---

## 6. Edge cases

- **Binary Missing**: If `git` is absent from host `PATH`, the `Bun.spawn` call throws synchronously. Catch the exception and wrap it in a clean `PhaseError` indicating the missing prerequisite.
- **Process Aborted after Completion**: If the signal aborts after the process resolves, ignore the signal and return the successful result.

---

## 7. Constraints

- **No Synchronous execution**: Subprocess calls must remain entirely asynchronous. Blocking synchronous calls are prohibited.
- **No stdout pollution**: Standard outputs from child processes must be handled in memory and **never** inherited to the parent stdout.

---

## 8. Integration

This module acts as the core communication layer for all git-based bootstrap tasks:

```ts
import { runGit } from "./async-process.js";

const result = await runGit({
  args: ["git", "-C", workspaceRoot, "status", "--porcelain=v1", "-z"],
  signal,
  refreshLock
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
