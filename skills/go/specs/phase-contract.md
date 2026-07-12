# Phase Contract — Shared harness for `/go` pipeline phases

## Goal

Every phase in the `/go` pipeline (workspace-setup, lint, typecheck, tests,
review, commit-push-pr, etc.) must conform to a single shared contract so they
can be chained, verified, and eventually orchestrated by a Turnlock FSM.

We start with a **standalone harness** — no FSM, no `@@TURNLOCK@@` protocol, no
resume. Just a standard way to invoke a phase, capture its result, and validate
its output. Later, every phase that implements this contract can be wrapped into
a Turnlock FSM without changing its internals.

## Analogy

`git-commits-push` is a Bun script that takes context, does work, and produces
structured output. The phases of `/go` should work the same way: each phase is
an independent process (or function) that receives standardised input and
produces standardised output.

## What the harness provides

1. **Standard input** (`PhaseInput`): what every phase receives — run context,
   work directory, phase-specific config.

2. **Standard output** (`PhaseOutput`): what every phase must return —
   artefact directory, diff hash, status, evidence references.

3. **Runner** (`runPhase`): invokes a phase, captures its artefacts, validates
   the output schema, and writes results to a deterministic location under the
   artefact directory.

## Artefact directory contract

Every phase writes its evidence to `artefactDir/`:

```
artefactDir/
├── output.json       # structured result (tool output, findings, stats)
├── stdout.txt        # raw stdout capture
├── stderr.txt        # raw stderr capture
└── evidence/         # optional: files the phase wants to keep as proof
    ├── diff.patch
    ├── screenshot.png
    └── ...
```

The harness is responsible for creating `artefactDir/` before the phase runs.
The phase writes into it. The harness reads `output.json` after the phase exits.

## Phase output schema

```ts
type PhaseOutput = {
  status: "passed" | "failed";
  diffHash: string;          // sha256 of the unified diff produced by this phase
  artefactDir: string;       // absolute path, set by the harness
  evidenceRefs: string[];    // relative paths inside artefactDir/
  errors: PhaseError[];      // empty if passed
};

type PhaseError = {
  message: string;
  severity: "blocking" | "major" | "minor";
  file?: string;
  line?: number;
  evidenceRef?: string;      // relative path inside artefactDir/
};
```

## Phase input schema

```ts
type PhaseInput = {
  runId: string;
  workDir: string;           // the work/<run-id> checkout
  artefactDir: string;       // where the phase must write its evidence
  baseSha: string;           // HEAD before implementation
  phase: string;             // canonical phase name (e.g. "lint", "typecheck")
  config?: Record<string, unknown>;  // phase-specific overrides
};
```

## Relationship to Turnlock

This harness is deliberately **Turnlock-free**. A phase that implements this
contract is a plain async function:

```ts
type Phase = (input: PhaseInput) => Promise<PhaseOutput>;
```

Later, wrapping it into a Turnlock FSM is a mechanical step:

```ts
const lintPhase = definePhase<GoState, void, PhaseOutput>(
  async (state, io) => {
    const input = buildPhaseInput(state, "lint");
    const output = await runPhase(lintPhaseImpl, input);
    if (output.status === "failed") return io.fail(...);
    return io.transition("typecheck", { ...state, checks: [...state.checks, output] });
  }
);
```

The phase implementation (`lintPhaseImpl`) does not know about Turnlock. It only
knows about `PhaseInput → PhaseOutput`.

## What this unlocks

- Every phase can be tested in isolation: pass it a `PhaseInput`, assert on
  `PhaseOutput` and the contents of `artefactDir/`.
- Phases can be run manually during development: `bun run phases/lint.ts`.
- The output is machine-verifiable: `PhaseOutput` is validated against its Zod
  schema before the harness returns.
- The harness is the single place where artefact directory creation, output
  validation, and error normalisation happen. Phases don't duplicate this logic.
