---
id: NIB-S-GO-PHASE-HARNESS
type: nib-system
version: "1.0.0"
scope: go-phase-harness
status: active
consumers: [codex]
superseded_by: []
---

# NIB-S - `/go` Phase Harness

VegaCorp - July 2026

---

## 1. System objective

Implement a Turnlock-free harness that runs one `/go` pipeline phase as an async
function, validates its draft output, computes canonical repository state,
validates evidence, and writes a canonical `PhaseOutput`.

---

## 2. Construction scope

This NIB-S covers the standalone v1 phase harness described by the phase
contract.

The system builds the canonical function API:

```ts
type Phase = (input: PhaseInput) => Promise<PhaseDraftOutput>;

async function runPhase(
  phaseFn: Phase,
  input: PhaseInput,
): Promise<PhaseOutput>;
```

The following are out of scope for v1:

- Turnlock integration.
- CLI subprocess adapter.
- Timeout or cancellation.
- Durable `fsync` semantics.
- Chaining context such as previous phase outputs or attempt numbers.
- Guaranteed stdout or stderr capture for in-process function phases.

---

## 3. Canonical types

All public harness types are TypeScript types. These types are normative.

```ts
type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

type PhaseInput = {
  runId: string;
  workDir: string;
  artefactDir: string;
  baseSha: string;
  phase: string;
  config?: JsonObject;
};

type PhaseDraftOutput = {
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[];
  errors: PhaseError[];
};

type PhaseOutput = {
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

type PhaseError = {
  message: string;
  severity: "blocking" | "major" | "minor";
  file?: string;
  line?: number;
  evidenceRef?: string;
};
```

The harness may use internal helper types. The following boundary types define
the module interfaces at system level:

```ts
type AbsolutePath = string;
type RepoRelativePosixPath = string;
type EvidenceRef = string;

type ResolvedPhaseInput = PhaseInput & {
  workDir: AbsolutePath;
  artefactDir: AbsolutePath;
};

type PreflightResult =
  { ok: true; input: ResolvedPhaseInput } | { ok: false; reason: string };

type PhaseExecutionResult =
  { kind: "returned"; draft: unknown } | { kind: "threw"; message: string };

type CanonicalStateSnapshot = {
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
  errors: PhaseError[];
};

type ValidatedDraftResult =
  | {
      ok: true;
      draft: PhaseDraftOutput;
      evidenceRefs: EvidenceRef[];
      errors: PhaseError[];
    }
  | {
      ok: false;
      evidenceRefs: EvidenceRef[];
      errors: PhaseError[];
    };

type AssembledOutputInput = {
  input: ResolvedPhaseInput;
  execution: PhaseExecutionResult;
  canonicalState: CanonicalStateSnapshot;
  validation: ValidatedDraftResult | null;
};
```

---

## 4. Pipeline architecture

The harness is a linear pipeline. Each module consumes the previous module's
output and either continues with normalized data or terminates according to the
preflight and fatal-write rules.

```text
PhaseInput + Phase function
  -> M1 Input preflight
  -> M2 Artefact directory setup
  -> M3 Phase invocation
  -> M4 Canonical state collection
  -> M5 Draft and evidence validation
  -> M6 Output assembly and normalization
  -> M7 Atomic output persistence
  -> PhaseOutput
```

M1 and M2 run before the phase. M4 runs after the phase returns or throws. M5
validates the phase-produced draft and evidence. M6 decides the final status. M7
writes the only canonical `output.json`.

---

## 5. Module boundaries

### 5.1 M1 - Input preflight

**Consumes:** `PhaseInput`.

**Produces:** `PreflightResult`.

**Responsibility:** Validate identifiers, paths, Git repository root, `baseSha`,
unsupported checkout modes, and JSON-serializable config. Resolve `workDir` and
`artefactDir` into canonical absolute paths.

**Failure behavior:** Preflight failure exits before creating `artefactDir` and
produces no `output.json`.

### 5.2 M2 - Artefact directory setup

**Consumes:** `ResolvedPhaseInput`.

**Produces:** `ResolvedPhaseInput`.

**Responsibility:** Create `artefactDir` as a new directory before invoking the
phase.

**Failure behavior:** Directory creation failure produces no `output.json`.

### 5.3 M3 - Phase invocation

**Consumes:** `Phase` and `ResolvedPhaseInput`.

**Produces:** `PhaseExecutionResult`.

**Responsibility:** Invoke the phase exactly once with normalized paths.
Preserve thrown errors as harness-visible execution results.

**Failure behavior:** A thrown phase error does not by itself suppress
`output.json`; it becomes an `errored` output if later persistence succeeds.

### 5.4 M4 - Canonical state collection

**Consumes:** `ResolvedPhaseInput`.

**Produces:** `CanonicalStateSnapshot`.

**Responsibility:** Collect `headShaAfter`, `trackedWorktreeHash`, and
`worktreeClean` independently and best-effort after the phase returns or throws.

**Failure behavior:** Any unavailable canonical field becomes `null` and adds a
blocking `PhaseError`. The other fields are still attempted.

### 5.5 M5 - Draft and evidence validation

**Consumes:** `ResolvedPhaseInput` and `PhaseExecutionResult`.

**Produces:** `ValidatedDraftResult | null`.

**Responsibility:** Validate returned draft shape, status/error coupling,
evidence references, error evidence references, error file locations, and
reserved root filenames.

**Failure behavior:** If the phase threw, draft validation is absent and
reserved-file validation still runs. Any validation failure becomes a harness
error for M6.

### 5.6 M6 - Output assembly and normalization

**Consumes:** `AssembledOutputInput`.

**Produces:** `PhaseOutput`.

**Responsibility:** Merge phase errors with harness errors, determine final
status, sanitize invalid references, enforce output schema refinements, and
normalize invalid assembled output into a valid `errored` state when possible.

**Failure behavior:** If valid normalization is impossible, the harness writes
no `output.json` and exits non-zero.

### 5.7 M7 - Atomic output persistence

**Consumes:** `PhaseOutput`.

**Produces:** `PhaseOutput` and `output.json`.

**Responsibility:** Write the canonical output atomically inside `artefactDir`.

**Failure behavior:** Fatal persistence failure produces no valid `output.json`
and exits non-zero.

---

## 6. Global invariants

### 6.1 Function API invariant

The phase implementation is a plain async function. It must not import Turnlock,
know about state machines, or encode resume semantics. Turnlock wrapping is a
future mechanical adapter around `runPhase`.

### 6.2 Canonical path invariant

After M1, all filesystem and Git operations use the resolved `workDir` and
`artefactDir`. `PhaseOutput.artefactDir` stores the resolved canonical artefact
path.

### 6.3 Artefact isolation invariant

`artefactDir` must be outside `workDir`. It must not already exist before M2.
Harness-owned files must not make the repository dirty.

### 6.4 Phase lifecycle invariant

The phase must not return while any background subprocess, timer, or unsettled
promise can still mutate `workDir` or `artefactDir`.

### 6.5 Exclusivity invariant

No external actor may mutate `workDir` or `artefactDir` while `runPhase`
executes. The wider `/go` workspace setup must provide a private worktree per
run.

### 6.6 Reserved-file invariant

At the root of `artefactDir`, `output.json`, `stdout.txt`, and `stderr.txt` are
reserved harness-owned filenames. A phase-created file at any of these root
paths is a violation.

### 6.7 Evidence containment invariant

Every evidence reference is a non-empty relative path under `artefactDir`,
contains no `..` segment or NUL byte, resolves by realpath containment under
`artefactDir`, and points to a regular file.

### 6.8 Error location invariant

Every `PhaseError.file`, when present, is a non-empty repo-relative POSIX path
under `workDir`, contains no `..` segment or NUL byte, and is not absolute.
Every `PhaseError.line`, when present, is a positive integer.

### 6.9 Status and errors invariant

`passed` and `skipped` require `errors.length === 0`. `failed` requires at least
one `PhaseError`. `errored` requires at least one blocking `PhaseError`.

### 6.10 Canonical fields invariant

When `status !== "errored"`, `headShaAfter`, `trackedWorktreeHash`, and
`worktreeClean` are non-null. When `status === "errored"`, any of these fields
may be null only when the errors array explains the unavailable value.

### 6.11 Tracked hash invariant

`trackedWorktreeHash` is a deterministic fingerprint of all tracked files as
they exist on disk after the phase returns. Untracked and ignored files are
outside v1 scope. The empty tracked worktree hash is the SHA-256 hash of the
empty string.

### 6.12 Unsupported checkout invariant

Sparse checkout, skip-worktree bits, and assume-unchanged bits are unsupported
in v1 and fail during preflight before `output.json` exists.

### 6.13 No invalid canonical output invariant

The harness must never write an invalid canonical `PhaseOutput`. If final schema
validation cannot be normalized into a valid `errored` output, no `output.json`
is written.

---

## 7. Cross-cutting policies

### P1 - Harness owns canonicalization

Phases return only `PhaseDraftOutput`. They never write `output.json`, compute
canonical Git fields, or decide `errored`.

### P2 - Harness errors dominate final status

If any harness error occurs, final status is `errored` even when the phase
returned `passed`, `failed`, or `skipped`. Valid phase errors are preserved and
included alongside harness errors.

### P3 - Field collection is independent

`headShaAfter`, `trackedWorktreeHash`, and `worktreeClean` are collected
independently. Failure to compute one field must not prevent attempts to compute
the others.

### P4 - Preflight failures are outside output contract

Preflight and setup failures produce no `output.json`. The caller detects them
by process failure or missing output.

### P5 - Fatal persistence failures are outside output contract

If the harness cannot atomically persist a valid output, no valid `output.json`
is produced. The caller detects this by process failure or missing output.

### P6 - Diagnostics belong in evidence files

In-process phases must not rely on stdout or stderr capture. They should write
diagnostic material under `artefactDir/evidence/` and return evidence
references.

---

## 8. Output contract

`PhaseOutput` is the sole canonical result of a successful harness run.

Field semantics:

- `runId`: copied from normalized input.
- `phase`: copied from normalized input.
- `status`: final normalized status.
- `artefactDir`: resolved canonical artefact directory path.
- `evidenceRefs`: validated phase evidence references retained by the harness.
- `errors`: phase and harness errors included after validation and sanitization.
- `headShaAfter`: `HEAD` commit object ID after phase execution, or `null` only
  for explained `errored` outputs.
- `trackedWorktreeHash`: deterministic hash of tracked on-disk state after phase
  execution, or `null` only for explained `errored` outputs.
- `worktreeClean`: whether
  `git status --porcelain=v1 -z --ignore-submodules=none` is empty after phase
  execution, or `null` only for explained `errored` outputs.

`output.json` contains exactly the canonical serialized `PhaseOutput` produced
by M6 and written by M7.

---

## 9. Orchestration

```ts
async function runPhase(
  phaseFn: Phase,
  input: PhaseInput,
): Promise<PhaseOutput> {
  const preflight = await runInputPreflight(input);
  if (!preflight.ok) {
    throw new HarnessPreflightError(preflight.reason);
  }

  const normalizedInput = await createArtefactDirectory(preflight.input);

  const execution = await invokePhaseFunction(phaseFn, normalizedInput);

  const canonicalState = await collectCanonicalState(normalizedInput);

  const validation =
    execution.kind === "returned"
      ? await validateDraftAndEvidence(normalizedInput, execution.draft)
      : await validateReservedHarnessFiles(normalizedInput);

  const output = assembleAndNormalizeOutput({
    input: normalizedInput,
    execution,
    canonicalState,
    validation,
  });

  await writeCanonicalOutputAtomically(output);

  return output;
}
```

The pseudocode is normative for wiring and data flow. The internal algorithms of
each helper belong to the corresponding NIB-M.

---

## 10. Required NIB-M set

The system requires the following module briefs before implementation:

- `NIB-M-GO-HARNESS-SCHEMAS`: Type definitions and Zod schemas for `PhaseInput`,
  `PhaseDraftOutput`, `PhaseOutput`, `PhaseError`, and JSON values.
- `NIB-M-GO-HARNESS-PREFLIGHT`: Identifier validation, path canonicalization,
  Git root validation, `baseSha` validation, unsupported checkout detection,
  config serializability, and preflight failure behavior.
- `NIB-M-GO-HARNESS-INVOCATION`: Phase invocation, thrown error capture,
  lifecycle expectations, and in-process stdout/stderr non-guarantees.
- `NIB-M-GO-HARNESS-STATE`: `headShaAfter`, `trackedWorktreeHash`, and
  `worktreeClean` collection, including the full tracked hash algorithm.
- `NIB-M-GO-HARNESS-EVIDENCE`: Evidence reference validation, realpath
  containment, reserved root filenames, and `PhaseError` evidence/file/line
  validation.
- `NIB-M-GO-HARNESS-ASSEMBLY`: Error merging, final status selection,
  sanitization, schema refinement enforcement, and `errored` normalization.
- `NIB-M-GO-HARNESS-PERSISTENCE`: Atomic `output.json` write and fatal
  persistence failure behavior.

---

## 11. Dependency contracts

The NIB-Ms may require dependency contracts for non-trivial external behavior:

- Git command semantics used by preflight and canonical state collection.
- Zod schema validation and refinement behavior.
- Filesystem path, realpath, symlink, and atomic rename semantics in the
  selected runtime.

If dependency contracts are not authored separately, the corresponding NIB-M
must inline the exact dependency constraints needed for implementation.

---

## 12. Explicit non-goals

The implementing agent must not add these capabilities while consuming this
NIB-S:

- A Turnlock FSM.
- A CLI adapter that changes the canonical function API.
- Phase chaining or previous-output context.
- Timeout handling.
- Cancellation handling.
- `fsync` durability guarantees.
- Hashing untracked or ignored files.
- Support for sparse checkout, skip-worktree, or assume-unchanged files.

---

## 13. Construction consumption

This NIB-S is consumed during GREEN after the NIB-T has produced failing
behavioral tests. It must be consumed together with the module briefs listed in
section 10. If a module brief contradicts this NIB-S, this NIB-S governs the
system boundary and the contradiction must be reported before implementation
continues.

After GREEN, this document is archived and the implementation plus tests become
the source of truth.

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
