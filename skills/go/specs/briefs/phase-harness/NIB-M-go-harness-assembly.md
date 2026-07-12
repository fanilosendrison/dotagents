---
id: NIB-M-GO-HARNESS-ASSEMBLY
type: nib-module
version: "1.0.0"
scope: go-phase-harness/assembly
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness Assembly

VegaCorp - July 2026

---

## 1. Purpose

This module assembles the canonical `PhaseOutput` from normalized input,
execution result, canonical state snapshot, and draft/evidence validation. It is
the only module that decides the final status.

The module must preserve valid phase errors, add harness blocking errors, and
ensure the harness never writes invalid canonical output.

---

## 2. Inputs

```ts
type AssembledOutputInput = {
  input: ResolvedPhaseInput;
  execution: PhaseExecutionResult;
  canonicalState: CanonicalStateSnapshot;
  validation: ValidatedDraftResult | null;
};
```

`validation` is `null` only when an internal caller bug skipped M5. Normal
phase-throw handling still supplies a validation result for reserved-file
checks.

Dependency contract:

- `DC-ZOD` for final `PhaseOutput` validation and normalization checks.

---

## 3. Outputs

```ts
type AssembleAndNormalizeOutputResult =
  { ok: true; output: PhaseOutput } | { ok: false; reason: string };
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
  message: `Phase threw: ${execution.message}`,
  severity: "blocking",
}
```

If `validation === null`, append a blocking internal harness error.

If `validation?.ok === false`, append every validation error.

### 4.2 Collect phase errors

If `validation?.ok === true`, collect `validation.errors`.

If `validation?.ok === false`, collect sanitized phase errors from validation
when available. Invalid evidence references have already been omitted by M5.

If draft schema parsing failed, no phase errors are available.

### 4.3 Determine evidence references

Use retained evidence references from validation when validation exists.

If validation is absent, use an empty array and append a blocking harness error.

### 4.4 Determine final status

If `harnessErrors.length > 0`, final status is `errored`.

Otherwise final status is `validation.draft.status`.

The phase draft status is used only when the phase returned, draft schema
validation passed, evidence validation passed, and canonical state collection
has no errors.

### 4.5 Build candidate output

```ts
const output: PhaseOutput = {
  runId: input.runId,
  phase: input.phase,
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

Validate with `phaseOutputSchema`.

If validation passes, return `ok: true`.

If validation fails, normalize into `errored`.

### 4.7 Normalize invalid candidate output

Build a normalized output:

- Force `status: "errored"`.
- Preserve `runId`, `phase`, `artefactDir`, and retained evidence refs.
- Preserve all existing errors.
- Add one blocking harness error describing schema validation failure.
- For each canonical field that violates non-errored refinements, set it to
  `null`.
- Ensure at least one blocking error exists.

Validate the normalized output with `phaseOutputSchema`.

If validation passes, return it. If validation still fails, return `ok: false`;
M7 must not write `output.json`.

---

## 5. Example

Inputs:

- Phase returned a valid `passed` draft.
- Evidence validation passed.
- `headShaAfter` succeeded.
- `trackedWorktreeHash` failed.
- `worktreeClean` succeeded.

Candidate output status must be `errored`, not `passed`.

Expected output:

```ts
{
  runId: "01JTESTRUN00000000000000000",
  phase: "lint",
  status: "errored",
  artefactDir: "<resolved-run-artifacts>/lint",
  evidenceRefs: [],
  errors: [
    {
      message: "trackedWorktreeHash unavailable: <reason>",
      severity: "blocking",
    },
  ],
  headShaAfter: "<commit-after-phase>",
  trackedWorktreeHash: null,
  worktreeClean: true,
}
```

---

## 6. Edge cases

- Phase threw and state collection succeeded: status is `errored`.
- Phase returned invalid draft and state collection succeeded: status is
  `errored`.
- Phase returned `failed` with valid phase errors and no harness errors: status
  is `failed`.
- Phase returned `failed` and state collection failed: status is `errored`, and
  phase errors are preserved.
- Phase returned `passed` with validation errors: status is `errored`.
- Output schema rejects normalized output: return `ok: false` and write no
  output.

---

## 7. Constraints

- Harness errors dominate final status.
- Valid phase errors must be preserved when possible.
- The module must not perform filesystem writes.
- The module must not recompute canonical state.
- The module must not invent success when required canonical fields are missing.
- The module must never return invalid `PhaseOutput`.

---

## 8. Integration

`runPhase` calls M6 after M5:

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
