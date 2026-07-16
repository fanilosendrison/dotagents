---
id: NIB-M-GO-ORCHESTRATOR-SCHEMAS
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/schemas
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Orchestrator Schemas

VegaCorp — July 2026

---

## 1. Purpose

This module defines and exports all Zod validation schemas and derived TypeScript types used by the `/go` Turnlock orchestrator and its startup tasks. It ensures structural integrity and validation limits at runtime transitions.

---

## 2. Inputs

- **Reference Specification**: [workflow-artifacts.md](../../working/contracts/workflow-artifacts.md) for types mapping.
- **Dependency Contracts**:
  - [DC-ZOD-3-4-COMPAT.md](../DC-ZOD-3-4-COMPAT.md).

---

## 3. Outputs

Exports the following Zod v4 schemas and matching TypeScript types:

- `bootstrapStateSchema` / `BootstrapState`
- `workflowStateSchema` / `WorkflowState`
- `runtimeStateSchema` / `RuntimeState` (discriminated union)
- `workflowPolicySchema` / `WorkflowPolicy`
- `repoCaptureSchema` / `RepoCapture`
- `runInitRecordSchema` / `RunInitRecord`
- `runInitOwnershipMarkerSchema` / `RunInitOwnershipMarker`
- `bootstrapTaskRecordSchema` / `BootstrapTaskRecord`
- `bootstrapTaskCheckpointSchema` / `BootstrapTaskCheckpoint`
- `workflowExecutionRecordSchema` / `WorkflowExecutionRecord`
- `businessArtifactRecordSchema` / `BusinessArtifactRecord`
- `runCaptureArtifactSchema` / `RunCaptureArtifact`
- `dirtyStateDiffArtifactSchema` / `DirtyStateDiffArtifact`
- `workSessionSchema` / `WorkSession`
- `projectDiscoverySchema` / `ProjectDiscovery`
- `implementationResultSchema` / `ImplementationResult` (*Note: internal structure schema defined in [NIB-M-GO-IMPLEMENTATION-DELEGATION-STUB.md](./NIB-M-GO-IMPLEMENTATION-DELEGATION-STUB.md)*)

---

## 4. Algorithm

All schemas are compiled using Zod v4. The following strict validation requirements apply:

### 4.1 Strictness Invariant
Every object schema must declare `.strict()` to reject unmapped fields and prevent hidden inputs, except for the global `WorkflowState` container schema which may use `.passthrough()` to facilitate backward and forward compatibility with stages under development.

### 4.2 Discriminated Union
`runtimeStateSchema` is a discriminated union of `bootstrapStateSchema` and `workflowStateSchema` using the `schema` identifier literal:
```ts
export const runtimeStateSchema = z.discriminatedUnion("schema", [
  bootstrapStateSchema,
  workflowStateSchema
]);
```

### 4.3 Policy sub-schemas
`workflowPolicySchema` must strictly validate all six policy properties as objects:
- `dirtyState` (`require-clean` | `adopt-as-input` | `human-gate-if-dirty`).
- `discovery` (`allowSourceCheckoutDraft`, `allowWorkspaceRerun`, `noReliableGateBehavior`).
- `gates` (`requiredKinds`, `allowOptionalGateFailure`).
- `delegation` (`implementationBlockedBehavior`, `allowAutomaticRemediation`, `remediationApproval`).
- `review` (audit capture flags, intents handling).
- `packaging` (clean workspace criteria, PR rules).
- `retention` (cleanup policies).

### 4.4 Task Records, Identifiers, and Checkpoints
- **Run ID validation**: All fields holding a `runId` must strictly validate against the Crockford ULID regex `/^[0-9A-HJKMNP-TV-Z]{26}$/` to ensure identifier uniqueness and syntax correctness.
- `bootstrapTaskRecordSchema`: maps task name enums (`prerequisite-validation`, `repo-capture`, etc.) and status enums (`not-started`, `running`, `passed`, `failed`, `errored`, `cancelled`).
- `bootstrapTaskCheckpointSchema`: requires `inputHash` matching the standard hexadecimal `sha256:` prefix pattern, `startedAt` and `endedAt` conforming to ISO-8601 datetime strings.

---

## 5. Example

Excerpts from the schemas file `src/orchestrator/schemas.ts`:

```ts
import { z } from "zod";

export const runIdSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);

export const bootstrapStateSchema = z.object({
  schema: z.literal("go.bootstrap-state.v1"),
  invocationDirectory: z.string().min(1),
  policy: workflowPolicySchema,
  captureContext: captureContextSchema,
}).strict();

export const runInitRecordSchema = z.object({
  schema: z.literal("go.run-init.v1"),
  runId: runIdSchema,
  repoCapture: repoCaptureSchema,
  repoCaptureHash: z.string().min(1),
  workflowPolicyHash: z.string().min(1),
  captureContextHash: z.string().min(1),
  turnlockRun: turnlockRunRefSchema,
  artefactRootRef: z.string().min(1),
  workflowLogRootRef: z.string().optional(),
  workspaceRootReservedPath: z.string().min(1),
  ownershipMarkerRef: z.string().min(1),
  initializedAt: z.string().datetime(),
  dirtyStateDiff: dirtyStateDiffArtifactSchema.optional()
}).strict();
```


---

## 6. Edge cases

- **Backward compatibility fallback**: The `workspaceRootReservedPath` field inside `runInitRecordSchema` and `runInitOwnershipMarkerSchema` must dynamically read `worktreeRootReservedPath` as an optional alias fallback, but write `workspaceRootReservedPath` as the primary key.
- **Empty Dirty Diff Artifact**: If the repository is clean, `dirtyStateDiffArtifactSchema` optional fields (`sourceStatusPorcelainRef`, `sourcePatchRef`) must be allowed to resolve as absent rather than throwing schema errors.

---

## 7. Constraints

- **Strict Date Formats**: All timestamps (e.g. `initializedAt`, `createdAt`, `startedAt`) must validate using Zod `.datetime()` or a custom regex conforming to ISO 8601 UTC notation.
- **No runtime singletons**: Schema validators must remain thread-safe and avoid cached states.

---

## 8. Integration

This module is imported by the orchestrator configuration bridge and individual bootstrap tasks:

```ts
import { bootstrapStateSchema } from "./schemas.js";

const state = bootstrapStateSchema.parse(rawState);
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
