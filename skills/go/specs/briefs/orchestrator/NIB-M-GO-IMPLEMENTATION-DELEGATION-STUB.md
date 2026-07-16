---
id: NIB-M-GO-IMPLEMENTATION-DELEGATION-STUB
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/implementation-delegation-stub
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Implementation Delegation Stub

VegaCorp — July 2026

---

## 1. Purpose

This module specifies the prompt generation context assembly and the stub implementation settlement phase. It structures the prompt sent to the delegated implementation agent and defines the Turnlock settlement phase executing the validation gate.

---

## 2. Inputs

```ts
type ImplementationDelegationInput = {
  workflowState: {
    runCapture: RunCaptureArtifact;
    workSession: WorkSession;
    projectDiscovery: ProjectDiscovery;
  };
};
```

- **Dependency Contracts**:
  - [NIB-M-GO-ORCHESTRATOR-SCHEMAS.md](./NIB-M-GO-ORCHESTRATOR-SCHEMAS.md) for `implementationResultSchema`.
  - [NIB-M-GO-WORKSPACE-SETUP-CONTRACT.md](./NIB-M-GO-WORKSPACE-SETUP-CONTRACT.md) for `WorkSession`.
  - [NIB-M-GO-PROJECT-DISCOVERY-FINALIZE.md](./NIB-M-GO-PROJECT-DISCOVERY-FINALIZE.md) for `ProjectDiscovery`.

---

## 3. Outputs

- Writes the context prompt description file `agent-context.txt` to:
  `<workSession.workspaceRoot>/agent-context.txt`
- Consumes `ImplementationResult` payload (passthrough JSON) at settlement:
  ```ts
  type ImplementationResult = Record<string, any>;
  ```
- Terminates the phase execution by calling `io.done()`.

---

## 4. Algorithm

### 4.1 Build Implementation Prompt
1. Define the context builder function signature:
   ```ts
   function buildImplementationPrompt(state: {
     runCapture: RunCaptureArtifact;
     workSession: WorkSession;
     projectDiscovery: ProjectDiscovery;
   }): string;
   ```
2. Retrieve the user intent prompt from `runCapture.promptAtGoRef`.
3. Extract source repo parameters from `workSession` (base head SHA, work branch, default target branch).
4. Extract mechanical check execution vectors from `projectDiscovery` (inspected files, gate commands, package manager).
5. Synthesize instructions:
   - Instruct the agent to execute implementation code changes within `workSession.workspaceRoot`.
   - Alert the agent of available mechanical test gates and command runner contexts.
6. Save the return string to `<workSession.workspaceRoot>/agent-context.txt` to provide on-disk workspace initialization context.

### 4.2 Turnlock Implementation Settlement (Stub Phase)
Define the Turnlock settlement lifecycle handler:
1. Initialize the phase handler as a function passed directly to `definePhase`:
   ```ts
   import { definePhase } from "turnlock";
   import { implementationResultSchema } from "./schemas.js";

   export const implementationSettlementStub = definePhase<object, void>(
     async (state, io) => {
       // Consume the pending async result from delegation queue
       const result = io.consumePendingResult(implementationResultSchema as any);
       
       // Success criteria is validation of JSON envelope; no business checks are run in Phase 1
       // Truth source is the git diff captured inside the worktree
       return io.done(state);
     }
   );
   ```

---

## 5. Example

### 5.1 Generated agent-context.txt
```text
=== WORKSPACE ENVIRONMENT ===
Work Branch: work/01JTESTRUNID00000000000000
Base SHA: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
Target Branch: main

=== DETECTED MATRIX ===
Package Manager: npm
Linter Command: npm run lint
Test Runner Command: npm test

=== USER REQUEST ===
Please implement the feature described in the prompt...
```

---

## 6. Edge cases

- **Abort and Cancellation**: Turnlock orchestration layer governs delegation cancellation (e.g. process termination). The settlement handler executes synchronously upon receiving queue events, so task-level aborts are handled at the orchestration layer.

---

## 7. Constraints

- **No Business Fields**: The `ImplementationResult` schema must remain a `.passthrough()` object containing no hardcoded business fields. The only validator requirement is structure syntax validation.

---

## 8. Integration

Imported by the Turnlock phase registry:

```ts
import { implementationSettlementStub } from "./delegation-stub.js";
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
