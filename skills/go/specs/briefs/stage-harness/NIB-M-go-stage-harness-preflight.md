---
id: NIB-M-GO-STAGE-HARNESS-PREFLIGHT
type: nib-module
version: "1.0.0"
scope: go-stage-harness/preflight
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness Preflight

VegaCorp - July 2026

---

## 1. Purpose

This module validates and canonicalizes `StageInput` before a stage is invoked.
It rejects inputs and repository states that would make the harness output
ambiguous, non-portable, or non-deterministic.

Preflight is outside the `StageOutput` contract. A preflight failure produces no
`artefactDir` and no `output.json`.

---

## 2. Inputs

```ts
type RunInputPreflightInput = {
  input: StageInput;
};
```

The `input` object has already passed the structural `stageInputSchema` from
`NIB-M-GO-STAGE-HARNESS-SCHEMAS`, or this module must perform that parse as its first
operation.

Dependency contracts:

- `DC-ZOD` for input and config validation.
- `DC-GIT-CLI` for repository root, base commit, sparse-checkout, and index-bit
  checks.
- `DC-NODE-RUNTIME-FS-PATH-CRYPTO` for path absoluteness, `realpath`, basename,
  dirname, and path resolution semantics.

---

## 3. Outputs

```ts
type ResolvedStageInput = StageInput & {
  workDir: string;
  artefactDir: string;
};

type PreflightResult =
  { ok: true; input: ResolvedStageInput } | { ok: false; reason: string };
```

When `ok` is `true`, `workDir` and `artefactDir` are resolved canonical absolute
paths. When `ok` is `false`, `reason` is a human-readable blocking reason.

---

## 4. Algorithm

### 4.1 Validate input shape

```ts
const parsed = stageInputSchema.safeParse(input);
if (!parsed.success) {
  return fail("StageInput failed schema validation");
}
```

Schema validation failure is a preflight failure and produces no `output.json`.

### 4.2 Validate stable identifiers

Validate `runId` and `stage` with this exact pattern:

```ts
const stableIdentifierPattern = /^[A-Za-z0-9._-]+$/;
```

Both strings must be non-empty and must match the pattern. Reject whitespace,
path separators, Unicode letters, and shell metacharacters.

### 4.3 Validate absolute input paths

Reject unless both `workDir` and `artefactDir` are absolute paths.

Resolve `workDir` with filesystem `realpath()`.

Resolve `artefactDir` without requiring it to exist:

```ts
const parent = realpath(dirname(input.artefactDir));
const basenameValue = basename(input.artefactDir);

if (basenameValue === "." || basenameValue === "..") {
  return fail("artefactDir basename must not be . or ..");
}

const resolvedArtefactDir = path.resolve(parent, basenameValue);
```

If `dirname(artefactDir)` cannot be resolved, fail preflight.

### 4.4 Validate Git repository root

Run:

```sh
git -C <resolved-work-dir> rev-parse --show-toplevel
```

Normalize the command output by trimming one trailing line ending. The result
must equal `resolvedWorkDir`. If not, fail preflight.

### 4.5 Validate base commit

`baseSha` must be an exact Git commit object ID. It must not be an arbitrary
revision expression such as `HEAD`, `HEAD~1`, or `main`.

Use two checks:

```sh
git -C <resolved-work-dir> cat-file -t <baseSha>
git -C <resolved-work-dir> cat-file -e <baseSha>^{commit}
```

The type command must return `commit`. The existence command must succeed. If
either command fails, fail preflight.

### 4.6 Validate artefact isolation

Reject if `resolvedArtefactDir` equals `resolvedWorkDir`.

Reject if `resolvedArtefactDir` starts with:

```ts
resolvedWorkDir + path.sep;
```

Reject if `artefactDir` already exists.

### 4.7 Validate unsupported checkout modes

Reject sparse checkout if either condition is true:

- `git -C <resolved-work-dir> sparse-checkout list` returns non-empty output.
- `git -C <resolved-work-dir> config --bool core.sparseCheckout` returns `true`.

Reject skip-worktree and assume-unchanged entries by parsing:

```sh
git -C <resolved-work-dir> ls-files -v -z
```

The first byte of each record is the tag. Reject if any tag is `S`, which marks
skip-worktree. Reject if any tag is a lowercase ASCII letter, which marks
assume-unchanged.

### 4.8 Validate config serializability

If `config` is present, validate it with `jsonObjectSchema`.

This rejects functions, symbols, `undefined`, non-finite numbers, dates, maps,
sets, class instances, and cyclic structures.

### 4.9 Return normalized input

Return:

```ts
{
  ok: true,
  input: {
    ...parsed.data,
    workDir: resolvedWorkDir,
    artefactDir: resolvedArtefactDir,
  },
}
```

---

## 5. Example

Input:

```ts
{
  runId: "01JTESTRUN00000000000000000",
  stage: "lint",
  workDir: "<absolute-worktree-root>",
  artefactDir: "<absolute-run-artifacts>/lint",
  baseSha: "<exact-commit-object-id>",
  config: { severity: "minor" },
}
```

Assumptions:

- `workDir` is the Git repository root.
- `artefactDir` does not exist.
- `artefactDir` is outside `workDir`.
- `baseSha` resolves to a commit inside the repository.
- The checkout is not sparse and has no skip-worktree or assume-unchanged bits.

Expected output:

```ts
{
  ok: true,
  input: {
    runId: "01JTESTRUN00000000000000000",
    stage: "lint",
    workDir: "<resolved-worktree-root>",
    artefactDir: "<resolved-run-artifacts>/lint",
    baseSha: "<exact-commit-object-id>",
    config: { severity: "minor" },
  },
}
```

---

## 6. Edge cases

- `runId` contains `/`: fail preflight.
- `stage` is empty: fail preflight.
- `workDir` is relative: fail preflight.
- `artefactDir` is relative: fail preflight.
- `artefactDir` parent does not exist: fail preflight.
- `artefactDir` basename is `.` or `..`: fail preflight.
- `workDir` exists but is not a Git repository root: fail preflight.
- `baseSha` is `HEAD`: fail preflight.
- `baseSha` is a tree or blob object: fail preflight.
- `artefactDir` exists: fail preflight.
- `artefactDir` is inside `workDir`: fail preflight.
- Sparse checkout is enabled: fail preflight.
- Any skip-worktree bit exists: fail preflight.
- Any assume-unchanged bit exists: fail preflight.
- `config` contains `undefined`: fail preflight.

---

## 7. Constraints

- Preflight must not create, delete, or modify files.
- Preflight must not create `artefactDir`.
- All Git commands must run in the resolved canonical `workDir`.
- All failure reasons must be specific enough for a caller to fix the input.
- Preflight must not emit `StageOutput`.

---

## 8. Integration

`runStage` calls preflight before any other module:

```ts
const preflight = await runInputPreflight({ input });
if (!preflight.ok) {
  throw new HarnessPreflightError(preflight.reason);
}
```

Only `preflight.input` may be passed to M2 and later modules.

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
