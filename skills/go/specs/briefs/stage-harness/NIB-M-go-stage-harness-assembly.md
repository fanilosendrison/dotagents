---
id: NIB-M-GO-STAGE-HARNESS-ASSEMBLY
type: nib-module
version: "1.0.0"
scope: go-stage-harness/assembly
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness Assembly

VegaCorp - July 2026

---

## 1. Purpose

This module assembles the canonical `StageOutput` from normalized input,
execution result, canonical state snapshot, and draft/evidence validation. It is
the only module that decides the final status.

The module must preserve valid stage errors, add harness blocking errors, and
ensure the harness never writes invalid canonical output.

---

## 2. Inputs

```ts
type AssembledOutputInput = {
  input: ResolvedStageInput;
  execution: StageExecutionResult;
  canonicalState: CanonicalStateSnapshot;
  validation: ValidatedDraftResult | null;
};
```

`validation` is `null` only when an internal caller bug skipped M5. Normal
stage-throw handling still supplies a validation result for reserved-file
checks.

Dependency contract:

- `DC-ZOD` for final `StageOutput` validation and normalization checks.

---

## 3. Outputs

```ts
type AssembleAndNormalizeOutputResult =
  { ok: true; output: StageOutput } | { ok: false; reason: string };
```

When `ok` is `false`, M7 must not write `output.json`.

---

## 4. Algorithm

### 4.1 Collect harness errors

Start with an empty `harnessErrors` array.

Append every error from `canonicalState.errors`.

If `execution.kind === "threw"`, append:

```ts
{
  message: `Stage threw: ${execution.message}`,
  severity: "blocking",
}
```

If `validation === null`, append a blocking internal harness error.

If `validation?.ok === false`, append every validation error.

### 4.2 Collect stage errors

If `validation?.ok === true`, collect `validation.errors`.

If `validation?.ok === false`, collect sanitized stage errors from validation
when available. Invalid evidence references have already been omitted by M5.

If draft schema parsing failed, no stage errors are available.

### 4.3 Determine evidence references

Use retained evidence references from validation when validation exists.

If validation is absent, use an empty array and append a blocking harness error.

### 4.4 Determine final status

If `harnessErrors.length > 0`, final status is `errored`.

Otherwise final status is `validation.draft.status`.

The stage draft status is used only when the stage returned, draft schema
validation passed, evidence validation passed, and canonical state collection
has no errors.

### 4.5 Build candidate output

```ts
const output: StageOutput = {
  runId: input.runId,
  stage: input.stage,
  status,
  artefactDir: input.artefactDir,
  evidenceRefs,
  errors: [...harnessErrors, ...phaseErrors],
  headShaAfter: canonicalState.headShaAfter,
  trackedWorktreeHash: canonicalState.trackedWorktreeHash,
  worktreeClean: canonicalState.worktreeClean,
};
```

### 4.6 Validate candidate output

Validate with `stageOutputSchema`.

If validation passes, return `ok: true`.

If validation fails, normalize into `errored`.

### 4.7 Normalize invalid candidate output

Build a normalized output:

- Force `status: "errored"`.
- Preserve `runId`, `stage`, `artefactDir`, and retained evidence refs.
- Preserve all existing errors.
- Add one blocking harness error describing schema validation failure.
- For each canonical field that violates non-errored refinements, set it to
  `null`.
- Ensure at least one blocking error exists.

Validate the normalized output with `stageOutputSchema`.

If validation passes, return it. If validation still fails, return `ok: false`;
M7 must not write `output.json`.

---

## 5. Example

Inputs:

- Stage returned a valid `passed` draft.
- Evidence validation passed.
- `headShaAfter` succeeded.
- `trackedWorktreeHash` failed.
- `worktreeClean` succeeded.

Candidate output status must be `errored`, not `passed`.

Expected output:

```ts
{
  runId: "01JTESTRUN00000000000000000",
  stage: "lint",
  status: "errored",
  artefactDir: "<resolved-run-artifacts>/lint",
  evidenceRefs: [],
  errors: [
    {
      message: "trackedWorktreeHash unavailable: <reason>",
      severity: "blocking",
    },
  ],
  headShaAfter: "<commit-after-stage>",
  trackedWorktreeHash: null,
  worktreeClean: true,
}
```

---

## 6. Edge cases

- Stage threw and state collection succeeded: status is `errored`.
- Stage returned invalid draft and state collection succeeded: status is
  `errored`.
- Stage returned `failed` with valid stage errors and no harness errors: status
  is `failed`.
- Stage returned `failed` and state collection failed: status is `errored`, and
  stage errors are preserved.
- Stage returned `passed` with validation errors: status is `errored`.
- Output schema rejects normalized output: return `ok: false` and write no
  output.

---

## 7. Constraints

- Harness errors dominate final status.
- Valid stage errors must be preserved when possible.
- The module must not perform filesystem writes.
- The module must not recompute canonical state.
- The module must not invent success when required canonical fields are missing.
- The module must never return invalid `StageOutput`.

---

## 8. Integration

`runStage` calls M6 after M5:

```ts
const assembled = assembleAndNormalizeOutput({
  input: normalizedInput,
  execution,
  canonicalState,
  validation,
});

if (!assembled.ok) {
  throw new HarnessNormalizationError(assembled.reason);
}
```

Only `assembled.output` may be passed to M7.

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
