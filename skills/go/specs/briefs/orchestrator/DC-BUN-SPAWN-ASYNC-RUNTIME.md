---
id: DC-BUN-SPAWN-ASYNC-RUNTIME
type: dependency-contract
version: "1.0.0"
dependency_version: "Bun >= 1.3.12 / Node >= 22"
scope: async-runtime
status: active
consumers: [claude-code]
referenced_by:
  - NIB-S-GO-TURNLOCK-ORCHESTRATOR
  - NIB-M-GO-ASYNC-GIT-RUNNER
  - NIB-M-GO-PREREQUISITE-VALIDATION
  - NIB-M-GO-REPO-CAPTURE
  - NIB-M-GO-WORKSPACE-SETUP-WORKTREE
superseded_by: []
---

# Dependency Contract — Bun Async Subprocess Runtime

VegaCorp — July 2026

---

## 0. Identity

- **Component name**: Bun and Node process execution runtime.
- **Version**: Bun `>= 1.3.12` / Node `>= 22`.
- **Source**: Execution environment built-in runtime modules.
- **Role**: Drives asynchronous child process execution (e.g. Git commands), I/O streams draining, and host environment queries (paths, environment variables, POSIX file permissions).

---

## 1. Interface

The runtime uses the following core APIs:

```ts
// Subprocess Spawning
export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  stdout?: "pipe" | "ignore" | "inherit" | null;
  stderr?: "pipe" | "ignore" | "inherit" | null;
}

export interface Subprocess {
  readonly exited: Promise<number>;
  readonly stdout: ReadableStream<Uint8Array>;
  readonly stderr: ReadableStream<Uint8Array>;
  kill(signalCode?: number): void;
}

// Bun global spawn primitive
declare namespace Bun {
  function spawn(args: string[], options?: SpawnOptions): Subprocess;
}

// Built-in environment queries
import os from "node:os";             // Synchronous API (os.homedir)
import fs from "node:fs/promises";    // Asynchronous API (realpath, stat)

// os.homedir() -> string
// fs.realpath(path: string) -> Promise<string>
// fs.stat(path: string) -> Promise<fs.Stats>
```

---

## 2. Behavioral Contract

### 2.1 `Bun.spawn` Asynchronous Execution
- **Spawn Setup**: All child processes must be started with `stdout: "pipe"` and `stderr: "pipe"`.
- **Deadlock Prevention**: OS pipe buffers are limited. To prevent child processes from hanging indefinitely on filled pipes, stdout and stderr streams must be consumed in parallel using concurrent reading:
  ```ts
  const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" });
  const [exitCode, stdoutBytes, stderrBytes] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).arrayBuffer(),
    new Response(proc.stderr).arrayBuffer()
  ]);
  ```
- **Abort Propagation**: When an `AbortSignal` is triggered, the runner must call `proc.kill()` immediately to terminate the subprocess.

### 2.2 Host Environment Queries
- **Realpath normalization**: All directory check values must be resolved using `fs.realpath` before performing checks to prevent path traversal using relative paths (`../`) or symbolic links.
- **POSIX Permission check**: Checking configuration file security (e.g. `ProviderConfig` permissions) requires resolving `fs.stat(path).mode`. Checks must evaluate owner-read/write bits and warn if readable/writeable by other users (group/others).

---

## 3. Error Semantics

- **Subprocess Spawning Failures**: If the binary executable is not found on the host PATH, the spawn promise rejects. The runner must catch these errors and throw clean exceptions indicating the missing utility.
- **Abort exit codes**: Terminated processes return non-zero exit codes (e.g. `130` or `143`). If `AbortSignal` is active during exit, map the failure status to `cancelled` rather than `errored`.

---

## 4. Integration patterns

The process runner is wrapped by the `GO-ASYNC-GIT-RUNNER` module. All operations that execute Git must route through this wrapper. 

> [!WARNING]
> **No Synchronous execution**: Calling synchronous process builders (`spawnSync`, `execSync`) is **strictly forbidden** for Git transactions. These block the event loop, stopping Turnlock lock lease updates and causing runs to be flagged as stale by the parent launcher.

---

## 5. Consumer constraints

- **Stdout isolation**: `stdout` from spawned processes **must never** be written directly to `process.stdout` (no `"inherit"` for stdout). If inherited, standard outputs pollute Turnlock's protocol stream.
- **Process containment**: Ensure all child processes are killed if the parent process terminates. On aborted signals, guarantee `proc.kill()` is called before finishing the task error state.

---

## 6. Known limitations

- **Stream consumption**: Using `new Response(stream).text()` is valid under Bun, but requires the standard `Response` constructor; fallbacks using `node:stream` consumers must be provided if executed under plain Node environments.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
