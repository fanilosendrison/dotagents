# Phase Contract — Shared harness for `/go` pipeline phases

## Goal

Every phase in the `/go` pipeline (workspace-setup, lint, typecheck, tests,
review, commit-push-pr, etc.) must conform to a single shared contract so they
can be chained, verified, and eventually orchestrated by a Turnlock FSM.

We start with a **standalone harness** — no FSM, no `@@TURNLOCK@@` protocol, no
resume. Just a standard way to invoke a phase, capture its result, and validate
its output. Later, every phase that implements this contract can be wrapped into
a Turnlock FSM without changing its internals.

A phase is a **plain async function**: `Phase = (input: PhaseInput) => Promise<PhaseOutput>`.
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

2. **Standard output** (`PhaseOutput`): what every phase must return — status,
   worktree diff hash, artefact directory, evidence references, errors.

3. **Runner** (`runPhase`): invokes a phase, creates the artefact directory,
   captures the raw stdout/stderr, validates the returned `PhaseOutput` against
   its Zod schema, writes the canonical `output.json`, and validates that every
   `evidenceRef` exists on disk.

## Artefact directory contract

The harness creates `artefactDir/` before invoking the phase. The phase writes
raw evidence into it. The harness writes the canonical `output.json` after the
phase returns.

```
artefactDir/
├── output.json       # canonical, written by the harness after Zod validation
├── stdout.txt        # raw stdout, captured by the harness
├── stderr.txt        # raw stderr, captured by the harness
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
| `stdout.txt` | The harness | Captured from the phase process |
| `stderr.txt` | The harness | Captured from the phase process |
| `output.json` | The harness | After Zod validation of `PhaseOutput` |

The phase never writes `output.json` directly. It returns a `PhaseOutput` object
(or throws). The harness validates it and persists the canonical copy.

## Phase input schema

```ts
type PhaseInput = {
  runId: string;
  workDir: string;           // the work/<run-id> checkout
  artefactDir: string;       // created by the harness, phase writes evidence here
  baseSha: string;           // HEAD before any phase ran
  phase: string;             // canonical phase name (e.g. "lint", "typecheck")
  config?: Record<string, unknown>;  // phase-specific overrides
};
```

## Phase output schema

```ts
type PhaseOutput = {
  status: "passed" | "failed" | "skipped" | "errored";
  headShaAfter: string;      // git rev-parse HEAD after the phase
  worktreeDiffHash: string;  // deterministic fingerprint of the live worktree
  worktreeClean: boolean;    // git status --porcelain is empty
  artefactDir: string;       // set by the harness, echoed back
  evidenceRefs: string[];    // relative paths under artefactDir/, no ".."
  errors: PhaseError[];      // empty if passed or skipped
};

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
| `failed` | Phase completed but found issues. Errors contains findings. |
| `skipped` | Phase decided not to run (e.g. no diff to lint, no tests to run). |
| `errored` | Phase crashed, timed out, returned invalid output, or threw. Normalised by the harness. |

A fatal harness bug (e.g. harness process killed by SIGKILL) is outside the
`PhaseOutput` contract — it produces no output at all. The caller must detect
this from the harness exit code or missing `output.json`.

### `headShaAfter`

`git rev-parse HEAD` after the phase completes. Cheap and deterministic.
Captures what is committed. If no commit happened during the phase, this equals
the previous `headShaAfter`.

### `worktreeDiffHash`

A deterministic fingerprint of the **live worktree** — staged and unstaged
changes, not just what is committed. The harness computes it from the actual
files on disk after the phase returns.

`git diff baseSha...HEAD` is **not** sufficient: it only captures committed
differences. A phase that applies `biome --fix` may leave unstaged changes that
a commit-only diff would miss.

The exact mechanism is left to the harness implementation (e.g. sha256 of
`git diff baseSha` combined with a tree hash of tracked files), but the
contract guarantees:
- It changes if and only if any tracked file changed since `baseSha`.
- It is deterministic: same files → same hash.
- If the worktree is identical to `baseSha`: the hash of the empty string.

### `worktreeClean`

`true` when `git status --porcelain` produces no output. Phases that mutate
files without committing leave the worktree dirty. This flag lets the next
phase or the orchestrator decide whether to proceed, stash, reset, or abort.

### `evidenceRefs`

- Relative paths only, rooted at `artefactDir/`. No `..` segments.
- Validated for existence by the harness after the phase returns.
- Must point to files inside `artefactDir/`, typically under `evidence/`.

## Runner behaviour

```
runPhase(phaseFn, input):
  1. Create artefactDir/
  2. Capture start time
  3. Invoke phaseFn(input)
  4. If phaseFn throws or times out:
       → write output.json with status: "errored", empty evidenceRefs
  5. Validate returned PhaseOutput against Zod schema
  6. Compute headShaAfter = git rev-parse HEAD
  7. Compute worktreeDiffHash from the live worktree (not just committed diff)
  8. Compute worktreeClean = git status --porcelain is empty
  9. Validate every evidenceRef exists on disk
  10. Capture stdout/stderr into stdout.txt / stderr.txt
  11. Write canonical output.json
  12. Return PhaseOutput
```

## Phase implementation contract

A phase is an async function. It does not import Turnlock. It does not know
about state machines, resume, or delegation.

```ts
type Phase = (input: PhaseInput) => Promise<PhaseOutput>;
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
      headShaAfter: "",       // harness fills this in
      worktreeDiffHash: "",   // harness fills this in
      worktreeClean: true,    // harness fills this in
      artefactDir: input.artefactDir,
      evidenceRefs: ["evidence/lint.json"],
      errors: [],
    };
  }

  return {
    status: "failed",
    headShaAfter: "",
    worktreeDiffHash: "",
    worktreeClean: false,
    artefactDir: input.artefactDir,
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
knows about `PhaseInput → PhaseOutput`.

## What this unlocks

- Every phase can be tested in isolation: pass it a `PhaseInput`, assert on
  `PhaseOutput` and the contents of `artefactDir/`.
- Phases can be run manually during development: `bun run phases/lint.ts`.
- The output is machine-verifiable: `PhaseOutput` is validated against its Zod
  schema before the harness returns.
- The harness is the single place where artefact directory creation, output
  validation, stdout/stderr capture, `worktreeDiffHash` computation, and error
  normalisation happen. Phases don't duplicate this logic.

## Future extensions (v2)

These are deliberately out of scope for v1 but the contract leaves room:

- **Chaining context**: `previousPhaseOutputs: PhaseOutput[]`, `attemptNumber`,
  `timeoutMs`.
- **CLI adapter**: a thin wrapper that reads `PhaseInput` from stdin/argv and
  writes `PhaseOutput` to stdout, so phases can be invoked as subprocesses.
