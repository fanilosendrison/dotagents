# Phase Contract — Shared harness for `/go` pipeline phases

## Goal

Every phase in the `/go` pipeline (workspace-setup, lint, typecheck, tests,
review, commit-push-pr, etc.) must conform to a single shared contract so they
can be chained, verified, and eventually orchestrated by a Turnlock FSM.

We start with a **standalone harness** — no FSM, no `@@TURNLOCK@@` protocol, no
resume. Just a standard way to invoke a phase, capture its result, and validate
its output. Later, every phase that implements this contract can be wrapped into
a Turnlock FSM without changing its internals.

A phase is a **plain async function**:
`Phase = (input: PhaseInput) => Promise<PhaseDraftOutput>`. A CLI adapter
(`bun run phases/lint.ts`) can be added later as a thin wrapper around the same
function — the function API is canonical.

## Analogy

`git-commits-push` is a Bun script that takes context, does work, and produces
structured output. The phases of `/go` should work the same way: each phase is
an independent function that receives standardised input and produces
standardised output. Unlike `git-commits-push`, phases are **not Turnlock-native
from the start** — they are standalone functions that a Turnlock FSM can wrap
later, mechanically, without changing the phase implementation.

## What the harness provides

1. **Standard input** (`PhaseInput`): what every phase receives — run context,
   work directory, artefact directory, phase-specific config.

2. **Standard output** (`PhaseDraftOutput` / `PhaseOutput`): the phase returns a
   draft (`PhaseDraftOutput`) with status, evidence refs, and errors. The
   harness enriches it into the canonical `PhaseOutput` with `headShaAfter`,
   `trackedWorktreeHash`, and `worktreeClean`.

3. **Runner** (`runPhase`): invokes a phase, creates the artefact directory,
   validates the returned `PhaseDraftOutput` against its Zod schema, computes
   `headShaAfter`, `trackedWorktreeHash`, and `worktreeClean`, writes the
   canonical `PhaseOutput` to `output.json`, and validates that every
   `evidenceRef` exists on disk with realpath containment.

## Artefact directory contract

The harness creates `artefactDir/` before invoking the phase. **`artefactDir`
MUST be outside `workDir`.** If it were inside the worktree, the harness's own
output files (`output.json`, etc.) would make `worktreeClean` false, defeating
the point of the flag. The caller is responsible for providing an `artefactDir`
outside the repository worktree.

The phase writes raw evidence into it. The harness writes the canonical
`output.json` after the phase returns.

```text
artefactDir/
├── output.json       # canonical, written by the harness on success
│                     # (absent if preflight fails or harness crashes)
├── stdout.txt        # optional — raw stdout (only for subprocess phases)
├── stderr.txt        # optional — raw stderr (only for subprocess phases)
└── evidence/         # raw evidence written by the phase
    ├── diff.patch
    ├── lint.json
    ├── test-results.txt
    └── ...
```

**Who writes what:**

- `evidence/*`: written by the phase during execution.
- `stdout.txt`: written by the harness when subprocess capture exists.
- `stderr.txt`: written by the harness when subprocess capture exists.
- `output.json`: written by the harness after `PhaseOutput` validation.

The phase never writes `output.json` directly. It returns a `PhaseDraftOutput`
object (or throws). The harness validates it and persists the canonical copy.

## Phase input schema

```ts
type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

type PhaseInput = {
  runId: string;
  workDir: string; // root of the per-run work/<run-id> checkout
  artefactDir: string; // created by the harness, phase writes evidence here
  baseSha: string; // exact commit object ID for HEAD before any
  // phase ran. Not used by the
  // harness (trackedWorktreeHash is full-tree,
  // not diff-based), but available for phases
  // that need to diff against the baseline.
  phase: string; // canonical phase name (e.g. "lint", "typecheck")
  config?: JsonObject; // optional JSON-serializable phase config
};
```

`runId` and `phase` are stable ASCII identifiers matching `^[A-Za-z0-9._-]+$`.
`baseSha` is an exact Git commit object ID, not an arbitrary revision expression
such as `HEAD~1`. `config`, when present, is a JSON-serializable object whose
values are limited to `null`, booleans, numbers, strings, arrays, and objects,
so the same `PhaseInput` can later be passed through the CLI adapter unchanged.

## Phase output schemas

There are two types. The phase returns a **draft** (no harness-computed fields).
The harness produces the **canonical** output (all fields filled).

### `PhaseDraftOutput` — returned by the phase

```ts
type PhaseDraftOutput = {
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[]; // relative paths under artefactDir/, no ".."
  errors: PhaseError[]; // empty if passed or skipped
};

// Note: "errored" is never returned by a phase. The harness produces it
// when the phase throws or returns invalid output. (Timeout handling is v2;
// see Future extensions below.)
```

### `PhaseOutput` — canonical, written by the harness

```ts
type PhaseOutput = {
  runId: string; // from PhaseInput
  phase: string; // from PhaseInput (e.g. "lint")
  status: "passed" | "failed" | "skipped" | "errored";
  artefactDir: string;
  evidenceRefs: string[];
  errors: PhaseError[];
  headShaAfter: string | null; // null when git rev-parse fails
  trackedWorktreeHash: string | null; // null when hash computation fails
  worktreeClean: boolean | null; // null when git status fails
};
```

**Availability invariants:**

- When `status !== "errored"`: `headShaAfter`, `trackedWorktreeHash`, and
  `worktreeClean` are guaranteed non-null.
- When `status === "errored"`: any of the three may be `null` if the harness
  could not compute them (e.g. hash hit EACCES, `git rev-parse` failed on a
  corrupted repository). `null` means "unavailable" — it is distinct from a
  valid Git object ID (40 or 64 hex chars, depending on SHA-1/SHA-256) or a
  valid SHA-256 hash (64 hex chars). The `errors` array MUST contain at least
  one blocking `PhaseError` explaining which field is unavailable and why.

**Zod refinements.** The Zod schema enforces status/errors coupling: `passed`
and `skipped` require `errors.length === 0`. `failed` requires
`errors.length > 0`. `errored` requires at least one `PhaseError` with
`severity: "blocking"`. `runId` and `phase` must be non-empty strings.

The harness receives a `PhaseDraftOutput` from the phase, validates it against
the Zod schema, then computes `headShaAfter`, `trackedWorktreeHash`, and
`worktreeClean` to produce the canonical `PhaseOutput` written to `output.json`.

```ts
type PhaseError = {
  message: string;
  severity: "blocking" | "major" | "minor";
  file?: string;
  line?: number;
  evidenceRef?: string; // relative path under artefactDir/, no ".."
};
```

`file` is a repo-relative POSIX path under `workDir`. `line` is 1-based. If
present, `file` must be non-empty, relative, contain no `..` segment, and
contain no NUL bytes. If present, `line` must be a positive integer.

### Status values

- `passed`: phase completed successfully. Errors is empty.
- `failed`: phase completed but found issues. Errors MUST contain at least one
  `PhaseError`.
- `skipped`: phase decided not to run, such as no diff to lint or no tests to
  run.
- `errored`: phase threw, returned invalid output, or a harness-side computation
  failed. Normalised by the harness. Timeout is v2; see Future extensions.

A fatal harness bug (e.g. harness process killed by SIGKILL, disk full
preventing atomic write of `output.json`) is outside the `PhaseOutput` contract
— it produces no `output.json` at all. The caller must detect this from the
harness exit code or missing `output.json`. If the harness CAN still write
`output.json` (e.g. `git rev-parse` failed but the filesystem is writable), it
MUST produce `errored` with `null` for the unavailable fields rather than
produce no output.

When the harness produces `errored` (phase threw, returned invalid output, or a
harness-side computation failed), it MUST include at least one `PhaseError` with
`severity: "blocking"` explaining the cause. An `errored` status with an empty
`errors` array is invalid.

A `failed` status with an empty `errors` array is equally invalid. A phase that
completes without issues MUST return `passed`, not `failed` with zero errors.

### `headShaAfter`

`git rev-parse HEAD` after the phase completes. Cheap and deterministic.
Captures what is committed. If no commit happened during the phase, this equals
the previous `headShaAfter`.

### `trackedWorktreeHash`

A deterministic fingerprint of **all tracked files** as they exist on disk after
the phase returns — staged, unstaged, committed, or deleted. This is a full tree
hash, not a diff. Two worktrees with identical tracked file contents produce the
same hash regardless of how they arrived there.

**Canonical algorithm** (the harness MUST implement this exactly):

1. Collect tracked files with their Git index mode: `git ls-files -s -z`. Output
   format: `<mode> <object> <stage>\t<path>\0`. The `-z` flag makes output
   machine- parseable (paths are NUL-terminated).

   If any entry has a stage value other than `0` (unmerged entries from a merge
   conflict), the harness MUST produce `errored` with a blocking `PhaseError`.
   The algorithm does not run on a conflicted index.

2. For each entry, determine the file's current content and mode:
   - **Regular file** (mode starts with `100`): `sha256(<file bytes>)` — raw
     filesystem bytes, not a Git blob ID. Ignore `.gitattributes` filters and
     line-ending normalization. **Mode** is normalised to Git-style: `100755` if
     any executable bit is set (`stat(path).mode & 0o111`), otherwise `100644`.
     Raw `stat().mode` includes permission bits Git does not track (setuid,
     sticky, umask); normalising ensures the hash is reproducible across
     checkouts and machines.
   - **Symlink** (mode `120000`):
     `contentHash = sha256(<raw symlink target bytes from readlink(path)>)`. Do
     NOT hash the target file's bytes.
   - **Deleted** (tracked by Git but absent from disk): `lstat` returns
     `ENOENT`. Content hash is the sentinel `"DELETED"`, mode is `0`. If `lstat`
     succeeds but a subsequent `readFile`/`readlink` fails with `ENOENT` (file
     deleted mid-hash), this is a race condition → `errored`.
   - **Submodule** (mode `160000`): use the object ID from `git ls-files -s`
     output directly. This catches submodule pointer changes (the commit SHA the
     submodule references). It does NOT detect uncommitted changes inside the
     submodule worktree — those are outside the scope of `trackedWorktreeHash`.
     Dirty submodule contents ARE detected by `worktreeClean` which runs with
     `--ignore-submodules=none` (see below). If the on-disk file type (from
     `lstat`) does not match the Git index mode (e.g. index says regular file
     `100644` but `lstat` says symlink), the harness MUST produce `errored` with
     a blocking `PhaseError` naming the path. The harness does not guess — type
     mismatch means the worktree is in an inconsistent state. Submodules (mode
     `160000`) are exempt from this check: the index object ID is authoritative,
     and the submodule worktree may be checked out to any state. Any read error
     during hash computation (EACCES, ENOENT mid-hash, broken symlink where
     `readlink` fails) MUST cause the harness to produce `errored` with a
     `PhaseError` of severity `"blocking"` naming the problematic path. The
     harness does not silently skip or substitute values.

3. Sort the tuples `(path, mode, contentHash)` by path, using bytewise
   comparison (`memcmp`, not locale-aware collation). The raw bytes are the path
   as emitted by `git ls-files -z`.
4. Serialize using the **raw path bytes** from step 1 (not decoded strings) as
   NUL-delimited records: `<raw path bytes>\0<mode>\0<contentHash>\0` for each
   file.
5. `trackedWorktreeHash = sha256(concatenated records)`.

**Scope**: tracked files only (as reported by `git ls-files`). Untracked files
and `.gitignore`-d files are excluded. Ignored files are intentionally invisible
in v1 — `git status --porcelain` does not report them, and `trackedWorktreeHash`
does not hash them. File modes, symlinks, and submodule pointers ARE included —
see the canonical algorithm above.

Sparse checkouts, `skip-worktree`, and `assume-unchanged` bits are not supported
in v1. The harness detects a sparse checkout (`git sparse-checkout list` is
non-empty, or `core.sparseCheckout` is `true`) and also checks for individual
skip-worktree / assume-unchanged bits via parse `git ls-files -v -z` records in
code and reject any record whose tag is `S` (skip-worktree) or any lowercase tag
(assume-unchanged). Any of these conditions → preflight failure, no
`output.json`.

**Empty worktree** (zero tracked files): the hash of the empty string
(`sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).

### `worktreeClean`

`true` when `git status --porcelain=v1 -z --ignore-submodules=none` produces no
output. Phases that mutate files without committing leave the worktree dirty.
This flag lets the next phase or the orchestrator decide whether to proceed,
stash, reset, or abort.

### `evidenceRefs`

- Relative paths only, rooted at `artefactDir/`. No `..` segments.
- Validated for **realpath containment** by the harness: resolve
  `candidate = path.join(normalizedInput.artefactDir, ref)`, then
  `realpath(candidate)` must start with
  `realpath(normalizedInput.artefactDir) + "/"`. This catches symlink escapes
  that a simple `..` check would miss.
- Must point to regular files inside `artefactDir/`, typically under
  `evidence/`.

### stdout/stderr capture

For in-process function phases, stdout/stderr capture is **not guaranteed** —
capturing process-global streams while an async function runs is fragile. Phases
should write diagnostic output to files under `evidence/` instead of relying on
stdout/stderr.

When the phase runs as a subprocess (future CLI adapter), the harness captures
stdout and stderr into `stdout.txt` and `stderr.txt`. Until then, these files
are **optional** and may be absent from `artefactDir/`.

The artefact directory tree marks them as optional:

```text
artefactDir/
├── output.json       # canonical, written by the harness on success
│                     # (absent if preflight fails or harness crashes)
├── stdout.txt        # optional (only for subprocess phases)
├── stderr.txt        # optional (only for subprocess phases)
└── evidence/         # raw evidence written by the phase
```

## Runner behaviour

The runner collects all canonical fields **best-effort and independently**. If
any computation fails (EACCES, git failure), the corresponding field is set to
`null` — the other fields are still attempted. A single canonical `PhaseOutput`
is written at the end, regardless of how many sub-computations failed. **No**
`output.json` is produced only for: preflight/config errors (step 1),
`mkdir(resolvedArtefactDir)` failure (step 2), fatal I/O errors (disk full on
atomic write), or an internal harness bug where even normalisation fails (step
9). All Git commands operate in the resolved canonical `workDir`.

```text
runPhase(phaseFn, input):

  -- Preflight --
  1. Validate input paths:
       - `runId` and `phase` MUST be non-empty stable ASCII identifiers
         matching `^[A-Za-z0-9._-]+$`.
       - `workDir` and `artefactDir` MUST be absolute paths.
         `workDir` is resolved with `realpath()`.
         `workDir` MUST be a repository root:
         `git -C workDir rev-parse --show-toplevel` equals
         `realpath(workDir)`.
         `baseSha` MUST be an exact Git commit object ID, and MUST resolve
         to a commit in `workDir`:
         `git -C resolvedWorkDir cat-file -e <baseSha>^{commit}` succeeds.
         Since `artefactDir` does not exist yet, resolve
         `path.resolve(realpath(dirname(artefactDir)), basename(artefactDir))`.
         Reject if `basename(artefactDir)` is `.` or `..`.
       - The resolved `artefactDir` MUST NOT equal `workDir` and MUST NOT
         start with `realpath(workDir) + "/"` (artefactDir outside the
         worktree).
       - If `artefactDir` already exists → fail (non-zero exit).
       - If `workDir` has sparse-checkout, skip-worktree, or
         assume-unchanged bits (`git -C workDir sparse-checkout list`
         non-empty, `core.sparseCheckout` is `true`, or
         `git -C workDir ls-files -v -z` contains any record with tag
         `S` or any lowercase tag) → fail.
     All preflight failures produce no `output.json`.
     Once paths are resolved, all subsequent Git commands and path
     references use the resolved (canonical) `workDir` and `artefactDir`.
     `PhaseOutput.artefactDir` stores the resolved canonical path.
     `config`, if present, must be JSON-serializable.
  2. Create `artefactDir/` with non-recursive `mkdir(resolvedArtefactDir)`.

  -- Phase execution --
  3. Build `normalizedInput = { ...input, workDir: resolvedWorkDir,
     artefactDir: resolvedArtefactDir }`.
     Invoke `phaseFn(normalizedInput)`.
     If it throws → capture the error message; treat as errored (step 8).

  -- Canonical fields (best-effort, independent) --
  4. headShaAfter = try git -C normalizedInput.workDir rev-parse HEAD
     (null if fails).
  5. trackedWorktreeHash = try canonical algorithm in normalizedInput.workDir
     (null if fails).
  6. worktreeClean = try git -C normalizedInput.workDir status
     --porcelain=v1 -z --ignore-submodules=none is empty
     (null if fails).

  -- Validation --
  7. If phaseFn returned a value:
       a. Validate against PhaseDraftOutput Zod schema.
          If invalid → treat as errored (step 8).
       b. Validate every evidenceRef:
            - Exists on disk
            - candidate = path.join(normalizedInput.artefactDir, ref)
            - realpath(candidate) starts with
              realpath(normalizedInput.artefactDir) + "/"
            - Is a regular file
            - NOT absolute, no `..`, non-empty, no NUL bytes
            - Relative path is NOT exactly `output.json`, `stdout.txt`,
              or `stderr.txt` (reserved harness-owned paths at the
              artefactDir root)
          If any check fails → treat as errored (step 8).
       c. Validate every `errors[].evidenceRef` (if present):
            - Must appear in the top-level `evidenceRefs`.
            - Same containment and regular-file checks as (b).
            - MUST NOT be absolute, contain `..`, or include NUL bytes.
          If any check fails → treat as errored (step 8).
       d. Validate every `errors[].file` and `errors[].line` (if present):
            - `file` must be a non-empty repo-relative POSIX path under
              `normalizedInput.workDir`; it MUST NOT be absolute, contain
              `..`, or include NUL bytes.
            - `line` must be a positive integer.
          If any check fails → treat as errored (step 8).

     Unconditional (runs even if `phaseFn` threw):
       e. Check that none of `output.json`, `stdout.txt`, `stderr.txt`
          exist at the `normalizedInput.artefactDir` root. If any is
          present → errored. A phase-created `output.json` is never trusted;
          the harness records the violation and replaces it with the canonical
          `output.json` in step 10. For the future subprocess adapter, this
          reserved-file check runs before harness stdout/stderr capture writes
          `stdout.txt` or `stderr.txt`.

  -- Assemble and write --
  8. Collect all error causes first, then determine final status.
     - Harness errors: null canonical fields, Zod validation failure,
       evidenceRef validation failure, PhaseError location validation
       failure, phase throw.
     - Phase errors: from `PhaseDraftOutput.errors` (if the phase
       completed and returned output that parsed as a valid
       `PhaseDraftOutput`).
     If ANY harness error occurred → status is "errored". The `errors`
     array contains all harness blocking `PhaseError`s PLUS all phase
     errors (preserved, not replaced).
     If no harness error → status from `PhaseDraftOutput.status`.
     Assemble the canonical PhaseOutput. Only validated `evidenceRefs`
     and errors are included. Invalid `evidenceRefs` entries are dropped.
     `errors[].evidenceRef` values that fail validation are set to
     `undefined` (omitted from the canonical output). When any
     `evidenceRefs` or `errors[].evidenceRef` entries are dropped or
     sanitised, the harness appends a blocking `PhaseError` describing
     what was removed and why.
  9. Validate the assembled `PhaseOutput` against its Zod schema
     (including refinements: non-errored ⇒ canonical fields non-null).
     If invalid → normalise into a valid `errored` state: force
     `status: "errored"`, ensure at least one blocking `PhaseError`,
     null out any canonical fields that violate refinements.
     If normalisation also fails → write NO `output.json`,
     exit non-zero. The harness MUST NOT write invalid canonical output.
  10. Write output.json atomically (tmp file in normalizedInput.artefactDir
      + rename).
  11. Return PhaseOutput.
```

## Phase implementation contract

A phase is an async function. It does not import Turnlock. It does not know
about state machines, resume, or delegation.

**Lifecycle invariant:** A phase MUST NOT return while any background
subprocess, timer, or unsettled promise can still mutate `workDir` or
`artefactDir`. The harness reads filesystem state immediately after the phase
returns — any concurrent mutation is a race condition and the resulting
hash/cleanliness values are undefined. Phases must `await` all work before
returning.

**Exclusivity invariant:** While `runPhase` runs, no external actor (another
process, editor, agent, or concurrent harness invocation) may mutate `workDir`
or `artefactDir`. The harness assumes exclusive ownership of both directories
for the duration of the run. Enforced by workspace setup: each `/go` run
allocates a private worktree.

```ts
type Phase = (input: PhaseInput) => Promise<PhaseDraftOutput>;
```

Example — a lint phase:

```ts
const lintPhase: Phase = async (input) => {
  const evidenceDir = path.join(input.artefactDir, "evidence");
  await fs.mkdir(evidenceDir, { recursive: true });

  const result = await runBiomeLint(input.workDir);
  const evidencePath = path.join(evidenceDir, "lint.json");
  await fs.writeFile(evidencePath, JSON.stringify(result));

  if (result.errors.length === 0) {
    return {
      status: "passed",
      evidenceRefs: ["evidence/lint.json"],
      errors: [],
    };
  }

  return {
    status: "failed",
    evidenceRefs: ["evidence/lint.json"],
    errors: result.errors.map((e) => ({
      message: e.message,
      severity: "minor",
      file: e.file,
      line: e.line,
    })),
  };
};
```

## Relationship to Turnlock

This harness is deliberately **Turnlock-free**. Later, wrapping a phase into a
Turnlock FSM is a mechanical step:

```ts
import { definePhase } from "turnlock";
import { lintPhase, runPhase, buildPhaseInput } from "./harness";

const turnlockLintPhase = definePhase<GoState, void, PhaseOutput>(
  async (state, io) => {
    const input = buildPhaseInput(state, "lint");
    const output = await runPhase(lintPhase, input);
    if (output.status === "failed" || output.status === "errored") {
      return io.fail(new Error(output.errors[0]?.message ?? "lint failed"));
    }
    return io.transition("typecheck", {
      ...state,
      checks: [...state.checks, output],
    });
  },
);
```

The phase implementation (`lintPhase`) does not know about Turnlock. It only
knows about `PhaseInput → PhaseDraftOutput`.

## What this unlocks

- Every phase can be tested in isolation: pass it a `PhaseInput`, assert on
  `PhaseDraftOutput` and the contents of `artefactDir/`.
- Phases can be run manually during development: `bun run phases/lint.ts`.
- The output is machine-verifiable: `PhaseOutput` is validated against its Zod
  schema before the harness returns.
- The harness is the single place where artefact directory creation, output
  validation, stdout/stderr capture, `trackedWorktreeHash` computation, and
  error normalisation happen. Phases don't duplicate this logic.

## Future extensions (v2)

These are deliberately out of scope for v1 but the contract leaves room:

- **Timeout / cancellation**: `timeoutMs` in `PhaseInput`, `AbortSignal` for
  cooperative cancellation. Currently `runPhase` only catches thrown exceptions;
  it cannot stop a runaway subprocess or infinite loop.
- **Durability (fsync)**: `output.json` is written atomically (tmp + rename),
  but the harness does not `fsync` the file or parent directory. For
  Turnlock-grade durability in v2, specify `fsync` before considering
  `output.json` durable.
- **Chaining context**: `previousPhaseOutputs: PhaseOutput[]`, `attemptNumber`.
- **CLI adapter**: a thin wrapper that reads `PhaseInput` from stdin/argv and
  writes `PhaseDraftOutput` to stdout, so phases can be invoked as subprocesses.
  This also unlocks proper stdout/stderr capture.
