---
id: NIB-M-GO-RUN-CAPTURE
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/run-capture
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Run Capture

VegaCorp — July 2026

---

## 1. Purpose

This module captures the initial context parameters of the `/go` invocation. It normalizes the user-supplied prompt text, writes it as a static evidence file, computes its cryptographic digest, and produces the `RunCaptureArtifact`.

---

## 2. Inputs

```ts
type RunCaptureInput = {
  runId: string;
  artefactRoot: string;
  captureContext: CaptureContext;
  clock: { nowWallIso: () => string };
};

type CaptureContext = {
  schema: "go.capture-context.v1";
  sessionRef: string;
  promptAtGo: string;
};
```

- **Dependency Contracts**:
  - [NIB-M-GO-CANONICAL-HASHING.md](./NIB-M-GO-CANONICAL-HASHING.md) for prompt text normalization and hashing rules.
  - [NIB-M-GO-BOOTSTRAP-PERSISTENCE.md](./NIB-M-GO-BOOTSTRAP-PERSISTENCE.md) for atomic file writing.

---

## 3. Outputs

- Writes the parsed `RunCaptureArtifact` file `run-capture.json` to:
  `<artefactRoot>/startup/run-capture/`
- Writes the evidence prompt file `prompt-at-go.txt` to:
  `<artefactRoot>/startup/run-capture/`
- Writes the `BootstrapTaskCheckpoint` file `task-record.json` to:
  `<artefactRoot>/startup/run-capture/`
- Returns a Promise resolving to `RunCaptureArtifact`:
  ```ts
  type RunCaptureArtifact = {
    schema: "go.run-capture.v1";
    id: string;
    runId: string;
    sessionRef: string;
    promptAtGoRef: string; // Relative path matching "startup/run-capture/prompt-at-go.txt"
    promptHash: string; // sha256 hex digest
    capturedAt: string;
  };
  ```
- Throws a `PhaseError` if files cannot be written or if prompt is empty.

---

## 4. Algorithm

### 4.1 Inputs Check and Prompt Unification
1. Read the parameters from `captureContext`.
2. **Session Reference Validation**: Verify `captureContext.sessionRef` is present, is a string, and is not empty. If absent or empty, throw a blocking validation error (resolves to `failed`).
3. Read the raw text string from `captureContext.promptAtGo`.
4. Apply prompt text normalization:
   - Convert Unicode content to canonical NFC.
   - Unify carriage return sequences (`\r\n` or `\r`) to LF (`\n`).
   - Trim trailing whitespaces on each line.
   - Ensure the string terminates with exactly one newline (`\n`).
5. Store the unified string in memory. If the resulting string is empty or contains only whitespace, throw `failed`.

### 4.2 Evidence File Writing
1. Define the target directory:
   `targetDir = path.join(artefactRoot, "startup", "run-capture")`
2. Create `targetDir` recursively.
3. Write the normalized prompt text bytes to `targetDir/prompt-at-go.txt` atomically.

### 4.3 Digest Hashing and Artifact Creation
1. Calculate the SHA-256 digest hash of the normalized prompt bytes written to disk.
2. Derivation of ID: The identifier `id` of the artifact must be derived deterministically from the `runId`:
   `id = runId`
   This guarantees that two executions of the task with the same inputs produce the same `id` (ensuring idempotence).
3. Construct the `RunCaptureArtifact` object:
   - `id`: `runId`.
   - `runId`: `runId`.
   - `sessionRef`: `captureContext.sessionRef`.
   - `promptAtGoRef`: `"startup/run-capture/prompt-at-go.txt"` (relative path).
   - `promptHash`: The computed SHA-256 hash string (with prefix `sha256:`).
   - `capturedAt`: The current timestamp retrieved from Turnlock's runtime clock passed via pipeline context (`clock.nowWallIso()`).
4. Save the artifact atomically to `targetDir/run-capture.json`.
5. Concurrently, compute `inputHash` as the JCS hash of `{ runId, artefactRoot }`.
6. Write the `BootstrapTaskCheckpoint` file `task-record.json` atomically, using `inputHash`, the JCS hash of the `CaptureContext` as `captureContextHash`, recording `startedAt` (captured via `clock.nowWallIso()` at task start) and `endedAt` (captured via `clock.nowWallIso()` at write time), and setting all other hashes (`repoCaptureHash`, `workflowPolicyHash`) to the 64-zero sentinel value.

---

## 5. Example

### 5.1 Saved Evidence Prompt
File contents of `<artefactRoot>/startup/run-capture/prompt-at-go.txt`:
```text
Implement standard math utilities.
```

### 5.2 Saved Run Capture Artifact
Saved `<artefactRoot>/startup/run-capture/run-capture.json`:
```json
{
  "schema": "go.run-capture.v1",
  "id": "01JTESTRUNID00000000000000",
  "runId": "01JTESTRUNID00000000000000",
  "sessionRef": "session-1234",
  "promptAtGoRef": "startup/run-capture/prompt-at-go.txt",
  "promptHash": "sha256:d8a2307ef11ef74cd5c9ef816bca92837d9954a2a16d8cf4b3f11bca09c855a8",
  "capturedAt": "2026-07-16T15:28:00.000Z"
}
```
*(Note: `promptHash` is the actual SHA-256 hash of "Implement standard math utilities.\n")*

---

## 6. Edge cases

- **Empty Prompt Validation**: If the input prompt is empty or contains only whitespace, throw `failed`.
- **Checkpoint Adoption**: If the task-record is adopted, verify that both the text prompt file and the JSON artifact exist and that the files have matching hashes. If not, fail-closed.

---

## 7. Constraints

- **No Unicode BOM**: The written file must not contain a Byte Order Mark.
- **Path containment**: All references must be relative paths and locate inside `artefactRoot`.

---

## 8. Integration

Executed in parallel with dirty-state capture during the bootstrap pipeline:

```ts
import { captureRunContext } from "./run-capture.js";

const runCapture = await captureRunContext({
  runId: state.runId,
  artefactRoot: state.artefactRoot,
  captureContext: state.captureContext,
  clock: context.clock
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
