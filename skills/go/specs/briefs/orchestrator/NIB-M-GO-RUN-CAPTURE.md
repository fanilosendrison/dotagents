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

This module captures the initial context parameters of the `/go` invocation. It normalizes the user-supplied prompt text, writes it as a static evidence file inside the artifacts directory, computes its cryptographic digest, and produces the `RunCaptureArtifact`.

---

## 2. Inputs

```ts
type RunCaptureInput = {
  runId: string;
  artefactRoot: string;
  captureContext: CaptureContext;
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

```ts
type RunCaptureArtifact = {
  schema: "go.run-capture.v1";
  id: string;
  runId: string;
  sessionRef: string;
  promptAtGoRef: string; // Relative path matching "prompt-at-go.txt"
  promptHash: string; // sha256 hex digest
  capturedAt: string;
};
```

- Returns a Promise resolving to `RunCaptureArtifact`.
- Throws a `PhaseError` if files cannot be written.

---

## 4. Algorithm

### 4.1 Prompt Unification
1. Read the raw text string from `captureContext.promptAtGo`.
2. Apply prompt text normalization:
   - Convert Unicode content to canonical NFC.
   - Unify carriage return sequences (`\r\n` or `\r`) to LF (`\n`).
   - Trim trailing whitespaces on each line.
   - Ensure the string terminates with exactly one newline (`\n`).
3. Store the unified string in memory.

### 4.2 Evidence File Writing
1. Define the target file path:
   `promptFile = path.join(artefactRoot, "prompt-at-go.txt")`
2. Write the normalized prompt text bytes to `promptFile` atomically (using the atomic write pattern defined in `NIB-M-GO-BOOTSTRAP-PERSISTENCE`).

### 4.3 Digest Hashing and Artifact Creation
1. Calculate the SHA-256 digest hash of the normalized prompt bytes.
2. Generate a unique Crockford ULID string for the artifact `id`.
3. Construct the `RunCaptureArtifact` object:
   - `id`: The generated ULID.
   - `runId`: From inputs.
   - `sessionRef`: `captureContext.sessionRef`.
   - `promptAtGoRef`: `"prompt-at-go.txt"` (relative path).
   - `promptHash`: The computed SHA-256 hash string (with prefix `sha256:`).
   - `capturedAt`: The current timestamp in ISO 8601 UTC format.
4. Return the constructed artifact.

---

## 5. Example

### 5.1 Captured Run Context
Expected `prompt-at-go.txt` contents on disk:
```text
Implement standard math utilities.
```
Returned `RunCaptureArtifact` value:
```json
{
  "schema": "go.run-capture.v1",
  "id": "01JTESTRUNID0000000000000A",
  "runId": "01JTESTRUNID00000000000000",
  "sessionRef": "session-1234",
  "promptAtGoRef": "prompt-at-go.txt",
  "promptHash": "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "capturedAt": "2026-07-16T15:28:00.000Z"
}
```

---

## 6. Edge cases

- **Empty Prompt Validation**: If `captureContext.promptAtGo` contains only whitespace characters after normalization, the task must reject the run with a blocking validation error.

---

## 7. Constraints

- **No Unicode BOM**: The written file must not contain a Byte Order Mark.
- **Path containment**: `prompt-at-go.txt` must sit directly under `artefactRoot`. No relative traversal paths are allowed.

---

## 8. Integration

Executed in parallel with dirty-state capture during the bootstrap pipeline:

```ts
import { captureRunContext } from "./run-capture.js";

const runCapture = await captureRunContext({
  runId: state.runId,
  artefactRoot: runInit.artefactRootRef,
  captureContext: state.captureContext
});
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
