---
id: NIB-M-GO-STAGE-HARNESS-SCHEMAS
type: nib-module
version: "1.0.0"
scope: go-stage-harness/schemas
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness Schemas

VegaCorp - July 2026

---

## 1. Purpose

This module defines the public TypeScript types and Zod schemas used by the
standalone `/go` stage harness. It is the single authority for structural
validation of stage input, stage draft output, canonical stage output, and stage
errors during construction.

The module must not perform filesystem, Git, path, or evidence containment
checks. Those checks belong to the preflight, state, evidence, assembly, and
persistence modules.

---

## 2. Inputs

This module has no runtime input. It consumes the type contracts defined by
`NIB-S-GO-STAGE-HARNESS`.

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

export type StageInput = {
  runId: string;
  workDir: string;
  artefactDir: string;
  baseSha: string;
  stage: string;
  config?: JsonObject;
};

export type StageDraftOutput = {
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[];
  errors: StageError[];
};

export type StageOutput = {
  runId: string;
  stage: string;
  status: "passed" | "failed" | "skipped" | "errored";
  artefactDir: string;
  evidenceRefs: string[];
  errors: StageError[];
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
};

export type StageError = {
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
export const stageInputSchema: z.ZodType<StageInput>;
export const stageErrorSchema: z.ZodType<StageError>;
export const stageDraftOutputSchema: z.ZodType<StageDraftOutput>;
export const stageOutputSchema: z.ZodType<StageOutput>;
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

### 4.2 Stage input schema

Validate the object shape only:

```ts
stageInputSchema = object({
  runId: string,
  workDir: string,
  artefactDir: string,
  baseSha: string,
  stage: string,
  config: optional(jsonObjectSchema),
}).strict();
```

This schema does not validate absolute paths, Git object IDs, repository roots,
or stable ASCII identifiers. M1 preflight performs those checks because they
require filesystem and Git context.

### 4.3 Stage error schema

Validate basic field shape:

```ts
stageErrorSchema = object({
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
`line: 0` can be omitted while preserving the rest of the stage error.

### 4.4 Stage draft output schema

Validate exact shape and status/error coupling:

```ts
stageDraftOutputSchema = object({
  status: enum("passed", "failed", "skipped"),
  evidenceRefs: array(string),
  errors: array(stageErrorSchema),
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

### 4.5 Stage output schema

Validate exact shape and canonical refinements:

```ts
stageOutputSchema = object({
  runId: string.min(1),
  stage: string.min(1),
  status: enum("passed", "failed", "skipped", "errored"),
  artefactDir: string.min(1),
  evidenceRefs: array(string),
  errors: array(stageErrorSchema),
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

No schema refinement validates the exact Git hash length. The stage contract
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
stageDraftOutputSchema.parse(draft) === draft;
```

Counter-example:

```ts
stageDraftOutputSchema.parse({
  status: "failed",
  evidenceRefs: [],
  errors: [],
});
```

Expected behavior: validation fails because `failed` requires at least one
`StageError`.

---

## 6. Edge cases

- Unknown object keys: reject via strict object schemas.
- `config` omitted: accept.
- `config` set to `undefined`: treat as omitted by normal JavaScript object
  semantics if the property is absent; reject if the property is present with a
  non-JSON value.
- Non-finite numbers inside `config`: reject.
- `StageError.line` equal to `0`: accept structurally, then M5 evidence
  validation omits it and reports a blocking harness error.
- `StageDraftOutput.status === "errored"`: reject.
- `StageOutput.status === "errored"` with no blocking error: reject.
- Non-errored `StageOutput` with any canonical field set to `null`: reject.

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

M1 uses `stageInputSchema` before filesystem preflight.

M5 uses `stageDraftOutputSchema` when a stage returns.

M6 uses `stageOutputSchema` after assembling canonical output and again after
normalizing invalid assembled output into `errored`.

```ts
const parsedInput = stageInputSchema.parse(input);
const parsedDraft = stageDraftOutputSchema.safeParse(execution.draft);
const parsedOutput = stageOutputSchema.safeParse(output);
```

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
