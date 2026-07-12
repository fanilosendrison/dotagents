---
id: DC-ZOD
type: dependency-contract
version: "1.0.0"
dependency_version: "4.4.3"
scope: zod
status: active
consumers: [codex]
referenced_by:
  - NIB-M-GO-HARNESS-SCHEMAS
  - NIB-M-GO-HARNESS-PREFLIGHT
  - NIB-M-GO-HARNESS-EVIDENCE
  - NIB-M-GO-HARNESS-ASSEMBLY
  - NIB-M-GO-HARNESS-PERSISTENCE
  - NIB-T-GO-PHASE-HARNESS
superseded_by: []
---

# Dependency Contract - Zod

## 0. Identity

- Component name: Zod.
- Version: `4.4.3`.
- Source: npm package `zod`.
- Role: validate runtime shapes and refinements for phase input, phase draft
  output, phase output, phase errors, and JSON-serializable configuration.

## 1. Interface

The harness may use these Zod capabilities:

```ts
import { z } from "zod";

z.object(shape).strict();
z.string();
z.string().min(1);
z.number().finite();
z.number().int().positive();
z.boolean();
z.null();
z.array(schema);
z.record(z.string(), schema);
z.union([schemaA, schemaB]);
z.enum(values);
z.optional(schema);
z.nullable(schema);
z.lazy(() => schema);
schema.safeParse(value);
schema.parse(value);
schema.superRefine((value, context) => void);
context.addIssue(issue);
```

The public harness schemas are:

```ts
jsonValueSchema: z.ZodType<JsonValue>;
jsonObjectSchema: z.ZodType<JsonObject>;
phaseInputSchema: z.ZodType<PhaseInput>;
phaseErrorSchema: z.ZodType<PhaseError>;
phaseDraftOutputSchema: z.ZodType<PhaseDraftOutput>;
phaseOutputSchema: z.ZodType<PhaseOutput>;
```

## 2. Behavioral Contract

Schemas must reject unknown object keys by using `.strict()`.

Schemas must not coerce values. A string containing a number is not a number. A
truthy value is not a boolean.

`jsonValueSchema` must accept only:

- `null`
- booleans
- finite numbers
- strings
- arrays of JSON values
- records with string keys and JSON values

`jsonValueSchema` must reject:

- `undefined`
- functions
- symbols
- `NaN`
- `Infinity`
- `-Infinity`
- `Date`
- `Map`
- `Set`
- class instances
- cyclic objects

`phaseDraftOutputSchema` refinements:

- `passed` requires `errors.length === 0`.
- `skipped` requires `errors.length === 0`.
- `failed` requires `errors.length > 0`.
- `errored` is not a valid draft status.

`phaseOutputSchema` refinements:

- `passed` requires `errors.length === 0`.
- `skipped` requires `errors.length === 0`.
- `failed` requires `errors.length > 0`.
- `errored` requires at least one blocking error.
- Non-`errored` outputs require non-null `headShaAfter`.
- Non-`errored` outputs require non-null `trackedWorktreeHash`.
- Non-`errored` outputs require non-null `worktreeClean`.

## 3. Error Semantics

`safeParse` must be used when validation failure is expected and should be
converted into a harness error.

`parse` may be used only in tests or internal assertions where throwing is the
desired failure mode.

Zod issue text is diagnostic. The harness may summarize validation failure but
must not expose full internal issue trees as a stable public contract.

Validation failure in preflight produces no `output.json`.

Validation failure after phase execution produces an `errored` `PhaseOutput`
when the harness can still write one.

## 4. Integration Patterns

M1 preflight validates `PhaseInput` shape before filesystem and Git checks.

M5 evidence validation validates returned `PhaseDraftOutput` before inspecting
evidence references.

M6 assembly validates candidate `PhaseOutput`, then validates the normalized
`errored` output if the candidate fails.

M7 persistence validates `PhaseOutput` immediately before writing `output.json`.

## 5. Consumer Constraints

- Do not use Zod coercion APIs.
- Do not rely on Zod defaults or transforms for harness semantics.
- Do not validate filesystem containment, Git object IDs, or path absoluteness
  in Zod schemas; those checks belong to the modules that have context.
- Do not make Zod error wording part of the stable harness output contract.

## 6. Known Limitations

- Recursive JSON validation must use `z.lazy`.
- Cyclic input is invalid JSON configuration. The consumer must treat cyclic
  structures as validation failure rather than trying to serialize them.
- This contract is pinned to Zod `4.4.3`; older Zod 3 APIs are out of scope.
