---
id: NIB-M-GO-HARNESS-SCHEMAS
type: nib-module
version: "1.0.0"
scope: go-phase-harness/schemas
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness Schemas

VegaCorp - July 2026

---

## 1. Purpose

This module defines the public TypeScript types and Zod schemas used by the
standalone `/go` phase harness. It is the single authority for structural
validation of phase input, phase draft output, canonical phase output, and phase
errors during construction.

The module must not perform filesystem, Git, path, or evidence containment
checks. Those checks belong to the preflight, state, evidence, assembly, and
persistence modules.

---

## 2. Inputs

This module has no runtime input. It consumes the type contracts defined by
`NIB-S-GO-PHASE-HARNESS`.

Normative external dependency:

- Zod `4.4.3`, used only for runtime schema validation and refinements. See
  `DC-ZOD`.

---

## 3. Outputs

The module exports these TypeScript types:

```ts
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type PhaseInput = {
  runId: string;
  workDir: string;
  artefactDir: string;
  baseSha: string;
  phase: string;
  config?: JsonObject;
};

export type PhaseDraftOutput = {
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[];
  errors: PhaseError[];
};

export type PhaseOutput = {
  runId: string;
  phase: string;
  status: "passed" | "failed" | "skipped" | "errored";
  artefactDir: string;
  evidenceRefs: string[];
  errors: PhaseError[];
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
};

export type PhaseError = {
  message: string;
  severity: "blocking" | "major" | "minor";
  file?: string;
  line?: number;
  evidenceRef?: string;
};
```

The module exports these Zod schemas:

```ts
export const jsonValueSchema: z.ZodType<JsonValue>;
export const jsonObjectSchema: z.ZodType<JsonObject>;
export const phaseInputSchema: z.ZodType<PhaseInput>;
export const phaseErrorSchema: z.ZodType<PhaseError>;
export const phaseDraftOutputSchema: z.ZodType<PhaseDraftOutput>;
export const phaseOutputSchema: z.ZodType<PhaseOutput>;
```

---

## 4. Algorithm

### 4.1 JSON value schema

Build `jsonValueSchema` recursively.

```ts
jsonValueSchema = union(
  null,
  boolean,
  number,
  string,
  array(lazy(jsonValueSchema)),
  record(string, lazy(jsonValueSchema)),
);
```

`number` values must be finite. `NaN`, `Infinity`, and `-Infinity` are not
JSON-serializable and must fail validation.

### 4.2 Phase input schema

Validate the object shape only:

```ts
phaseInputSchema = object({
  runId: string,
  workDir: string,
  artefactDir: string,
  baseSha: string,
  phase: string,
  config: optional(jsonObjectSchema),
}).strict();
```

This schema does not validate absolute paths, Git object IDs, repository roots,
or stable ASCII identifiers. M1 preflight performs those checks because they
require filesystem and Git context.

### 4.3 Phase error schema

Validate basic field shape:

```ts
phaseErrorSchema = object({
  message: string,
  severity: enum("blocking", "major", "minor"),
  file: optional(string),
  line: optional(number.integer()),
  evidenceRef: optional(string),
}).strict()
```

Path containment, `..` segment rejection, NUL byte rejection, and file existence
are not performed here. Line positivity is also not performed here: M5 evidence
validation owns semantic error metadata validation so invalid values such as
`line: 0` can be omitted while preserving the rest of the phase error.

### 4.4 Phase draft output schema

Validate exact shape and status/error coupling:

```ts
phaseDraftOutputSchema = object({
  status: enum("passed", "failed", "skipped"),
  evidenceRefs: array(string),
  errors: array(phaseErrorSchema),
})
  .strict()
  .superRefine(enforceDraftStatusErrorsCoupling)
```

`enforceDraftStatusErrorsCoupling` must apply these rules:

- `passed` requires `errors.length === 0`.
- `skipped` requires `errors.length === 0`.
- `failed` requires `errors.length > 0`.

The draft schema must reject `status: "errored"`. Only the harness can produce
`errored`.

### 4.5 Phase output schema

Validate exact shape and canonical refinements:

```ts
phaseOutputSchema = object({
  runId: string.min(1),
  phase: string.min(1),
  status: enum("passed", "failed", "skipped", "errored"),
  artefactDir: string.min(1),
  evidenceRefs: array(string),
  errors: array(phaseErrorSchema),
  headShaAfter: nullable(string),
  trackedWorktreeHash: nullable(string),
  worktreeClean: nullable(boolean),
})
  .strict()
  .superRefine(enforceOutputRefinements)
```

`enforceOutputRefinements` must apply these rules:

- `passed` requires `errors.length === 0`.
- `skipped` requires `errors.length === 0`.
- `failed` requires `errors.length > 0`.
- `errored` requires at least one error with `severity: "blocking"`.
- When `status !== "errored"`, `headShaAfter` is non-null.
- When `status !== "errored"`, `trackedWorktreeHash` is non-null.
- When `status !== "errored"`, `worktreeClean` is non-null.

No schema refinement validates the exact Git hash length. The phase contract
allows SHA-1 and SHA-256 repositories, and the state module owns Git semantics.

---

## 5. Example

Input draft:

```ts
const draft = {
  status: "failed",
  evidenceRefs: ["evidence/lint.json"],
  errors: [
    {
      message: "Lint failed",
      severity: "minor",
      file: "src/example.ts",
      line: 12,
      evidenceRef: "evidence/lint.json",
    },
  ],
};
```

Expected result:

```ts
phaseDraftOutputSchema.parse(draft) === draft;
```

Counter-example:

```ts
phaseDraftOutputSchema.parse({
  status: "failed",
  evidenceRefs: [],
  errors: [],
});
```

Expected behavior: validation fails because `failed` requires at least one
`PhaseError`.

---

## 6. Edge cases

- Unknown object keys: reject via strict object schemas.
- `config` omitted: accept.
- `config` set to `undefined`: treat as omitted by normal JavaScript object
  semantics if the property is absent; reject if the property is present with a
  non-JSON value.
- Non-finite numbers inside `config`: reject.
- `PhaseError.line` equal to `0`: accept structurally, then M5 evidence
  validation omits it and reports a blocking harness error.
- `PhaseDraftOutput.status === "errored"`: reject.
- `PhaseOutput.status === "errored"` with no blocking error: reject.
- Non-errored `PhaseOutput` with any canonical field set to `null`: reject.

---

## 7. Constraints

- The schemas must be deterministic and side-effect free.
- The module must not import Git, filesystem, path, or process helpers.
- The module must not coerce values. Invalid input fails instead of being
  repaired.
- The module must export schemas and TypeScript types from one stable public
  entrypoint so other harness modules use the same definitions.

---

## 8. Integration

M1 uses `phaseInputSchema` before filesystem preflight.

M5 uses `phaseDraftOutputSchema` when a phase returns.

M6 uses `phaseOutputSchema` after assembling canonical output and again after
normalizing invalid assembled output into `errored`.

```ts
const parsedInput = phaseInputSchema.parse(input);
const parsedDraft = phaseDraftOutputSchema.safeParse(execution.draft);
const parsedOutput = phaseOutputSchema.safeParse(output);
```

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
