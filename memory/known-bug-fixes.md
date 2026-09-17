# Known Bugs and Fixes

## IDE Import Resolution Bug in Symlinked Gateways

**Description:**
When editing files through a symlinked gateway (e.g., `~/.codex/`, `~/.agents/`, `~/.pi/`), you will often see IDE TypeScript errors saying:
`Cannot find module '../../[project-name]/...' or its corresponding type declarations.`

This happens because the IDE's TypeScript language server resolves relative paths based on the gateway symlink path, which points to physical repos that aren't located where the IDE thinks they are. For example, `../../` from `~/.codex/hooks` logically resolves to `~/` instead of `~/Developper/Projects/`.

**Generic Fix:**
Do **NOT** attempt to fix this by using hardcoded absolute physical paths or dynamic `require()`.

The established and cleanest fix is to preserve pure static relative ESM imports in the code, and use the `rootDirs` compiler option in the gateway's `tsconfig.json` to merge the gateway's parent directory with the physical Projects directory.

This is required because standard TypeScript intentionally ignores the `paths` compiler option for relative module imports (imports starting with `.` or `..`). The `rootDirs` option is the correct and only way to resolve relative paths across disparate directory structures.

### Runtime (jiti / Pi Extensions)

**Description:**
Pi loads TypeScript extensions via **jiti** (ESM `import()`), which — like the IDE language server — preserves symlink paths when resolving relative imports. This causes the same resolution failure at runtime:

```
~/.pi/agent/extensions/extension.ts
  → import { ... } from "../../dotagents/..."
  → jiti résout depuis le symlink : ~/.pi/dotagents/...  ❌
```

**Runtime Fix:**
`rootDirs` ne résout que les erreurs IDE. Pour le runtime, ajuster l'import relatif pour naviguer dans la structure des gateways symlink plutôt que dans la structure physique des repos :

```typescript
// Avant (runtime error avec jiti) :
import { CommandValidator } from "../../dotagents/agent-enforcers/...";

// Après (fonctionne runtime + IDE) :
import { CommandValidator } from "../../../.agents/agent-enforcers/...";
```

Le chemin `../../../.agents/` depuis `~/.pi/agent/extensions/` atteint correctement `~/.agents/` (le gateway vers `~/Developper/Projects/dotagents/`).

Les deux fixes sont complémentaires : garder `rootDirs` dans `tsconfig.json` pour l'IDE, et ajuster les imports pour le runtime.

*Incorrect (Causes Portability Issues):*
```typescript
import { createEventSink } from "/Users/famillesendrison/Developper/Projects/telemetry-tools/event-sink/src/index.ts";
```

*Correct (Clean and Portable):*
```typescript
// In the source file:
import { createEventSink } from "../../telemetry-tools/event-sink/src/index.ts";
```
```json
// In ~/.codex/tsconfig.json:
{
  "compilerOptions": {
    // Merges ~ with ~/Developper/Projects/ so that ../../ resolves correctly
    "rootDirs": ["../", "../Developper/Projects"]
  }
}
```

## Missing Global Types (Node/Bun) in Standalone Scripts

**Description:**
When writing standalone hook scripts (e.g., in `~/.codex/hooks/` or `~/.pi/agent/extensions/`), you may see IDE TypeScript errors for global execution objects like `process`, `Buffer`, or `import.meta.main`. 

This happens because the IDE's TypeScript language server evaluates these standalone files without the full Node or Bun global type definitions loaded.

**Generic Fix:**
Do **NOT** attempt to mask these errors by sprinkling `// @ts-expect-error` or `// @ts-ignore` throughout the code.

The established and robust fix is to ensure `bun-types` is installed at the root of the physical repository and explicitly included in the `tsconfig.json`. This provides true type-safety.

*Correct Implementation:*
1. Add `bun-types` to the root `package.json` (`devDependencies`) of the physical repo.
2. Add `"types": ["bun-types"]` to the `compilerOptions` of the root `tsconfig.json`.
3. If the IDE opens the project via a gateway (e.g., `~/.codex/`), ensure `node_modules` and `package.json` are symlinked from the physical repo into the gateway, and that `~/.codex/tsconfig.json` explicitly lists `"types": ["bun-types"]`.
4. **CRITICAL:** The gateway's `tsconfig.json` MUST explicitly override the `"include"` array (e.g., `"include": ["hooks/**/*.ts"]`). Because TypeScript resolves inherited `include` paths relative to the base configuration directory, relying on the physical repo's `include` will cause the IDE to treat the gateway's files as isolated scripts, dropping the global typings and causing missing type errors (e.g., `Cannot find module 'node:fs'`).

## Git HTTPS Segfault on Legacy Darwin

**Description:**
On Darwin kernel 17, a third-party Git linked against both macOS CoreServices and an OpenSSL-backed libcurl can resolve OpenSSL symbols to the system BoringSSL image. HTTPS operations then fail intermittently or consistently with `git-remote-https died of signal 11`, commonly during `git ls-remote` or `git push`.

**Verified fix:**
For runtimes that support Git 2.17, resolve Apple toolchain Git through `xcrun --find git`, validate that it is an absolute executable reporting Git 2.17 or newer, and route all runtime Git subprocesses through it. A private, temporary `git` wrapper at the front of the runtime `PATH` preserves Git's own helper discovery while avoiding changes to unrelated command resolution. Restore `PATH` and remove the wrapper after the runtime finishes. Do not blindly retry an ambiguous failed push; first verify the exact remote destination SHA.

**Regression verification:**
Cover legacy-Darwin selection, minimum-version failure, process-level routing, and `PATH` restoration in unit tests. Also run a compiled end-to-end commit-and-push pipeline against a real local bare remote, because a plain symlink wrapper can pass `git --version` while breaking Git helper commands such as `git submodule`.

## Localized Git Diagnostics Break Typed Error Classification

**Description:**
Application logic that classifies Git failures by matching English stderr phrases such as `pathspec` or `nothing to commit` returns the wrong typed error under a non-English locale.

**Verified fix:**
After a staging or commit failure, determine planned-file existence and change state with shell-free, machine-readable Git commands rather than localized diagnostics. Use raw `git status --porcelain=v1 --ignored=matching -z` output in literal pathspec mode; for paths absent from both status and disk, use `git ls-files --cached -z` to distinguish sparse or tracked paths from nonexistent paths. Preserve NUL-delimited output without trimming and pass planned filenames to inspection and staging as argument arrays. Classifying only on the failure path avoids adding Git subprocess overhead to successful commits. Reserve human-readable stderr for diagnostics, not control flow.

**Regression verification:**
Run missing-file, nonexistent-file, and mid-loop partial-commit tests under a non-English host locale. The tests must receive the same `CommitPlanError` kinds and preserve committed-SHA context without inspecting localized text. Also cover deleted tracked files, ignored files, leading whitespace, shell metacharacters, and Git pathspec metacharacters so classification cannot reintroduce output corruption, command injection, or overbroad staging.

## Recursive Active Manifests Include Ignored Virtual Environments

**Description:**
A repository-local active-manifest generator that recursively walks the file
system can include `.venv/` dependencies even when Git ignores them. The
manifest then becomes machine-dependent, and a separate verifier may report
hundreds of unregistered environment files when its exclusion predicate differs
from the generator's.

**Verified fix:**
Exclude every path containing a `.venv` component in both manifest generation
and active-file discovery. Keep the predicates identical; excluding only the
root `.venv` leaves nested tool or fixture environments inconsistent.

**Regression verification:**
Create root and nested `.venv` markers in an isolated repository fixture,
generate the active manifest, assert neither marker is recorded, and run the
real layout verifier against that generated manifest.

## Large E2E Test Files Time Out on Slow Process-Launch Environments

**Description:**
A Node test runner may report file-level timeout failures even though every
reported subtest passes. This occurs when one test file contains many real Git
repository and subprocess scenarios whose cumulative runtime exceeds a generic
60-second file timeout on environments with high process-launch overhead.

**Verified fix:**
Keep the E2E behavior and real process boundaries intact. Set a bounded timeout
that reflects the cumulative workload of the complete file instead of reducing
property runs, mocking subprocesses, or weakening assertions. The Go stage
harness uses an eight-minute per-file bound, preserving hang detection while
allowing both process-heavy files to complete.

**Regression verification:**
Run the complete stage-harness test entry point. Both acceptance and property
files must reach their final cases with no cancellation. The verified suite
completed all 34 tests in approximately six minutes on the slow environment;
the prior 60-second limit cancelled both files before completion.

## Normative Definitions Drift Across Specification Sections

**Description:**
A normative specification can assign lexical meaning in product-intent,
invariant, implication, and synopsis sections independently. Initially
compatible definitions can then diverge silently, while ordinary traceability
checks continue to pass because stable requirement identifiers remain intact.

**Verified fix:**
Assign each defined normative concept one canonical definition anchor in an
explicit terminology registry. Keep intent, obligations, implications, and
synopses authoritative only for their own responsibilities. Track likely
non-canonical definition-like occurrences in a non-authoritative inventory with
whitespace-normalized fingerprints, and validate registry structure and
inventory freshness mechanically. Treat lexical detection as heuristic review
support, never as proof of semantic equivalence.

**Regression verification:**
Test the real specification plus isolated fixtures for competing definitions,
missing or stale inventory entries, malformed inventory data, invalid registry
tables, duplicate or misbound anchors, overloaded compound terms, and synopsis
redefinitions. Retain independent human review for semantic preservation.

## Verified Publication Leaves a Stale Remote-Tracking Ref

**Description:**
A publisher that pins one ephemeral remote and verifies the exact published SHA
can leave the ordinary remote-tracking ref stale. Pushing through an ephemeral
remote does not trigger Git's named-remote tracking-ref side effect, and an
already tracked branch never re-establishes its upstream, so `git status -sb`
keeps reporting the branch as ahead even though the remote holds the exact
published revision. The stale projection also makes a later recovery look like a
failed publication.

**Verified fix:**
After postflight verification proves the destination SHA, synchronize the
applicable local remote-tracking ref with
`git update-ref <ref> <published> <expected-old>`. Update only when the tracked
branch, destination ref, and effective fetch/push endpoint fingerprints match,
so triangular workflows and split fetch/push endpoints stay untouched; a missing
expected-old value protects a ref created concurrently. Treat local projection
failure as a separately reported outcome and never as remote push failure, and
resolve an ambiguous failed push by reading the destination back before
accepting the failure.

**Regression verification:**
Cover ordinary publication, push-only publication, already-published recovery,
concurrent and absent-ref races, triangular and split-endpoint workflows, and a
rejected push whose destination already advanced. Keep real bare-remote and
compiled-release coverage. On legacy Darwin the test cascade inherits Apple Git
2.17 through `xcrun`, so new tests must avoid commands newer than that floor:
`git branch --show-current` requires Git 2.22, and a rejected push discards its
quarantine, so a hook-based simulation must make the published object durable
before writing the destination ref.

## Mutable Runtime Settings Dirty a Symlinked Dotfiles Repository

**Description:**
A harness can persist ordinary runtime preferences, such as the selected model,
to a gateway path that is symlinked to a tracked file in a dotfiles repository.
The runtime write then dirties the repository, and a later global commit
orchestrator can create unrelated preference-only commits.

**Verified fix:**
Keep the live runtime settings file as an unversioned regular file in the
physical gateway. Track a separate bootstrap template containing only stable
configuration, ignore legacy worktree targets, and keep runtime-owned fields out
of the template. Do not patch the harness persistence behavior or hide the
tracked file with Git index flags.

**Regression verification:**
Verify that the live file is regular, local to the gateway, and mode `0600`;
that the former repository path is untracked and ignored; and that the harness's
real settings storage can write the live path without changing repository state.
Run the harness type check and complete test suite after updating gateway
documentation.

## Check Commands That Regenerate Instead of Diagnosing

**Description:**
A repository check command that regenerates a required generated artifact before
comparing it can silently recreate a missing, overwritten, or truncated
projection. The check then reports success while the committed repository state
was incomplete, so generated-artifact drift is never surfaced.

**Verified fix:**
Separate mutation from diagnosis. Expose a pure renderer mode that computes the
expected content without writing, have check mode compare the on-disk artifact
against that expected content byte-for-byte, and fail explicitly on missing,
stale, truncated, or renderer-failure conditions. Only the explicit render
command may mutate the artifact.

**Regression verification:**
Cover missing, stale, truncated, fresh, and renderer-failure cases; assert both
the reported result and exact filesystem immutability. Add a test proving the
pure renderer's stdout equals the committed artifact without touching the
filesystem.

## Parallel Validation Command Lists Drift Between Agent Instructions and CI

**Description:**
Agent instructions and CI each enumerate the validation commands to run. When
membership or order changes, one list is updated first and the other silently
keeps running a stale validation set.

**Verified fix:**
Move validation membership, order, and execution into one canonical executable
suite. Agent instructions and CI invoke that suite and do not restate its
members. The suite snapshots Git worktree status before and after execution and
fails when a validator mutates tracked, untracked, or deleted state.

**Regression verification:**
Integrity-runner tests exercise the real command-execution path: non-mutating,
tracked-file mutation, untracked-file creation, tracked-file deletion,
child-command failure, and pre-existing dirty worktree. Static audits assert
that agent instructions and CI reference the suite without enumerating its
members.

## Canonical Validation Suite Lacks a Membership Oracle

**Description:**
A repository-integrity runner that owns validation membership and order can
silently become weaker when a mandatory checker is deleted from its step list.
Tests that only exercise individual helper behavior stay green because nothing
independently asserts the suite's composition.

**Verified fix:**
Add an independent membership/order oracle that asserts the exact step names,
command paths, and sequence as a literal expected list. The oracle intentionally
duplicates expected behavior for verification; it must not derive expectations
from the production step list. The runner remains the only production owner of
membership.

**Regression verification:**
Temporarily remove a step from the production step list and confirm the
membership test fails; restore and confirm it passes. Also run the real runner
as a subprocess against fixture children that exit 7 to prove CLI failure
propagation.

## Worktree-Diff Whitespace Checks Miss Committed CI Changes

**Description:**
`git diff --check` only inspects unstaged worktree differences. On a clean CI
checkout it reports nothing even when the pushed or pull-request change range
contains committed trailing whitespace, and it also misses staged-only local
changes. Whitespace validation can therefore pass while a bad commit is
introduced.

**Verified fix:**
Use a dedicated side-effect-free checker that validates unstaged changes, staged
index changes, and the exact GitHub push or pull-request change range from the
event payload. Fail closed when CI event context is missing or malformed, and
handle all-zero push `before` revisions through the Git empty-tree diff.

**Regression verification:**
Real temporary Git repositories with real commits cover unstaged, staged-only,
committed push range, committed pull-request range, root-push range, malformed
event, and clean-range cases. A purity-guard integration test proves the checker
does not mutate the repository.

## CI Event Variables Leak Into Production-Checker Fixture Tests

**Description:**
A test that runs a real production checker inside a temporary repository fixture
inherits the host CI environment. When the checker reads GitHub event variables
such as `GITHUB_EVENT_NAME` and `GITHUB_EVENT_PATH`, the fixture validates the
real workflow run's commit range against the wrong repository and fails with an
invalid revision range. The suite passes locally and fails only in CI.

**Verified fix:**
Clear GitHub event variables from the child environment for fixture invocations
of CI-context-sensitive checkers, restoring them afterward. Keep the production
checker unchanged so its CI behavior remains fully exercised.

**Regression verification:**
Run the fixture test with `GITHUB_EVENT_NAME=push` and a real event path set in
the parent environment; the test must pass. Reproduce the failure with the
isolation removed before applying the fix.
