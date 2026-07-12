---
id: NIB-M-GO-STAGE-HARNESS-EVIDENCE
type: nib-module
version: "1.0.0"
scope: go-stage-harness/evidence
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness Evidence

VegaCorp - July 2026

---

## 1. Purpose

This module validates stage draft output and all stage-controlled references to
files or repository locations. It ensures that evidence paths cannot escape the
artefact directory and that error locations are usable by later orchestrators.

This module does not compute canonical repository state and does not decide
final status. It reports validation failures to M6 assembly.

---

## 2. Inputs

```ts
type ValidateDraftAndEvidenceInput = {
  input: ResolvedStageInput;
  draft: unknown;
};

type ValidateReservedHarnessFilesInput = {
  input: ResolvedStageInput;
};
```

The `draft` value is the raw value returned by M3.

Dependency contracts:

- `DC-ZOD` for `StageDraftOutput` validation.
- `DC-NODE-RUNTIME-FS-PATH-CRYPTO` for path joining, realpath containment,
  regular-file checks, and reserved root-file detection.

---

## 3. Outputs

```ts
type ValidatedDraftResult =
  | {
      ok: true;
      draft: StageDraftOutput;
      evidenceRefs: string[];
      errors: StageError[];
    }
  | {
      ok: false;
      evidenceRefs: string[];
      errors: StageError[];
    };
```

When `ok` is `true`, `draft` has passed the draft schema and all retained
evidence references have passed containment checks. When `ok` is `false`, M6
must treat the result as a harness error.

---

## 4. Algorithm

### 4.1 Validate returned draft

```ts
const parsed = stageDraftOutputSchema.safeParse(draft);
if (!parsed.success) {
  return {
    ok: false,
    evidenceRefs: [],
    errors: [
      {
        message: "StageDraftOutput failed schema validation",
        severity: "blocking",
      },
    ],
  };
}
```

Continue with `parsed.data`.

### 4.2 Validate top-level evidence references

For each `evidenceRef`:

1. Reject if it is empty.
2. Reject if it is absolute.
3. Reject if it contains a NUL byte.
4. Reject if any path segment is `..`.
5. Reject if it is exactly `output.json`, `stdout.txt`, or `stderr.txt`.
6. Resolve `candidate = path.join(input.artefactDir, evidenceRef)`.
7. Require `candidate` to exist.
8. Require `realpath(candidate)` to start with
   `realpath(input.artefactDir) + path.sep`.
9. Require the resolved path to be a regular file.

Valid evidence references are retained in their original relative form. Invalid
evidence references are dropped and converted into blocking errors.

### 4.3 Validate error evidence references

For each `errors[].evidenceRef`:

1. It must appear in the retained top-level `evidenceRefs`.
2. It must pass the same path checks as top-level evidence references.

If validation fails, omit `evidenceRef` from that `StageError` and append a
blocking harness error describing the removal.

### 4.4 Validate error files and lines

For each `errors[].file`:

1. Reject if empty.
2. Reject if absolute.
3. Reject if it contains a NUL byte.
4. Reject if any path segment is `..`.
5. Interpret it as a POSIX repo-relative path.

The module does not require the file to exist. A stage may report a deleted file
or a file created by a failed tool.

For each `errors[].line`, require a positive integer. Invalid lines are omitted
from the corresponding stage error and reported as blocking harness errors.

### 4.5 Validate reserved root files

Always check these paths at the root of `artefactDir`:

- `output.json`
- `stdout.txt`
- `stderr.txt`

If any exists before M7 persistence, append a blocking harness error. A stage
created a reserved harness-owned file.

This check must run even if the stage threw and no draft exists.

### 4.6 Return validation result

If any schema, evidence, error reference, error location, or reserved-file
validation failure occurred, return `ok: false`.

If no validation failure occurred, return `ok: true` with the parsed draft,
retained evidence references, and sanitized stage errors.

---

## 5. Example

Artefact tree:

```text
<artefact-dir>/
└── evidence/
    └── lint.json
```

Draft:

```ts
{
  status: "failed",
  evidenceRefs: ["evidence/lint.json"],
  errors: [
    {
      message: "Lint failed",
      severity: "minor",
      file: "src/a.ts",
      line: 3,
      evidenceRef: "evidence/lint.json",
    },
  ],
}
```

Expected output:

```ts
{
  ok: true,
  draft: "<parsed-draft>",
  evidenceRefs: ["evidence/lint.json"],
  errors: [
    {
      message: "Lint failed",
      severity: "minor",
      file: "src/a.ts",
      line: 3,
      evidenceRef: "evidence/lint.json",
    },
  ],
}
```

---

## 6. Edge cases

- Evidence reference points outside via `..`: drop it and report blocking error.
- Evidence reference is a symlink escape: drop it and report blocking error.
- Evidence reference points to a directory: drop it and report blocking error.
- Evidence reference is missing: drop it and report blocking error.
- Error evidence reference is not top-level evidence: omit it and report
  blocking error.
- Error file contains backtracking segment: omit it and report blocking error.
- Error line is `0`: omit it and report blocking error.
- Stage creates root `output.json`: report blocking error; M7 later replaces it
  with canonical output.

---

## 7. Constraints

- The module must not trust path string normalization alone. It must use
  realpath containment for evidence files.
- The module must not follow evidence references outside `artefactDir`.
- The module must not delete invalid evidence files.
- The module must not write `output.json`, `stdout.txt`, or `stderr.txt`.
- The module must preserve valid stage errors where possible.

---

## 8. Integration

If the stage returned, `runStage` calls:

```ts
const validation = await validateDraftAndEvidence({
  input: normalizedInput,
  draft: execution.draft,
});
```

If the stage threw, `runStage` still calls:

```ts
const validation = await validateReservedHarnessFiles({
  input: normalizedInput,
});
```

M6 consumes the result and decides whether the final status is `errored`.

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
