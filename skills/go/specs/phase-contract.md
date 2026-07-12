# Phase Contract — Shared harness for `/go` pipeline phases

## Goal

Every phase in the `/go` pipeline (workspace-setup, lint, typecheck, tests,
review, commit-push-pr, etc.) must conform to a single shared contract so they
can be chained, verified, and eventually orchestrated by a Turnlock FSM.

We start with a **standalone harness** — no FSM, no `@@TURNLOCK@@` protocol, no
resume. Just a standard way to invoke a phase, capture its result, and validate
its output. Later, every phase that implements this contract can be wrapped into
a Turnlock FSM without changing its internals.

A phase is a **plain async function**: `Phase = (input: PhaseInput) => Promise<PhaseDraftOutput>`.
A CLI adapter (`bun run phases/lint.ts`) can be added later as a thin wrapper
around the same function — the function API is canonical.

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
   draft (`PhaseDraftOutput`) with status, evidence refs, and errors. The harness
   enriches it into the canonical `PhaseOutput` with `headShaAfter`,
   `trackedWorktreeHash`, and `worktreeClean`.

3. **Runner** (`runPhase`): invokes a phase, creates the artefact directory,
   validates the returned `PhaseDraftOutput` against its Zod schema, computes
   `headShaAfter`, `trackedWorktreeHash`, and `worktreeClean`, writes the
   canonical `PhaseOutput` to `output.json`, and validates that every
   `evidenceRef` exists on disk with realpath containment.

## Artefact directory contract

The harness creates `artefactDir/` before invoking the phase. The phase writes
raw evidence into it. The harness writes the canonical `output.json` after the
phase returns.

```
artefactDir/
├── output.json       # canonical, written by the harness after Zod validation
├── stdout.txt        # optional — raw stdout (only for subprocess phases)
├── stderr.txt        # optional — raw stderr (only for subprocess phases)
└── evidence/         # raw evidence written by the phase
    ├── diff.patch
    ├── lint.json
    ├── test-results.txt
    └── ...
```

**Who writes what:**

| File | Written by | When |
|------|-----------|------|
| `evidence/*` | The phase | During execution |
| `stdout.txt` | The harness | Captured from the phase process (subprocess only) |
| `stderr.txt` | The harness | Captured from the phase process (subprocess only) |
| `output.json` | The harness | After Zod validation of `PhaseOutput` |

The phase never writes `output.json` directly. It returns a `PhaseDraftOutput` object
(or throws). The harness validates it and persists the canonical copy.

## Phase input schema

```ts
type PhaseInput = {
  runId: string;
  workDir: string;           // the work/<run-id> checkout
  artefactDir: string;       // created by the harness, phase writes evidence here
  baseSha: string;           // HEAD before any phase ran. Not used by the
                             // harness (trackedWorktreeHash is full-tree,
                             // not diff-based), but available for phases
                             // that need to diff against the baseline.
  phase: string;             // canonical phase name (e.g. "lint", "typecheck")
  config?: Record<string, unknown>;  // phase-specific overrides
};
```

## Phase output schemas

There are two types. The phase returns a **draft** (no harness-computed fields).
The harness produces the **canonical** output (all fields filled).

### `PhaseDraftOutput` — returned by the phase

```ts
type PhaseDraftOutput = {
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[];    // relative paths under artefactDir/, no ".."
  errors: PhaseError[];      // empty if passed or skipped
};

// Note: "errored" is never returned by a phase. The harness produces it
// when the phase throws or returns invalid output. (Timeout handling is v2;
// see Future extensions below.)
```

### `PhaseOutput` — canonical, written by the harness

```ts
type PhaseOutput = {
  status: "passed" | "failed" | "skipped" | "errored";
  artefactDir: string;
  evidenceRefs: string[];
  errors: PhaseError[];
  headShaAfter: string | null;         // null when git rev-parse fails
  trackedWorktreeHash: string | null;  // null when hash computation fails
  worktreeClean: boolean | null;       // null when git status fails
};
```

**Availability invariants:**

- When `status !== "errored"`: `headShaAfter`, `trackedWorktreeHash`, and
  `worktreeClean` are guaranteed non-null.
- When `status === "errored"`: any of the three may be `null` if the harness
  could not compute them (e.g. hash hit EACCES, `git rev-parse` failed on a
  corrupted repository). `null` means "unavailable" — it is distinct from
  a valid SHA (40 hex chars) or hash (64 hex chars). The `errors` array MUST
  contain at least one blocking `PhaseError` explaining which field is
  unavailable and why.

The harness receives a `PhaseDraftOutput` from the phase, validates it against
the Zod schema, then computes `headShaAfter`, `trackedWorktreeHash`, and
`worktreeClean` to produce the canonical `PhaseOutput` written to `output.json`.

```ts
type PhaseError = {
  message: string;
  severity: "blocking" | "major" | "minor";
  file?: string;
  line?: number;
  evidenceRef?: string;      // relative path under artefactDir/, no ".."
};
```

### Status values

| Status | Meaning |
|--------|---------|
| `passed` | Phase completed successfully. Errors is empty. |
| `failed` | Phase completed but found issues. Errors MUST contain at least one PhaseError. |
| `skipped` | Phase decided not to run (e.g. no diff to lint, no tests to run). |
| `errored` | Phase threw or returned invalid output. Normalised by the harness. (Timeout is v2; see Future extensions.) |

A fatal harness bug (e.g. harness process killed by SIGKILL, disk full
preventing atomic write of `output.json`) is outside the `PhaseOutput`
contract — it produces no `output.json` at all. The caller must detect this
from the harness exit code or missing `output.json`. If the harness CAN
still write `output.json` (e.g. `git rev-parse` failed but the filesystem
is writable), it MUST produce `errored` with `null` for the unavailable
fields rather than produce no output.

When the harness produces `errored` (phase threw, returned invalid output,
or a harness-side computation failed), it MUST include at least one
`PhaseError` with `severity: "blocking"` explaining the cause. An `errored` status with an empty
`errors` array is invalid.

A `failed` status with an empty `errors` array is equally invalid. A phase
that completes without issues MUST return `passed`, not `failed` with zero
errors.

### `headShaAfter`

`git rev-parse HEAD` after the phase completes. Cheap and deterministic.
Captures what is committed. If no commit happened during the phase, this equals
the previous `headShaAfter`.

### `trackedWorktreeHash`

A deterministic fingerprint of **all tracked files** as they exist on disk
after the phase returns — staged, unstaged, committed, or deleted. This is a
full tree hash, not a diff. Two worktrees with identical tracked file contents
produce the same hash regardless of how they arrived there.

**Canonical algorithm** (the harness MUST implement this exactly):

1. Collect tracked files with mode bits: `git ls-files -s -z`. Output format:
   `<mode> <object> <stage>\t<path>\0`. The `-z` flag makes output machine-
   parseable (paths are NUL-terminated).

   If any entry has a stage value other than `0` (unmerged entries from a
   merge conflict), the harness MUST produce `errored` with a blocking
   `PhaseError`. The algorithm does not run on a conflicted index.

2. For each entry, determine the file's current content and mode:
   - **Regular file** (mode starts with `100`): `sha256(<file bytes>)` — raw
     filesystem bytes, not a Git blob ID. Ignore `.gitattributes` filters and
     line-ending normalization. **Mode** is normalised to Git-style:
     `100755` if any executable bit is set (`stat(path).mode & 0o111`),
     otherwise `100644`. Raw `stat().mode` includes permission bits Git does
     not track (setuid, sticky, umask); normalising ensures the hash is
     reproducible across checkouts and machines.
   - **Symlink** (mode `120000`): hash `readlink(path)` (the target path as
     a string). Do NOT hash the target file's bytes.
   - **Deleted** (tracked by Git but absent from disk): content hash is the
     sentinel `"DELETED"`, mode is `0`.
   - **Submodule** (mode `160000`): use the object ID from
     `git ls-files -s` output directly. This catches submodule pointer
     changes (the commit SHA the submodule references). It does NOT detect
     uncommitted changes inside the submodule worktree — those are outside
     the scope of `trackedWorktreeHash`. Dirty submodule contents ARE
     detected by `worktreeClean` which runs with
     `--ignore-submodules=none` (see below).
Any read error during hash computation (EACCES, ENOENT mid-hash, broken
symlink where `readlink` fails) MUST cause the harness to produce
`errored` with a `PhaseError` of severity `"blocking"` naming the
problematic path. The harness does not silently skip or substitute values.

3. Sort the tuples `(path, mode, contentHash)` lexicographically by path.
4. Serialize as NUL-delimited records:
   `<path>\0<mode>\0<contentHash>\0` for each file.
5. `trackedWorktreeHash = sha256(concatenated records)`.

**Scope**: tracked files only (as reported by `git ls-files`). Untracked
files and `.gitignore`-d files are excluded (detected by `worktreeClean`,
not by this hash). File modes, symlinks, and submodule pointers ARE
included — see the canonical algorithm above.

Sparse checkouts and `skip-worktree` bits are not supported in v1. The
harness detects a sparse checkout (`git sparse-checkout list` is non-empty)
and refuses to run (preflight failure, no `output.json`).

**Empty worktree** (zero tracked files): the hash of the empty string
(`sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`).

### `worktreeClean`

`true` when `git status --porcelain=v1 -z --ignore-submodules=none` produces no output. Phases that mutate
files without committing leave the worktree dirty. This flag lets the next
phase or the orchestrator decide whether to proceed, stash, reset, or abort.

### `evidenceRefs`

- Relative paths only, rooted at `artefactDir/`. No `..` segments.
- Validated for **realpath containment** by the harness: `realpath(ref)` must
  start with `realpath(artefactDir) + "/"`. This catches symlink escapes that
  a simple `..` check would miss.
- Must point to regular files inside `artefactDir/`, typically under `evidence/`.

### stdout/stderr capture

For in-process function phases, stdout/stderr capture is **not guaranteed** —
capturing process-global streams while an async function runs is fragile. Phases
should write diagnostic output to files under `evidence/` instead of relying on
stdout/stderr.

When the phase runs as a subprocess (future CLI adapter), the harness captures
stdout and stderr into `stdout.txt` and `stderr.txt`. Until then, these files
are **optional** and may be absent from `artefactDir/`.

The artefact directory tree marks them as optional:

```
artefactDir/
├── output.json       # always present, written by the harness
├── stdout.txt        # optional (only for subprocess phases)
├── stderr.txt        # optional (only for subprocess phases)
└── evidence/         # raw evidence written by the phase
```

## Runner behaviour

The runner collects all canonical fields **best-effort and independently**.
If any computation fails (EACCES, git failure), the corresponding field is
set to `null` — the other fields are still attempted. A single canonical
`PhaseOutput` is written at the end, regardless of how many
sub-computations failed. The only case where **no** `output.json` is
produced is a preflight failure (step 1).

```
runPhase(phaseFn, input):

  -- Preflight --
  1. If artefactDir already exists → fail (non-zero exit, no output.json).
     artefactDir collision is a configuration error, not a phase error.
     The caller must not reuse artefactDir without clearing it first.
  2. Create artefactDir/ with mkdir(artefactDir).

  -- Phase execution --
  3. Invoke phaseFn(input).
     If it throws → capture the error message; treat as errored (step 8).

  -- Canonical fields (best-effort, independent) --
  4. headShaAfter = try git rev-parse HEAD (null if fails).
  5. trackedWorktreeHash = try canonical algorithm (null if fails).
  6. worktreeClean = try git status --porcelain=v1 -z --ignore-submodules=none
     is empty (null if fails).

  -- Validation --
  7. If phaseFn returned a value:
       a. Validate against PhaseDraftOutput Zod schema.
          If invalid → treat as errored (step 8).
       b. Validate every evidenceRef:
            - Exists on disk
            - realpath(ref) starts with realpath(artefactDir) + "/"
            - Is a regular file
          If any check fails → treat as errored (step 8).

  -- Assemble and write --
  8. Determine final status:
       - If phase threw, Zod validation failed, or evidenceRef invalid
         → "errored". errors: at least one blocking PhaseError describing
         the cause.
       - Otherwise → from PhaseDraftOutput.status.
     Assemble the canonical PhaseOutput with all fields from steps 4-6
     (null for any that could not be computed).
  9. Write output.json atomically (tmp + rename).
  10. Return PhaseOutput.
```

## Phase implementation contract

A phase is an async function. It does not import Turnlock. It does not know
about state machines, resume, or delegation.

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
    errors: result.errors.map(e => ({
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
  }
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
  validation, stdout/stderr capture, `trackedWorktreeHash` computation, and error
  normalisation happen. Phases don't duplicate this logic.

## Future extensions (v2)

These are deliberately out of scope for v1 but the contract leaves room:

- **Timeout / cancellation**: `timeoutMs` in `PhaseInput`, `AbortSignal` for
  cooperative cancellation. Currently `runPhase` only catches thrown
  exceptions; it cannot stop a runaway subprocess or infinite loop.
- **Durability (fsync)**: `output.json` is written atomically (tmp + rename),
  but the harness does not `fsync` the file or parent directory. For
  Turnlock-grade durability in v2, specify `fsync` before considering
  `output.json` durable.
- **Chaining context**: `previousPhaseOutputs: PhaseOutput[]`, `attemptNumber`.
- **CLI adapter**: a thin wrapper that reads `PhaseInput` from stdin/argv and
  writes `PhaseDraftOutput` to stdout, so phases can be invoked as
  subprocesses. This also unlocks proper stdout/stderr capture.
