---
id: NIB-T-GO-PHASE-HARNESS
type: nib-tddtests
version: "1.0.0"
scope: go-phase-harness
status: active
consumers: [codex]
superseded_by: []
---

# NIB-T - `/go` Phase Harness Tests

VegaCorp - July 2026

---

## 1. Purpose

This NIB-T defines RED behavioral tests for the standalone `/go` phase harness.
The tests verify the observable behavior of `runPhase`: returned `PhaseOutput`,
persisted `output.json`, artefact side effects, Git-state canonical fields, and
failure behavior visible to callers.

The tests do not verify private helper functions, exports, constants, or schema
objects directly. Those checks belong to GREEN Layer 1 companion tests, not the
RED suite.

---

## 2. Fixture Organization

Tests are organized under the implementation package root:

```text
tests/phase-harness/
├── acceptance/
│   └── run-phase.acceptance.test.ts
├── properties/
│   └── run-phase.properties.test.ts
├── fixtures/
│   ├── phases.ts
│   └── repositories.ts
└── helpers/
    ├── assert-phase-output.ts
    ├── fault-injection.ts
    ├── git-fixture.ts
    ├── hash-expectations.ts
    └── temp-artifacts.ts
```

Production code is imported only through the public construction API:

```ts
import { runPhase } from "../../src/phase-harness";
```

The RED implementation step may create minimal stubs so tests compile. Those
stubs must not implement runtime behavior; acceptance tests must fail until
GREEN implementation consumes the NIB-S, NIB-Ms, and DCs.

---

## 3. Test Helpers

### 3.1 `createCommittedRepo`

Creates a temporary Git repository with one initial commit.

```ts
type CommittedRepo = {
  workDir: string;
  baseSha: string;
  files: Record<string, string>;
  cleanup: () => Promise<void>;
};
```

Required behavior:

1. Create a temp directory.
2. `git init`.
3. Configure local `user.name` and `user.email` with generic placeholders.
4. Write requested tracked files.
5. `git add .`.
6. `git commit -m "initial"`.
7. Return `workDir` and exact `baseSha` from `git rev-parse HEAD`.

### 3.2 `createCommittedRepoFromEntries`

Creates a temporary Git repository from entries that include modes, symlinks,
deleted tracked files, and optional submodules.

```ts
type RepoEntry =
  | { kind: "file"; path: string; bytes: string; executable?: boolean }
  | { kind: "symlink"; path: string; target: string }
  | { kind: "deleted-after-commit"; path: string; bytes: string }
  | { kind: "submodule"; path: string; commitSha: string };

type CommittedRepoFromEntries = CommittedRepo & {
  entries: RepoEntry[];
};
```

Required behavior:

1. Create all entries.
2. Commit them.
3. Apply `deleted-after-commit` deletions after the commit.
4. Return the committed `baseSha` and final worktree state.

### 3.3 `createArtifactParent`

Creates a temporary directory outside `workDir` and returns an unused child path
for the phase artefact directory.

```ts
type ArtifactPaths = {
  parentDir: string;
  artefactDir: string;
  cleanup: () => Promise<void>;
};
```

### 3.4 Phase fixtures

```ts
type PhaseFixture = (input: PhaseInput) => Promise<PhaseDraftOutput>;
```

Provide these phase fixtures:

- `passingPhaseWithEvidence`: writes `evidence/result.json` and returns
  `passed`.
- `failingPhaseWithEvidence`: writes `evidence/lint.json` and returns `failed`
  with one `minor` error referencing the evidence.
- `skippedPhase`: writes no evidence and returns `skipped`.
- `throwingPhase`: throws `new Error("phase exploded")`.
- `invalidDraftPhase`: returns a structurally invalid value.
- `undefinedDraftPhase`: resolves to `undefined`.
- `erroredDraftPhase`: returns draft status `errored`.
- `failedWithoutErrorsPhase`: returns `failed` with no errors.
- `passedWithErrorsPhase`: returns `passed` with one error.
- `skippedWithErrorsPhase`: returns `skipped` with one error.
- `dirtyTrackedFilePhase`: edits an existing tracked file and returns `passed`.
- `reservedOutputPhase`: writes root `output.json` and returns `passed`.
- `reservedStdoutPhase`: writes root `stdout.txt` and returns `passed`.
- `reservedStderrPhase`: writes root `stderr.txt` and returns `passed`.
- `symlinkEscapeEvidencePhase`: creates an evidence ref that resolves outside
  `artefactDir` and returns it.
- `invalidErrorEvidencePhase`: returns an error whose `evidenceRef` is not in
  top-level `evidenceRefs`.
- `invalidErrorFilePhase`: returns an error with an invalid `file` path.
- `invalidErrorLinePhase`: returns an error with `line: 0`.
- `stringThrowingPhase`: throws `"string exploded"`.
- `objectThrowingPhase`: throws `{ code: "EXPLODED" }`.
- `cyclicThrowingPhase`: throws a cyclic object.

### 3.5 Fault injection helpers

The RED suite may use deterministic dependency fault injection for failures that
are otherwise environment-dependent.

```ts
type FaultInjection = {
  failNextRename?: boolean;
  failNextWriteFile?: boolean;
  forceTempFileCollision?: boolean;
  failGitCommand?: "rev-parse-head" | "status" | "ls-files-s";
};
```

Fault injection must be exposed only to tests and must not become part of the
production public API. It may be implemented by dependency injection in the test
build, by module mocking, or by placing a fake `git` executable earlier in
`PATH` for the duration of a single test.

### 3.6 Hash expectation helpers

`computeExpectedTrackedHash(entries)` computes expected hashes from fixture
entries using the same byte-level contract as the NIB-M:

- regular files hash raw file bytes;
- executable regular files use mode `100755`;
- non-executable regular files use mode `100644`;
- symlinks hash raw symlink target bytes;
- deleted tracked files use content hash `DELETED` and mode `0`;
- submodules use the index object ID as content hash and mode `160000`;
- records are sorted by raw path bytes.

This helper belongs to tests because it computes expected fixture values. It
must not call production hashing code.

### 3.7 Assertions

`assertOutputJsonMatchesReturn(output)`:

- Reads `path.join(output.artefactDir, "output.json")`.
- Parses JSON.
- Asserts parsed JSON deep-equals the returned `PhaseOutput`.

`assertNoOutputJson(artefactDir)`:

- If `artefactDir` does not exist, pass.
- If it exists, assert `output.json` does not exist.

`assertCanonicalFieldsAvailable(output)`:

- Asserts `headShaAfter`, `trackedWorktreeHash`, and `worktreeClean` are
  non-null.

`assertErroredHasBlockingError(output)`:

- Asserts `status === "errored"`.
- Asserts at least one error has `severity === "blocking"`.

---

## 4. Acceptance Test Vectors

### A1 - Passing phase writes canonical output

Given:

- A committed repo with `src/a.txt = "alpha\n"`.
- An artefact directory outside the repo that does not yet exist.
- `passingPhaseWithEvidence`.

When:

- `runPhase(phase, input)` is called.

Then:

- Returned `status` is `passed`.
- Returned `errors` is empty.
- Returned `evidenceRefs` is `["evidence/result.json"]`.
- `headShaAfter`, `trackedWorktreeHash`, and `worktreeClean` are non-null.
- `worktreeClean` is `true`.
- `artefactDir/output.json` exists.
- Parsed `output.json` deep-equals the returned output.

### A2 - Failing phase preserves phase errors

Given:

- A clean committed repo.
- `failingPhaseWithEvidence`.

Then:

- Returned `status` is `failed`.
- Returned `errors` has exactly one phase error.
- The phase error has `severity: "minor"`.
- The phase error keeps `file`, `line`, and `evidenceRef`.
- `output.json` exists and matches the returned output.
- Canonical fields are non-null.

### A3 - Skipped phase has no errors

Given:

- A clean committed repo.
- `skippedPhase`.

Then:

- Returned `status` is `skipped`.
- Returned `errors` is empty.
- Returned `evidenceRefs` is empty.
- `output.json` exists and matches the returned output.
- Canonical fields are non-null.

### A4 - Throwing phase becomes errored output

Given:

- A clean committed repo.
- `throwingPhase`.

Then:

- Returned `status` is `errored`.
- At least one error is blocking.
- At least one error message contains `phase exploded`.
- `output.json` exists and matches the returned output.
- Canonical fields are non-null unless the test fixture deliberately corrupted
  Git state, which this fixture does not.

### A5 - Invalid draft becomes errored output

Given:

- A clean committed repo.
- `invalidDraftPhase`.

Then:

- Returned `status` is `errored`.
- At least one blocking error names draft validation.
- `output.json` exists and matches the returned output.
- Canonical fields are non-null.

### A6 - Dirty tracked mutation is observable

Given:

- A committed repo with `src/a.txt = "alpha\n"`.
- `dirtyTrackedFilePhase`, which changes `src/a.txt` to `"beta\n"` and returns
  `passed`.

Then:

- Returned `status` is `passed`.
- Returned `worktreeClean` is `false`.
- Returned `trackedWorktreeHash` is non-null.
- `output.json` exists and matches the returned output.
- The final repo file content is `"beta\n"`.

### A7 - Reserved root output file is rejected and replaced

Given:

- A clean committed repo.
- `reservedOutputPhase`, which writes root `output.json` in `artefactDir` before
  returning `passed`.

Then:

- Returned `status` is `errored`.
- At least one blocking error names a reserved-file violation.
- The final `artefactDir/output.json` exists.
- Parsed `output.json` deep-equals the returned output.
- The phase-written placeholder content is not present.

### A8 - Evidence symlink escape is rejected

Given:

- A clean committed repo.
- `symlinkEscapeEvidencePhase`, which returns an evidence ref resolving outside
  `artefactDir`.

Then:

- Returned `status` is `errored`.
- At least one blocking error names evidence containment.
- Escaping evidence ref is not present in returned `evidenceRefs`.
- `output.json` exists and matches the returned output.

### A9 - Artefact directory inside worktree fails preflight

Given:

- A committed repo.
- `artefactDir` points to `<workDir>/artifacts/lint`.
- A phase function that increments an invocation counter if called.

Then:

- `runPhase` rejects with a preflight/setup error.
- The phase invocation counter remains `0`.
- No `output.json` exists at the requested artefact path.

### A10 - Existing artefact directory fails before phase invocation

Given:

- A committed repo.
- `artefactDir` already exists outside the repo.
- A phase function that increments an invocation counter if called.

Then:

- `runPhase` rejects with a preflight/setup error.
- The phase invocation counter remains `0`.
- No canonical `output.json` exists in the existing artefact directory.

### A11 - Unmerged index makes tracked hash unavailable

Given:

- A committed repo deliberately placed into a merge-conflict index state.
- `passingPhaseWithEvidence`.

Then:

- Returned `status` is `errored`.
- Returned `trackedWorktreeHash` is `null`.
- At least one blocking error names the unmerged index or conflicted path.
- `headShaAfter` and `worktreeClean` were still attempted.
- `output.json` exists and matches the returned output.

### A12 - Draft status and error coupling violations become errored

For each phase:

- `undefinedDraftPhase`
- `erroredDraftPhase`
- `failedWithoutErrorsPhase`
- `passedWithErrorsPhase`
- `skippedWithErrorsPhase`

Given:

- A clean committed repo.

Then:

- Returned `status` is `errored`.
- At least one blocking error names draft validation.
- `output.json` exists and matches the returned output.
- Canonical fields are non-null.

### A13 - Non-Error thrown values become blocking harness errors

For each phase:

- `stringThrowingPhase`
- `objectThrowingPhase`
- `cyclicThrowingPhase`

Given:

- A clean committed repo.

Then:

- Returned `status` is `errored`.
- At least one error is blocking.
- For `stringThrowingPhase`, at least one error message contains
  `string exploded`.
- For `objectThrowingPhase`, at least one error message contains `EXPLODED`.
- For `cyclicThrowingPhase`, at least one error message contains
  `non-serializable`.
- `output.json` exists and matches the returned output.

### A14 - Invalid error evidence references are sanitized

Given:

- A clean committed repo.
- `invalidErrorEvidencePhase`.

Then:

- Returned `status` is `errored`.
- The original phase error is preserved.
- The invalid `errors[].evidenceRef` is omitted from the returned phase error.
- At least one blocking harness error names evidence reference validation.
- `output.json` exists and matches the returned output.

### A15 - Invalid error file and line metadata are sanitized

For each phase:

- `invalidErrorFilePhase`
- `invalidErrorLinePhase`

Given:

- A clean committed repo.

Then:

- Returned `status` is `errored`.
- The original phase error is preserved as much as possible.
- Invalid `file` or `line` metadata is omitted from the returned phase error.
- At least one blocking harness error names error metadata validation.
- `output.json` exists and matches the returned output.

### A16 - Reserved stdout and stderr root files are rejected

For each phase:

- `reservedStdoutPhase`
- `reservedStderrPhase`

Given:

- A clean committed repo.

Then:

- Returned `status` is `errored`.
- At least one blocking error names a reserved-file violation.
- The reserved file exists only as phase-created diagnostic residue; it is not
  trusted as harness output.
- `output.json` exists and matches the returned output.

### A17 - Missing artefact parent fails before phase invocation

Given:

- A committed repo.
- `artefactDir` points to a child of a non-existent parent directory.
- A phase function that increments an invocation counter if called.

Then:

- `runPhase` rejects before returning `PhaseOutput`.
- The phase invocation counter remains `0`.
- The missing parent remains absent.
- No canonical `output.json` exists.

### A18 - Non-root workDir fails preflight

Given:

- A committed repo with a tracked subdirectory `src/`.
- `workDir` points to `<repo>/src`.
- A phase function that increments an invocation counter if called.

Then:

- `runPhase` rejects before returning `PhaseOutput`.
- The phase invocation counter remains `0`.
- No canonical `output.json` exists.

### A19 - Invalid baseSha variants fail preflight

For each `baseSha` variant:

- `HEAD`
- a tree object ID
- a blob object ID
- a non-existent object ID with the correct hash length

Given:

- A committed repo.
- A phase function that increments an invocation counter if called.

Then:

- `runPhase` rejects before returning `PhaseOutput`.
- The phase invocation counter remains `0`.
- No canonical `output.json` exists.

### A20 - Unsupported checkout modes fail preflight

For each repository state:

- sparse checkout enabled;
- one tracked path marked skip-worktree;
- one tracked path marked assume-unchanged.

Given:

- A phase function that increments an invocation counter if called.

Then:

- `runPhase` rejects before returning `PhaseOutput`.
- The phase invocation counter remains `0`.
- No canonical `output.json` exists.

### A21 - Non-JSON config fails preflight

For each config value:

- `{ value: undefined }`
- `{ value: NaN }`
- `{ value: Infinity }`
- `{ value: new Date("<date>") }`
- `{ value: new Map() }`
- a cyclic object

Given:

- A committed repo.
- A phase function that increments an invocation counter if called.

Then:

- `runPhase` rejects before returning `PhaseOutput`.
- The phase invocation counter remains `0`.
- No canonical `output.json` exists.

### A22 - Exact tracked hash covers regular file bytes and executable mode

Given:

- A repo created from entries:
  - `src/plain.txt` as a non-executable file with bytes `plain\n`;
  - `bin/tool.sh` as an executable file with bytes `#!/bin/sh\nexit 0\n`.
- `passingPhaseWithEvidence`.

Then:

- Returned `status` is `passed`.
- Returned `trackedWorktreeHash` equals `computeExpectedTrackedHash(entries)`.
- Changing only the executable bit changes the expected and returned hash.
- `output.json` exists and matches the returned output.

### A23 - Exact tracked hash covers symlink targets and deleted tracked files

Given:

- A repo created from entries:
  - `links/current` as a symlink whose target is `../target.txt`;
  - `deleted.txt` as a `deleted-after-commit` file.
- `passingPhaseWithEvidence`.

Then:

- Returned `status` is `passed`.
- Returned `trackedWorktreeHash` equals `computeExpectedTrackedHash(entries)`.
- The symlink hash is derived from the target string, not the target file bytes.
- The deleted tracked path contributes content hash `DELETED` and mode `0`.

### A24 - Tracked type mismatch makes tracked hash unavailable

Given:

- A repo where Git index records `src/a.txt` as a regular file.
- Before `runPhase`, replace `src/a.txt` on disk with a symlink.
- `passingPhaseWithEvidence`.

Then:

- Returned `status` is `errored`.
- Returned `trackedWorktreeHash` is `null`.
- At least one blocking error names `src/a.txt`.
- `headShaAfter` and `worktreeClean` were still attempted.
- `output.json` exists and matches the returned output.

### A25 - Submodule pointer affects hash and dirty submodule affects clean flag

Given:

- A repo with one submodule entry.
- Two runs where only the indexed submodule pointer differs.

Then:

- The two returned `trackedWorktreeHash` values differ.

And given:

- A repo whose submodule pointer is unchanged but whose submodule worktree is
  dirty.

Then:

- Returned `trackedWorktreeHash` may equal the clean-submodule hash.
- Returned `worktreeClean` is `false`.

### A26 - Persistence write and rename failures produce no canonical output

For each fault injection:

- `failNextWriteFile`;
- `failNextRename`;
- `forceTempFileCollision`.

Given:

- A clean committed repo.
- `passingPhaseWithEvidence`.

Then:

- `runPhase` rejects before returning `PhaseOutput`.
- No valid canonical `output.json` is guaranteed to exist.
- If a temporary file remains after rename failure, cleanup is best effort and
  the test must not treat leftover temp files as successful output.

---

## 5. Property Tests

### P1 - Identical tracked contents produce identical tracked hashes

For several generated small file maps:

1. Create two independent committed repos with the same tracked paths, modes,
   symlink targets, and file bytes.
2. Run `passingPhaseWithEvidence` in each repo with distinct artefact parents.
3. Assert both outputs are `passed`.
4. Assert both `trackedWorktreeHash` values are equal.

This prevents implementations from including absolute worktree paths or artefact
paths in the tracked hash.

### P2 - Untracked and ignored files do not affect tracked hash

For a committed repo:

1. Run `passingPhaseWithEvidence` and capture `trackedWorktreeHash`.
2. Add an untracked file.
3. Run `passingPhaseWithEvidence` again in a new artefact directory.
4. Assert both tracked hashes are equal.
5. Assert the second output has `worktreeClean === false`.
6. Add an ignored file matched by `.gitignore`.
7. Run `passingPhaseWithEvidence` again in a new artefact directory.
8. Assert the ignored-only change does not change `trackedWorktreeHash`.

This verifies the tracked-files-only hash scope while preserving the
`worktreeClean` contract for untracked files.

### P3 - Evidence path escapes are always errored

For each generated invalid evidence reference:

- absolute path
- `..` segment
- NUL byte
- symlink escape
- directory instead of regular file
- missing file

Run a phase that returns that reference.

Assert:

- Returned status is `errored`.
- At least one blocking error exists.
- Invalid reference is absent from returned `evidenceRefs`.
- `output.json` matches the returned output.

### P4 - Preflight failures never invoke phase

For each invalid preflight input:

- invalid `runId`
- invalid `phase`
- relative `workDir`
- relative `artefactDir`
- missing `artefactDir` parent
- `artefactDir` basename `.`
- `artefactDir` basename `..`
- `artefactDir` inside `workDir`
- existing `artefactDir`
- non-root `workDir`
- `baseSha` set to `HEAD`
- `baseSha` set to a tree object
- `baseSha` set to a blob object
- nonexistent `baseSha`
- sparse checkout
- skip-worktree bit
- assume-unchanged bit
- non-JSON `config`

Run with a phase that increments an invocation counter.

Assert:

- `runPhase` rejects before returning `PhaseOutput`.
- The phase invocation counter is `0`.
- No canonical `output.json` exists.

### P5 - Output JSON is the canonical return value

Across all acceptance fixtures that produce a `PhaseOutput`, assert:

- `output.json` exists.
- Parsed `output.json` deep-equals the returned output.
- `output.json.status` obeys status/error coupling.
- Non-`errored` output has non-null canonical fields.
- `errored` output has at least one blocking error.

### P6 - Tracked hash changes for every tracked content dimension

For generated pairs of repos that differ by exactly one dimension:

- regular file bytes;
- executable bit;
- symlink target string;
- tracked deletion state;
- submodule pointer.

Run `passingPhaseWithEvidence` in both repos.

Assert:

- Both outputs return a non-null `trackedWorktreeHash`.
- The two `trackedWorktreeHash` values differ.

### P7 - Harness errors dominate phase status

For each phase draft status:

- `passed`
- `failed`
- `skipped`

Inject one harness-side validation or state error after phase invocation.

Assert:

- Returned `status` is `errored`.
- Phase errors, when valid, are preserved.
- At least one blocking harness error is present.
- `output.json` matches the returned output.

### P8 - Canonical fields are collected independently

For each canonical field collection failure:

- `headShaAfter` unavailable;
- `trackedWorktreeHash` unavailable;
- `worktreeClean` unavailable.

Use deterministic Git fault injection for only that command.

Assert:

- Returned `status` is `errored`.
- Only the affected canonical field is `null` when the other commands can
  succeed.
- The other canonical fields were attempted and are non-null.
- At least one blocking error names the unavailable field.

---

## 6. Contract Invariants

Apply these invariants to every acceptance test that returns `PhaseOutput`:

- `output.runId` equals input `runId`.
- `output.phase` equals input `phase`.
- `output.artefactDir` is the resolved artefact directory path.
- `output.evidenceRefs` are relative paths and contain no `..` segment.
- Every returned `errors[].evidenceRef`, when present, appears in
  `output.evidenceRefs`.
- Every returned `errors[].line`, when present, is a positive integer.
- `passed` and `skipped` outputs have no errors.
- `failed` outputs have at least one error.
- `errored` outputs have at least one blocking error.
- Non-`errored` outputs have non-null canonical fields.
- `errored` outputs have `null` canonical fields only when a blocking error
  explains the unavailable field.
- The phase never writes the final canonical `output.json`; the persisted file
  always equals the harness return value.
- Root `stdout.txt` and `stderr.txt`, when phase-created, are never treated as
  trusted harness capture in v1.

---

## 7. GREEN Layer 1 Companion List

These checks are explicitly not part of the RED NIB-T suite:

- Public export existence for `runPhase`.
- Public export existence for TypeScript types.
- Direct schema shape tests that do not execute `runPhase`.
- Error-class constructor field tests.
- Test-helper self-tests.
- Constant value checks.

They may be added during GREEN Layer 1 if useful, but they must not be counted
as RED behavioral coverage.

---

## 8. Dependency Contracts Consulted by Tests

The RED test suite depends on these companion contracts:

- `DC-GIT-CLI` for Git fixture setup and observable Git-state expectations.
- `DC-ZOD` for validation failure semantics visible through `runPhase`.
- `DC-NODE-RUNTIME-FS-PATH-CRYPTO` for temp directories, symlinks, atomic output
  publication, and SHA-256 digest expectations.

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
