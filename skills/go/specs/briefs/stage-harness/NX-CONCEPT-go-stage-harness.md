# Stage Contract — Shared harness for `/go` pipeline stages

## Goal

Every stage in the `/go` pipeline (workspace-setup, lint, typecheck, tests,
review, commit-push-pr, etc.) must conform to a single shared contract so they
can be chained, verified, and eventually orchestrated by a Turnlock FSM.

We start with a **standalone harness** — no FSM, no `@@TURNLOCK@@` protocol, no
resume. Just a standard way to invoke a stage, capture its result, and validate
its output. Later, every stage that implements this contract can be wrapped into
a Turnlock FSM without changing its internals.

A stage is a **plain async function**:
`Stage = (input: StageInput) => Promise<StageDraftOutput>`. A CLI adapter
(`bun run stages/lint.ts`) can be added later as a thin wrapper around the same
function — the function API is canonical.

## Analogy

`git-commits-push` is a Bun script that takes context, does work, and produces
structured output. The stages of `/go` should work the same way: each stage is
an independent function that receives standardised input and produces
standardised output. Unlike `git-commits-push`, stages are **not Turnlock-native
from the start** — they are standalone functions that a Turnlock FSM can wrap
later, mechanically, without changing the stage implementation.

## What the harness provides

1. **Standard input** (`StageInput`): what every stage receives — run context,
   work directory, artefact directory, stage-specific config.

2. **Standard output** (`StageDraftOutput` / `StageOutput`): the stage returns a
   draft (`StageDraftOutput`) with status, evidence refs, and errors. The
   harness enriches it into the canonical `StageOutput` with `headShaAfter`,
   `trackedWorktreeHash`, and `worktreeClean`.

3. **Runner** (`runStage`): invokes a stage, creates the artefact directory,
   validates the returned `StageDraftOutput` against its Zod schema, computes
   `headShaAfter`, `trackedWorktreeHash`, and `worktreeClean`, writes the
   canonical `StageOutput` to `output.json`, and validates that every
   `evidenceRef` exists on disk with realpath containment.

## Artefact directory contract

The harness creates `artefactDir/` before invoking the stage. **`artefactDir`
MUST be outside `workDir`.** If it were inside the worktree, the harness's own
output files (`output.json`, etc.) would make `worktreeClean` false, defeating
the point of the flag. The caller is responsible for providing an `artefactDir`
outside the repository worktree.

The stage writes raw evidence into it. The harness writes the canonical
`output.json` after the stage returns.

```text
artefactDir/
├── output.json       # canonical, written by the harness on success
│                     # (absent if preflight fails or harness crashes)
├── stdout.txt        # optional — raw stdout (only for subprocess stages)
├── stderr.txt        # optional — raw stderr (only for subprocess stages)
└── evidence/         # raw evidence written by the stage
    ├── diff.patch
    ├── lint.json
    ├── test-results.txt
    └── ...
```

**Who writes what:**

- `evidence/*`: written by the stage during execution.
- `stdout.txt`: written by the harness when subprocess capture exists.
- `stderr.txt`: written by the harness when subprocess capture exists.
- `output.json`: written by the harness after `StageOutput` validation.

The stage never writes `output.json` directly. It returns a `StageDraftOutput`
object (or throws). The harness validates it and persists the canonical copy.

## Stage input schema

```ts
type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type JsonObject = { [key: string]: JsonValue };

type StageInput = {
  runId: string;
  workDir: string; // root of the per-run work/<run-id> checkout
  artefactDir: string; // created by the harness, stage writes evidence here
  baseSha: string; // exact commit object ID for HEAD before any
  // stage ran. Not used by the
  // harness (trackedWorktreeHash is full-tree,
  // not diff-based), but available for stages
  // that need to diff against the baseline.
  stage: string; // canonical stage name (e.g. "lint", "typecheck")
  config?: JsonObject; // optional JSON-serializable stage config
};
```

`runId` and `stage` are stable ASCII identifiers matching `^[A-Za-z0-9._-]+$`.
`baseSha` is an exact Git commit object ID, not an arbitrary revision expression
such as `HEAD~1`. `config`, when present, is a JSON-serializable object whose
values are limited to `null`, booleans, numbers, strings, arrays, and objects,
so the same `StageInput` can later be passed through the CLI adapter unchanged.

## Stage output schemas

There are two types. The stage returns a **draft** (no harness-computed fields).
The harness produces the **canonical** output (all fields filled).

### `StageDraftOutput` — returned by the stage

```ts
type StageDraftOutput = {
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[]; // relative paths under artefactDir/, no ".."
  errors: StageError[]; // empty if passed or skipped
};

// Note: "errored" is never returned by a stage. The harness produces it
// when the stage throws or returns invalid output. (Timeout handling is v2;
// see Future extensions below.)
```

### `StageOutput` — canonical, written by the harness

```ts
type StageOutput = {
  runId: string; // from StageInput
  stage: string; // from StageInput (e.g. "lint")
  status: "passed" | "failed" | "skipped" | "errored";
  artefactDir: string;
  evidenceRefs: string[];
  errors: StageError[];
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
  one blocking `StageError` explaining which field is unavailable and why.

**Zod refinements.** The Zod schema enforces status/errors coupling: `passed`
and `skipped` require `errors.length === 0`. `failed` requires
`errors.length > 0`. `errored` requires at least one `StageError` with
`severity: "blocking"`. `runId` and `stage` must be non-empty strings.

The harness receives a `StageDraftOutput` from the stage, validates it against
the Zod schema, then computes `headShaAfter`, `trackedWorktreeHash`, and
`worktreeClean` to produce the canonical `StageOutput` written to `output.json`.

```ts
type StageError = {
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

- `passed`: stage completed successfully. Errors is empty.
- `failed`: stage completed but found issues. Errors MUST contain at least one
  `StageError`.
- `skipped`: stage decided not to run, such as no diff to lint or no tests to
  run.
- `errored`: stage threw, returned invalid output, or a harness-side computation
  failed. Normalised by the harness. Timeout is v2; see Future extensions.

A fatal harness bug (e.g. harness process killed by SIGKILL, disk full
preventing atomic write of `output.json`) is outside the `StageOutput` contract
— it produces no `output.json` at all. The caller must detect this from the
harness exit code or missing `output.json`. If the harness CAN still write
`output.json` (e.g. `git rev-parse` failed but the filesystem is writable), it
MUST produce `errored` with `null` for the unavailable fields rather than
produce no output.

When the harness produces `errored` (stage threw, returned invalid output, or a
harness-side computation failed), it MUST include at least one `StageError` with
`severity: "blocking"` explaining the cause. An `errored` status with an empty
`errors` array is invalid.

A `failed` status with an empty `errors` array is equally invalid. A stage that
completes without issues MUST return `passed`, not `failed` with zero errors.

### `headShaAfter`

`git rev-parse HEAD` after the stage completes. Cheap and deterministic.
Captures what is committed. If no commit happened during the stage, this equals
the previous `headShaAfter`.

### `trackedWorktreeHash`

A deterministic fingerprint of **all tracked files** as they exist on disk after
the stage returns — staged, unstaged, committed, or deleted. This is a full tree
hash, not a diff. Two worktrees with identical tracked file contents produce the
same hash regardless of how they arrived there.

**Canonical algorithm** (the harness MUST implement this exactly):

1. Collect tracked files with their Git index mode: `git ls-files -s -z`. Output
   format: `<mode> <object> <stage>\t<path>\0`. The `-z` flag makes output
   machine- parseable (paths are NUL-terminated).

   If any entry has a stage value other than `0` (unmerged entries from a merge
   conflict), the harness MUST produce `errored` with a blocking `StageError`.
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
     a blocking `StageError` naming the path. The harness does not guess — type
     mismatch means the worktree is in an inconsistent state. Submodules (mode
     `160000`) are exempt from this check: the index object ID is authoritative,
     and the submodule worktree may be checked out to any state. Any read error
     during hash computation (EACCES, ENOENT mid-hash, broken symlink where
     `readlink` fails) MUST cause the harness to produce `errored` with a
     `StageError` of severity `"blocking"` naming the problematic path. The
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
output. Stages that mutate files without committing leave the worktree dirty.
This flag lets the next stage or the orchestrator decide whether to proceed,
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

For in-process function stages, stdout/stderr capture is **not guaranteed** —
capturing process-global streams while an async function runs is fragile. Stages
should write diagnostic output to files under `evidence/` instead of relying on
stdout/stderr.

When the stage runs as a subprocess (future CLI adapter), the harness captures
stdout and stderr into `stdout.txt` and `stderr.txt`. Until then, these files
are **optional** and may be absent from `artefactDir/`.

The artefact directory tree marks them as optional:

```text
artefactDir/
├── output.json       # canonical, written by the harness on success
│                     # (absent if preflight fails or harness crashes)
├── stdout.txt        # optional (only for subprocess stages)
├── stderr.txt        # optional (only for subprocess stages)
└── evidence/         # raw evidence written by the stage
```

## Runner behaviour

The runner collects all canonical fields **best-effort and independently**. If
any computation fails (EACCES, git failure), the corresponding field is set to
`null` — the other fields are still attempted. A single canonical `StageOutput`
is written at the end, regardless of how many sub-computations failed. **No**
`output.json` is produced only for: preflight/config errors (step 1),
`mkdir(resolvedArtefactDir)` failure (step 2), fatal I/O errors (disk full on
atomic write), or an internal harness bug where even normalisation fails (step
9). All Git commands operate in the resolved canonical `workDir`.

```text
runStage(stageFn, input):

  -- Preflight --
  1. Validate input paths:
       - `runId` and `stage` MUST be non-empty stable ASCII identifiers
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
     `StageOutput.artefactDir` stores the resolved canonical path.
     `config`, if present, must be JSON-serializable.
  2. Create `artefactDir/` with non-recursive `mkdir(resolvedArtefactDir)`.

  -- Stage execution --
  3. Build `normalizedInput = { ...input, workDir: resolvedWorkDir,
     artefactDir: resolvedArtefactDir }`.
     Invoke `stageFn(normalizedInput)`.
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
  7. If stageFn returned a value:
       a. Validate against StageDraftOutput Zod schema.
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

     Unconditional (runs even if `stageFn` threw):
       e. Check that none of `output.json`, `stdout.txt`, `stderr.txt`
          exist at the `normalizedInput.artefactDir` root. If any is
          present → errored. A stage-created `output.json` is never trusted;
          the harness records the violation and replaces it with the canonical
          `output.json` in step 10. For the future subprocess adapter, this
          reserved-file check runs before harness stdout/stderr capture writes
          `stdout.txt` or `stderr.txt`.

  -- Assemble and write --
  8. Collect all error causes first, then determine final status.
     - Harness errors: null canonical fields, Zod validation failure,
       evidenceRef validation failure, StageError location validation
       failure, stage throw.
     - Stage errors: from `StageDraftOutput.errors` (if the stage
       completed and returned output that parsed as a valid
       `StageDraftOutput`).
     If ANY harness error occurred → status is "errored". The `errors`
     array contains all harness blocking `StageError`s PLUS all stage
     errors (preserved, not replaced).
     If no harness error → status from `StageDraftOutput.status`.
     Assemble the canonical StageOutput. Only validated `evidenceRefs`
     and errors are included. Invalid `evidenceRefs` entries are dropped.
     `errors[].evidenceRef` values that fail validation are set to
     `undefined` (omitted from the canonical output). When any
     `evidenceRefs` or `errors[].evidenceRef` entries are dropped or
     sanitised, the harness appends a blocking `StageError` describing
     what was removed and why.
  9. Validate the assembled `StageOutput` against its Zod schema
     (including refinements: non-errored ⇒ canonical fields non-null).
     If invalid → normalise into a valid `errored` state: force
     `status: "errored"`, ensure at least one blocking `StageError`,
     null out any canonical fields that violate refinements.
     If normalisation also fails → write NO `output.json`,
     exit non-zero. The harness MUST NOT write invalid canonical output.
  10. Write output.json atomically (tmp file in normalizedInput.artefactDir
      + rename).
  11. Return StageOutput.
```

## Stage implementation contract

A stage is an async function. It does not import Turnlock. It does not know
about state machines, resume, or delegation.

**Lifecycle invariant:** A stage MUST NOT return while any background
subprocess, timer, or unsettled promise can still mutate `workDir` or
`artefactDir`. The harness reads filesystem state immediately after the stage
returns — any concurrent mutation is a race condition and the resulting
hash/cleanliness values are undefined. Stages must `await` all work before
returning.

**Exclusivity invariant:** While `runStage` runs, no external actor (another
process, editor, agent, or concurrent harness invocation) may mutate `workDir`
or `artefactDir`. The harness assumes exclusive ownership of both directories
for the duration of the run. Enforced by workspace setup: each `/go` run
allocates a private worktree.

```ts
type Stage = (input: StageInput) => Promise<StageDraftOutput>;
```

Example — a lint stage:

```ts
const lintPhase: Stage = async (input) => {
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

This harness is deliberately **Turnlock-free**. Later, wrapping a stage into a
Turnlock FSM is a mechanical step:

```ts
import { definePhase } from "turnlock";
import { lintPhase, runStage, buildStageInput } from "./harness";

const turnlockLintPhase = definePhase<GoState, void, StageOutput>(
  async (state, io) => {
    const input = buildStageInput(state, "lint");
    const output = await runStage(lintPhase, input);
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

The stage implementation (`lintPhase`) does not know about Turnlock. It only
knows about `StageInput → StageDraftOutput`.

## What this unlocks

- Every stage can be tested in isolation: pass it a `StageInput`, assert on
  `StageDraftOutput` and the contents of `artefactDir/`.
- Stages can be run manually during development: `bun run stages/lint.ts`.
- The output is machine-verifiable: `StageOutput` is validated against its Zod
  schema before the harness returns.
- The harness is the single place where artefact directory creation, output
  validation, stdout/stderr capture, `trackedWorktreeHash` computation, and
  error normalisation happen. Stages don't duplicate this logic.

## Future extensions (v2)

These are deliberately out of scope for v1 but the contract leaves room:

- **Timeout / cancellation**: `timeoutMs` in `StageInput`, `AbortSignal` for
  cooperative cancellation. Currently `runStage` only catches thrown exceptions;
  it cannot stop a runaway subprocess or infinite loop.
- **Durability (fsync)**: `output.json` is written atomically (tmp + rename),
  but the harness does not `fsync` the file or parent directory. For
  Turnlock-grade durability in v2, specify `fsync` before considering
  `output.json` durable.
- **Chaining context**: `previousStageOutputs: StageOutput[]`, `attemptNumber`.
- **CLI adapter**: a thin wrapper that reads `StageInput` from stdin/argv and
  writes `StageDraftOutput` to stdout, so stages can be invoked as subprocesses.
  This also unlocks proper stdout/stderr capture.
