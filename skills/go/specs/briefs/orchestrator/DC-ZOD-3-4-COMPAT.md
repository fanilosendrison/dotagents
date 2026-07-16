---
id: DC-ZOD-3-4-COMPAT
type: dependency-contract
version: "1.0.0"
dependency_version: "Zod v3 in Turnlock / Zod v4 in /go"
scope: zod-compat
status: active
consumers: [claude-code]
referenced_by:
  - NIB-S-GO-TURNLOCK-ORCHESTRATOR
  - NIB-M-GO-ORCHESTRATOR-BRIDGE
  - NIB-M-GO-ORCHESTRATOR-SCHEMAS
superseded_by: []
---

# Dependency Contract — Zod v3 / Zod v4 Compatibility

VegaCorp — July 2026

---

## 0. Identity

- **Component name**: Zod validation library.
- **Version**: Zod `^3.22.0` (in Turnlock) / Zod `4.4.3` (in `/go`).
- **Source**: npm registry (`zod`).
- **Role**: Validates state schemas and delegation payloads. Bridges the Zod v4 schemas built by `/go` with the Zod v3 validation entry points expected by the Turnlock runtime.

---

## 1. Interface

Turnlock expects inputs typings to match Zod v3 schemas:

```ts
import type { ZodSchema } from "zod"; // Turnlock uses Zod v3
```

`/go` compiles schemas using Zod v4:

```ts
import { z } from "zod"; // /go imports Zod v4
```

TypeScript triggers compilation errors when assigning a Zod v4 schema to a Turnlock function (e.g. `stateSchema` or `consumePendingResult`) due to minor version signature differences:

```text
Type 'ZodObject<...>' is not assignable to type 'ZodSchema<...>'
```

---

## 2. Behavioral Contract

- **Runtime API Compatibility**: The runtime methods used by Turnlock (`schema.safeParse(data)` and `error.issues`) are structurally identical and fully compatible between Zod v3 and Zod v4. 
- **Type casting**: To bypass the TypeScript check without compiling errors, the consumer must cast Zod v4 schemas using `as any` or `as unknown as ZodSchema<any>` when passing them to Turnlock API calls.

Example configuration cast:
```ts
import { runtimeStateSchema } from "./schemas/runtime-state.js"; // Zod v4 object

const config: OrchestratorConfig<object> = {
  // ...
  stateSchema: runtimeStateSchema as any, // Cast v4 -> v3
};
```

Example consumption cast:
```ts
const result = io.consumePendingResult(implementationResultSchema as any);
```

---

## 3. Error Semantics

- **Validation Errors**: The errors returned by validation (`validation.error.issues`) contain identical shapes. `ZodIssue` properties (`code`, `path`, `message`) remain fully compatible and parseable under both versions.

---

## 4. Integration patterns

All core schema definitions in `/go` (such as `runtime-state.ts` and `workflow-artifacts.ts`) must compile strictly with Zod v4 type assertions. The type casting must occur exclusively at the boundary of Turnlock invocation points (FSM config or `io` context methods).

---

## 5. Consumer constraints

- **Confined Casts**: The `as any` cast must not propagate to the core `/go` logic. Task modules must handle strongly-typed Zod v4 objects; only the Turnlock entry points use the cast.
- **Schema strictness**: `/go` schemas must use strict types (no implicit `.passthrough()` except where explicitly required for future compatibility, such as the global `WorkflowState` container during transition periods).

---

## 6. Known limitations

- **Future alignment path**: If Turnlock upgrades its dependency version to Zod v4, all type casts can be removed. The wrapper adapter acts as a temporary compatibility boundary.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
