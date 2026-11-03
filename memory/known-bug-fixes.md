# Known Bugs and Fixes

## IDE Import Resolution Bug in Symlinked Gateways

**Description:** When editing files through a symlinked gateway (e.g.,
`~/.codex/`, `~/.agents/`, `~/.pi/`), you will often see IDE TypeScript errors
saying:
`Cannot find module '../../[project-name]/...' or its corresponding type declarations.`

This happens because the IDE's TypeScript language server resolves relative
paths based on the gateway symlink path, which points to physical repos that
aren't located where the IDE thinks they are. For example, `../../` from
`~/.codex/hooks` logically resolves to `~/` instead of `~/Developper/Projects/`.

**Generic Fix:** Do **NOT** attempt to fix this by using hardcoded absolute
physical paths or dynamic `require()`.

The established and cleanest fix is to preserve pure static relative ESM imports
in the code, and use the `rootDirs` compiler option in the gateway's
`tsconfig.json` to merge the gateway's parent directory with the physical
Projects directory.

This is required because standard TypeScript intentionally ignores the `paths`
compiler option for relative module imports (imports starting with `.` or `..`).
The `rootDirs` option is the correct and only way to resolve relative paths
across disparate directory structures.

### Runtime (jiti / Pi Extensions)

**Description:** Pi loads TypeScript extensions via **jiti** (ESM `import()`),
which — like the IDE language server — preserves symlink paths when resolving
relative imports. This causes the same resolution failure at runtime:

```text
~/.pi/agent/extensions/extension.ts
  → import { ... } from "../../dotagents/..."
  → jiti résout depuis le symlink : ~/.pi/dotagents/...  ❌
```

**Runtime Fix:** `rootDirs` ne résout que les erreurs IDE. Pour le runtime,
ajuster l'import relatif pour naviguer dans la structure des gateways symlink
plutôt que dans la structure physique des repos :

```typescript
// Avant (runtime error avec jiti) :
import { CommandValidator } from "../../dotagents/agent-enforcers/...";

// Après (fonctionne runtime + IDE) :
import { CommandValidator } from "../../../.agents/agent-enforcers/...";
```

Le chemin `../../../.agents/` depuis `~/.pi/agent/extensions/` atteint
correctement `~/.agents/` (le gateway vers `~/Developper/Projects/dotagents/`).

Les deux fixes sont complémentaires : garder `rootDirs` dans `tsconfig.json`
pour l'IDE, et ajuster les imports pour le runtime.

_Incorrect (Causes Portability Issues):_

```typescript
import { createEventSink } from "/Users/famillesendrison/Developper/Projects/telemetry-tools/event-sink/src/index.ts";
```

_Correct (Clean and Portable):_

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

**Description:** When writing standalone hook scripts (e.g., in
`~/.codex/hooks/` or `~/.pi/agent/extensions/`), you may see IDE TypeScript
errors for global execution objects like `process`, `Buffer`, or
`import.meta.main`.

This happens because the IDE's TypeScript language server evaluates these
standalone files without the full Node or Bun global type definitions loaded.

**Generic Fix:** Do **NOT** attempt to mask these errors by sprinkling
`// @ts-expect-error` or `// @ts-ignore` throughout the code.

The established and robust fix is to ensure `bun-types` is installed at the root
of the physical repository and explicitly included in the `tsconfig.json`. This
provides true type-safety.

_Correct Implementation:_

1. Add `bun-types` to the root `package.json` (`devDependencies`) of the
   physical repo.
2. Add `"types": ["bun-types"]` to the `compilerOptions` of the root
   `tsconfig.json`.
3. If the IDE opens the project via a gateway (e.g., `~/.codex/`), ensure
   `node_modules` and `package.json` are symlinked from the physical repo into
   the gateway, and that `~/.codex/tsconfig.json` explicitly lists
   `"types": ["bun-types"]`.
4. **CRITICAL:** The gateway's `tsconfig.json` MUST explicitly override the
   `"include"` array (e.g., `"include": ["hooks/**/*.ts"]`). Because TypeScript
   resolves inherited `include` paths relative to the base configuration
   directory, relying on the physical repo's `include` will cause the IDE to
   treat the gateway's files as isolated scripts, dropping the global typings
   and causing missing type errors (e.g., `Cannot find module 'node:fs'`).

## Git HTTPS Segfault on Legacy Darwin

**Description:** On Darwin kernel 17, a third-party Git linked against both
macOS CoreServices and an OpenSSL-backed libcurl can resolve OpenSSL symbols to
the system BoringSSL image. HTTPS operations then fail intermittently or
consistently with `git-remote-https died of signal 11`, commonly during
`git ls-remote` or `git push`.

**Verified fix:** For runtimes that support Git 2.17, resolve Apple toolchain
Git through `xcrun --find git`, validate that it is an absolute executable
reporting Git 2.17 or newer, and route all runtime Git subprocesses through it.
A private, temporary `git` wrapper at the front of the runtime `PATH` preserves
Git's own helper discovery while avoiding changes to unrelated command
resolution. Restore `PATH` and remove the wrapper after the runtime finishes. Do
not blindly retry an ambiguous failed push; first verify the exact remote
destination SHA.

**Regression verification:** Cover legacy-Darwin selection, minimum-version
failure, process-level routing, and `PATH` restoration in unit tests. Also run a
compiled end-to-end commit-and-push pipeline against a real local bare remote,
because a plain symlink wrapper can pass `git --version` while breaking Git
helper commands such as `git submodule`.

## Localized Git Diagnostics Break Typed Error Classification

**Description:** Application logic that classifies Git failures by matching
English stderr phrases such as `pathspec` or `nothing to commit` returns the
wrong typed error under a non-English locale.

**Verified fix:** After a staging or commit failure, determine planned-file
existence and change state with shell-free, machine-readable Git commands rather
than localized diagnostics. Use raw
`git status --porcelain=v1 --ignored=matching -z` output in literal pathspec
mode; for paths absent from both status and disk, use `git ls-files --cached -z`
to distinguish sparse or tracked paths from nonexistent paths. Preserve
NUL-delimited output without trimming and pass planned filenames to inspection
and staging as argument arrays. Classifying only on the failure path avoids
adding Git subprocess overhead to successful commits. Reserve human-readable
stderr for diagnostics, not control flow.

**Regression verification:** Run missing-file, nonexistent-file, and mid-loop
partial-commit tests under a non-English host locale. The tests must receive the
same `CommitPlanError` kinds and preserve committed-SHA context without
inspecting localized text. Also cover deleted tracked files, ignored files,
leading whitespace, shell metacharacters, and Git pathspec metacharacters so
classification cannot reintroduce output corruption, command injection, or
overbroad staging.

## Recursive Active Manifests Include Ignored Virtual Environments

**Description:** A repository-local active-manifest generator that recursively
walks the file system can include `.venv/` dependencies even when Git ignores
them. The manifest then becomes machine-dependent, and a separate verifier may
report hundreds of unregistered environment files when its exclusion predicate
differs from the generator's.

**Verified fix:** Exclude every path containing a `.venv` component in both
manifest generation and active-file discovery. Keep the predicates identical;
excluding only the root `.venv` leaves nested tool or fixture environments
inconsistent.

**Regression verification:** Create root and nested `.venv` markers in an
isolated repository fixture, generate the active manifest, assert neither marker
is recorded, and run the real layout verifier against that generated manifest.

## Large E2E Test Files Time Out on Slow Process-Launch Environments

**Description:** A Node test runner may report file-level timeout failures even
though every reported subtest passes. This occurs when one test file contains
many real Git repository and subprocess scenarios whose cumulative runtime
exceeds a generic 60-second file timeout on environments with high
process-launch overhead.

**Verified fix:** Keep the E2E behavior and real process boundaries intact. Set
a bounded timeout that reflects the cumulative workload of the complete file
instead of reducing property runs, mocking subprocesses, or weakening
assertions. The Go stage harness uses an eight-minute per-file bound, preserving
hang detection while allowing both process-heavy files to complete.

**Regression verification:** Run the complete stage-harness test entry point.
Both acceptance and property files must reach their final cases with no
cancellation. The verified suite completed all 34 tests in approximately six
minutes on the slow environment; the prior 60-second limit cancelled both files
before completion.

## Normative Definitions Drift Across Specification Sections

**Description:** A normative specification can assign lexical meaning in
product-intent, invariant, implication, and synopsis sections independently.
Initially compatible definitions can then diverge silently, while ordinary
traceability checks continue to pass because stable requirement identifiers
remain intact.

**Verified fix:** Assign each defined normative concept one canonical definition
anchor in an explicit terminology registry. Keep intent, obligations,
implications, and synopses authoritative only for their own responsibilities.
Track likely non-canonical definition-like occurrences in a non-authoritative
inventory with whitespace-normalized fingerprints, and validate registry
structure and inventory freshness mechanically. Treat lexical detection as
heuristic review support, never as proof of semantic equivalence.

**Regression verification:** Test the real specification plus isolated fixtures
for competing definitions, missing or stale inventory entries, malformed
inventory data, invalid registry tables, duplicate or misbound anchors,
overloaded compound terms, and synopsis redefinitions. Retain independent human
review for semantic preservation.

## Verified Publication Leaves a Stale Remote-Tracking Ref

**Description:** A publisher that pins one ephemeral remote and verifies the
exact published SHA can leave the ordinary remote-tracking ref stale. Pushing
through an ephemeral remote does not trigger Git's named-remote tracking-ref
side effect, and an already tracked branch never re-establishes its upstream, so
`git status -sb` keeps reporting the branch as ahead even though the remote
holds the exact published revision. The stale projection also makes a later
recovery look like a failed publication.

**Verified fix:** After postflight verification proves the destination SHA,
synchronize the applicable local remote-tracking ref with
`git update-ref <ref> <published> <expected-old>`. Update only when the tracked
branch, destination ref, and effective fetch/push endpoint fingerprints match,
so triangular workflows and split fetch/push endpoints stay untouched; a missing
expected-old value protects a ref created concurrently. Treat local projection
failure as a separately reported outcome and never as remote push failure, and
resolve an ambiguous failed push by reading the destination back before
accepting the failure.

**Regression verification:** Cover ordinary publication, push-only publication,
already-published recovery, concurrent and absent-ref races, triangular and
split-endpoint workflows, and a rejected push whose destination already
advanced. Keep real bare-remote and compiled-release coverage. On legacy Darwin
the test cascade inherits Apple Git 2.17 through `xcrun`, so new tests must
avoid commands newer than that floor: `git branch --show-current` requires Git
2.22, and a rejected push discards its quarantine, so a hook-based simulation
must make the published object durable before writing the destination ref.

## Mutable Runtime Settings Dirty a Symlinked Dotfiles Repository

**Description:** A harness can persist ordinary runtime preferences, such as the
selected model, to a gateway path that is symlinked to a tracked file in a
dotfiles repository. The runtime write then dirties the repository, and a later
global commit orchestrator can create unrelated preference-only commits.

**Verified fix:** Keep the live runtime settings file as an unversioned regular
file in the physical gateway. Track a separate bootstrap template containing
only stable configuration, ignore legacy worktree targets, and keep
runtime-owned fields out of the template. Do not patch the harness persistence
behavior or hide the tracked file with Git index flags.

**Regression verification:** Verify that the live file is regular, local to the
gateway, and mode `0600`; that the former repository path is untracked and
ignored; and that the harness's real settings storage can write the live path
without changing repository state. Run the harness type check and complete test
suite after updating gateway documentation.

## Check Commands That Regenerate Instead of Diagnosing

**Description:** A repository check command that regenerates a required
generated artifact before comparing it can silently recreate a missing,
overwritten, or truncated projection. The check then reports success while the
committed repository state was incomplete, so generated-artifact drift is never
surfaced.

**Verified fix:** Separate mutation from diagnosis. Expose a pure renderer mode
that computes the expected content without writing, have check mode compare the
on-disk artifact against that expected content byte-for-byte, and fail
explicitly on missing, stale, truncated, or renderer-failure conditions. Only
the explicit render command may mutate the artifact.

**Regression verification:** Cover missing, stale, truncated, fresh, and
renderer-failure cases; assert both the reported result and exact filesystem
immutability. Add a test proving the pure renderer's stdout equals the committed
artifact without touching the filesystem.

## Parallel Validation Command Lists Drift Between Agent Instructions and CI

**Description:** Agent instructions and CI each enumerate the validation
commands to run. When membership or order changes, one list is updated first and
the other silently keeps running a stale validation set.

**Verified fix:** Move validation membership, order, and execution into one
canonical executable suite. Agent instructions and CI invoke that suite and do
not restate its members. The suite snapshots Git worktree status before and
after execution and fails when a validator mutates tracked, untracked, or
deleted state.

**Regression verification:** Integrity-runner tests exercise the real
command-execution path: non-mutating, tracked-file mutation, untracked-file
creation, tracked-file deletion, child-command failure, and pre-existing dirty
worktree. Static audits assert that agent instructions and CI reference the
suite without enumerating its members.

## Canonical Validation Suite Lacks a Membership Oracle

**Description:** A repository-integrity runner that owns validation membership
and order can silently become weaker when a mandatory checker is deleted from
its step list. Tests that only exercise individual helper behavior stay green
because nothing independently asserts the suite's composition.

**Verified fix:** Add an independent membership/order oracle that asserts the
exact step names, command paths, and sequence as a literal expected list. The
oracle intentionally duplicates expected behavior for verification; it must not
derive expectations from the production step list. The runner remains the only
production owner of membership.

**Regression verification:** Temporarily remove a step from the production step
list and confirm the membership test fails; restore and confirm it passes. Also
run the real runner as a subprocess against fixture children that exit 7 to
prove CLI failure propagation.

## Worktree-Diff Whitespace Checks Miss Committed CI Changes

**Description:** `git diff --check` only inspects unstaged worktree differences.
On a clean CI checkout it reports nothing even when the pushed or pull-request
change range contains committed trailing whitespace, and it also misses
staged-only local changes. Whitespace validation can therefore pass while a bad
commit is introduced.

**Verified fix:** Use a dedicated side-effect-free checker that validates
unstaged changes, staged index changes, and the exact GitHub push or
pull-request change range from the event payload. Fail closed when CI event
context is missing or malformed, and handle all-zero push `before` revisions
through the Git empty-tree diff.

**Regression verification:** Real temporary Git repositories with real commits
cover unstaged, staged-only, committed push range, committed pull-request range,
root-push range, malformed event, and clean-range cases. A purity-guard
integration test proves the checker does not mutate the repository.

## CI Event Variables Leak Into Production-Checker Fixture Tests

**Description:** A test that runs a real production checker inside a temporary
repository fixture inherits the host CI environment. When the checker reads
GitHub event variables such as `GITHUB_EVENT_NAME` and `GITHUB_EVENT_PATH`, the
fixture validates the real workflow run's commit range against the wrong
repository and fails with an invalid revision range. The suite passes locally
and fails only in CI.

**Verified fix:** Clear GitHub event variables from the child environment for
fixture invocations of CI-context-sensitive checkers, restoring them afterward.
Keep the production checker unchanged so its CI behavior remains fully
exercised.

**Regression verification:** Run the fixture test with `GITHUB_EVENT_NAME=push`
and a real event path set in the parent environment; the test must pass.
Reproduce the failure with the isolation removed before applying the fix.

## Fail-Closed Branches Need Positive and Negative Oracles

**Description:** Validation tools often implement fail-closed branches for
missing, malformed, or incomplete input. Tests that prove the failure path
rejects bad input are insufficient on their own: an implementation that always
rejects every input would satisfy them while breaking the valid path. The same
gap exists in reverse when only positive tests cover a branch.

**Verified fix:** For every fail-closed branch, add both a negative oracle
proving invalid input fails and a positive oracle proving valid input succeeds.
Prove oracle sensitivity with temporary production mutations (always-fail and
fail-open variants), then restore production exactly.

**Regression verification:** Temporarily make the production branch always fail
and confirm the positive test turns RED; temporarily make it fail open and
confirm the negative tests turn RED. Restore production byte-identically and
confirm the full suite passes.

## Compound Fail-Closed Guards Need Per-Operand Oracles

**Description:** A compound fail-closed guard such as "A invalid OR B invalid"
can lose one operand's validation while the overall command still fails for a
different reason. Downstream processing of the missing operand produces an
unrelated error (for example an invalid revision range), so a test asserting
only non-empty errors or generic failure passes while the explicit fail-closed
diagnostic contract has been lost.

**Verified fix:** Test each invalid operand independently while the other
operand is present and syntactically valid, and assert the explicit validation
diagnostic rather than generic failure. A downstream error caused by a missing
operand must not be accepted as equivalent to the intended fail-closed contract.

**Regression verification:** Temporarily remove one operand's validation and
confirm the matching oracle turns RED on the missing explicit diagnostic;
restore production byte-identically and confirm the suite passes. Repeat for the
symmetric operand.

## Unrelated Event Types Still Require Common-Validation Oracles

**Description:** A validator may intentionally ignore event-specific metadata
for event types it does not dispatch on. Testing only that a clean unrelated
event passes without metadata cannot detect a regression that skips the
validations every event type must still execute.

**Verified fix:** For each unrelated event type, test both a clean case that
passes without event metadata and a violating case that must still fail through
the common checks. Assert the shared validation diagnostic, not merely a
non-empty error list.

**Regression verification:** Temporarily short-circuit the unrelated event type
to an empty result and confirm the violating oracle turns RED while the clean
oracle stays green; restore production byte-identically and confirm the suite
passes.

## Unregistered Canonical Terminology Anchors Bypass Registry-Driven Discovery

**Description:** A specification can introduce a canonical-looking
`<a id="term-..."></a>` anchor and lexical definition without adding the concept
to the canonical terminology registry. The parser discovers the anchor, but a
registry-driven occurrence checker can still ignore it if it validates only
anchors referenced by already-registered concepts. In that failure mode, both
normal validation and occurrence-list generation can pass while the new
canonical definition bypasses registry and inventory governance.

**Verified fix:** Treat the parsed `term-*` anchor namespace as closed with
respect to the canonical terminology registry. After structural anchor
discovery, compare every discovered `term-*` anchor against the registry's
canonical-anchor set and reject every orphan before occurrence/inventory
comparison. Preserve the existing converse check that every registry entry's
canonical anchor exists and binds its own definition.

**Regression verification:** Use an isolated specification fixture with a valid
canonical registry plus an unregistered `term-gamma` anchor and lexical
definition. Assert the checker API rejects it, assert the real
`--list-occurrences` CLI exits nonzero without a traceback and reports the
orphan anchor, then run the repository's complete integrity suite.

## Recovered Publication Captures Illegally Establish Non-Application

**Description:** A formal publication lifecycle can state that
`PublicationNonApplicationRef` is only direct-terminal evidence while its
orchestration and state-admission paths also accept a captured
`PROVEN-COMPLETED` recovery result. Without a provenance guard, recovery-derived
material can reach `not-applied` qualification and be retained as
non-application evidence, contradicting the direct-only contract.

**Verified fix:** Track the direct-versus-recovered source through M1
qualification, fail an attempted recovered `not-applied` result before any
publication-qualification M2 mutation, require M2 `not-applied` admission to
reference a direct `AdmitExecutionOutcomeV1`, and make snapshot integrity reject
any `PublicationNonApplicationRef` whose capture was introduced by
`AdmitExecutionRecoveryV1`. The required prior recovery-resolution mutation
remains durable.

**Regression verification:** Because this repository has no executable
implementation for these construction briefs, use an independent structural
oracle over the exact briefs. Verify that direct `not-applied` remains
admissible, recovered `confirmed` remains admissible, recovered `not-applied`
fails before publication-qualification M2 mutation, and retained
recovered-origin non-application fails snapshot integrity. Run the complete
repository-integrity suite afterward.

## Extracted Workspace Leaves Stale Migration Parity Targets

**Description:** Extracting an implementation package into a dedicated
repository can remove its files and workspace registration while leaving active
migration parity records pointing to the retired paths. Ordinary repository
tests may pass, but a fail-closed CI policy validator then reports missing green
targets.

**Verified fix:** Remove every extracted package surface from the active parity
manifest and synchronize its declared totals plus the policy validator's
expected green surface count. Keep historical narrative records unchanged when
they remain accurate descriptions of the completed migration.

**Regression verification:** Run the production policy validator against the
slimmed repository and assert that the launcher-only skill's validation-chain
test rejects any active parity path below its manifest directory. Run the
scripts test package and complete CI matrix after publication.

## Initial Commit Orchestration Assumes HEAD Exists

**Description:** A commit-and-push orchestrator can discover and validate a
newly initialized repository, then fail before creating its first commit because
`HEAD` does not yet resolve. A subsequent `git reset HEAD` has the same invalid
assumption on an unborn branch.

**Verified fix:** Represent a proven unborn pre-commit baseline explicitly, and
preserve that baseline across retries. Before treating an unresolved `HEAD` as
unborn, verify that symbolic `HEAD` names a branch with no corresponding ref.
Reset the index with `git reset --mixed`, which supports both existing and
unborn branches.

**Regression verification:** Use a real-repository publisher test and a
compiled-launcher end-to-end test. Initialize a repository without commits,
stage its first file, publish through the production pipeline to a real empty
bare remote, and verify one local commit, its exact remote SHA, upstream
establishment, and a clean worktree.

## Shell Enforcer Confuses Skill References with Executable Launches

**Description:** A harness enforcer can recognize a slash-form skill reference
with arguments as a valid Bash launch while rejecting the installed executable
whenever arguments are present. Agent-level tool interception allows the slash
text unchanged; it does not translate it into a skill invocation, so the shell
fails with `ENOENT`. The valid binary launch is treated as unrelated, which also
bypasses launch telemetry, parent-session propagation, and external-timeout
removal.

**Verified fix:** Recognize only the canonical quoted installed executable
followed by optional static shell arguments. Keep CLI argument semantics in the
invoked runtime. Reject wrappers, operators, redirection, backgrounding,
expansion, substitution, and globbing. Detect slash-form Bash input separately
and block it with an actionable canonical-executable diagnostic.

**Regression verification:** Cover global and targeted binary launches, quoted
paths with spaces, slash-form blocking, and hostile shell syntax in the shared
core. Exercise the real Pi tool handler for telemetry and parent-session
propagation, verify timeout removal, and run an isolated `HOME` shell-boundary
probe whose harmless canonical executable records the exact targeted argv.

## Private Cross-Repository Checkout Lacks an Explicit Credential

**Description:** A workflow that pins an exact revision of a different private
repository through `actions/checkout` fails before any build or test step. The
implicit `github.token` is scoped to the workflow's own repository, so the
secondary checkout reports `repository not found`. Every matrix job fails
identically, and the failure is easy to misread as a broken pinned revision
rather than a missing credential. Storing a personal access token instead would
add a long-lived secret to the consuming repository.

**Verified fix:** Publish a credential-free composite action inside the private
platform repository whose only responsibility is to expose its own downloaded
checkout path as a step output. Allow other private repositories of the same
owner to consume private actions, then reference that action by full
40-character commit SHA. The runner's ephemeral token authenticates the
download, so the consumer needs no second `actions/checkout`, no long-lived
secret, and no personal access token. Drive every dependent step from the
emitted path instead of a checked-out local directory.

**Regression verification:** A static workflow oracle asserts the full-SHA
action reference, the platform-root output wiring, the absence of any
cross-repository `repository:` checkout, and the absence of any token or secret
reference. A unit test executes the composite action's locator script under a
real `GITHUB_OUTPUT` file and asserts the exact emitted path. End-to-end proof
requires the real OS/Node matrix to reach and pass the consumer's own typecheck
and test commands; a green run confirms the private action download, the guest
token, and the gateway symlinks together.

## Tracked Absolute Symlink Target Makes a Repository Unconsumable

**Description:** A repository that tracks a symbolic link whose target is an
absolute path in a different user's home directory cannot be materialized by
consumers. GitHub's private-action downloader, which must create every tracked
entry, aborts with `Could not find file '<staging>/<repo>-<sha>/<link path>'`
and fails the whole job during setup. The committed tree looks valid on the
author's machine because the absolute target happens to exist there, so the
defect surfaces only for consumers, and it blocks every use of the repository as
a dependency, action, or package source.

**Verified fix:** Remove the tracked absolute symlink. The directory it pointed
at already existed at the link's own location, and no repository file referenced
the link, so the removal changed no behavior. Any tracked symlink whose target
escapes the repository is either removable or must become a relative link that
resolves inside the checkout.

**Regression verification:** Enumerate tracked symlink entries with
`git ls-files --stage` and assert that no entry with mode `120000` has an
absolute target, skipping paths currently deleted in the worktree so that a
pending removal does not mask the check. The test must fail against the
offending commit and pass after removal, and the real consumer workflow must
complete its download step.

## Immutable Historical Resume Paths Bypass Current Runtime Guards

**Description:** A durable workflow resume command can contain the absolute
orchestrator path of the release that created the run. Adding a safety guard
only to the current release does not protect historical suspended runs: their
old commands continue to load immutable old code and can reach Git or
delegated-result processing without executing the new guard. Deleting historical
releases is not safe when compatible exact-scope runs still have legitimate
resume authority.

**Verified fix:** During an explicitly confirmed offline window, inspect the
authoritative run state, reject live ownership and ambiguous paths, checkpoint
only abandoned SQLite WAL state, and classify each historical scope. Atomically
rename every global or missing-scope run to a same-filesystem quarantine, then
occupy its canonical run path with a versioned regular-file tombstone. Preserve
worktree and targeted runs at their canonical paths and keep every historical
release immutable. Make the operation idempotent and recover the crash interval
between the quarantine rename and tombstone publication.

**Regression verification:** Create a suspended global run with delegation
results capable of reaching the mutation phase, capture its historical resume
entrypoint, apply the cutover, and replay that entrypoint exactly. Require a
pre-application `state_missing` error, zero executed phases, no Git or LLM
invocation, and content-identical target repositories. Exercise real historical
workflow-runtime generations, SQLite authority over stale projections, abandoned
WAL checkpointing, hostile paths, crash recovery, repeated apply, and
preservation of exact-scope runs.

## URL Preflight Validation Does Not Prevent DNS Rebinding

**Description:** A remote-resource loader can resolve a hostname, reject private
addresses, and then pass the original hostname to a networking library. If that
library resolves the hostname again, an attacker-controlled DNS server can
return a public address during validation and a loopback or private address
during the connection. Revalidating the final URL occurs after the forbidden
request.

**Verified fix:** Resolve each request target once, reject the complete address
set if any address is non-public, connect directly to one validated numeric
address, and preserve the original hostname only for the HTTP Host header and
TLS SNI. Verify the actual connected peer before sending the request. Repeat the
process for every redirect target and bypass ambient HTTP proxy configuration.

**Regression verification:** Use an alternating resolver with a real loopback
HTTP service. Return an accepted address during validation and the loopback
service on a hypothetical second hostname lookup. Assert exactly one hostname
resolution, a failed fetch, and zero requests received by the private service.

## Socket Inactivity Timeouts Are Not Total Download Deadlines

**Description:** A socket timeout usually limits one idle operation. A server
that sends one byte before each inactivity timeout can keep a bounded download
alive indefinitely, contradicting a documented total request timeout and
retaining a worker thread.

**Verified fix:** Create one monotonic deadline for DNS resolution, connection,
TLS, headers, and body transfer. Derive every operation's remaining timeout from
that deadline and arm a deadline watchdog that shuts down the active socket,
interrupting header or body reads that internally perform multiple receive
operations.

**Regression verification:** Run a real HTTP service that advertises an image
and trickles bytes faster than the inactivity timeout. Assert that the client
raises its typed total-timeout error near the configured deadline rather than
returning the complete body.

## Dominant-Color Geometry Detection Accepts Blank Images

**Description:** A grid detector that uses only dominant-color coverage and
expected aspect ratio can assign near-perfect confidence to a blank image with
the target ratio. It then invents cell boundaries without any independent
evidence that grid lines exist.

**Verified fix:** Keep coverage and aspect checks, but require an independent
structural signal at every expected boundary. Aggregate robust
line-to-background contrast and fail closed when the median grid-line evidence
is below a calibrated threshold.

**Regression verification:** Test both sides of the confidence gate: a blank
target-ratio image must fail, and a real calibrated screenshot must retain the
expected dimensions, occupied cells, and minimum confidence.

## Loopback Binding and Request Validation Use Different Predicates

**Description:** A local server can accept any address classified as loopback
while its Host or Origin checks allow only a few literal spellings. Expanded
IPv6 loopback forms or another valid local alias then bind successfully but
receive only HTTP 403 responses from the same process.

**Verified fix:** Use one canonical loopback predicate for binding, Host
validation, and Origin validation. Parse literals with the platform IP-address
library instead of maintaining a second string allowlist.

**Regression verification:** Bind the real server to an expanded IPv6 loopback
address and fetch its static interface through that exact spelling. Require HTTP
200, while retaining a negative test that rejects a non-loopback bind address.

## Late Browser Responses Overwrite Newer Input State

**Description:** A browser application can snapshot inputs, start asynchronous
recognition or optimization, and then apply the response after the user changes
those inputs. Hiding an old result on change is insufficient because the late
response can make it visible again or overwrite the newer board. Independent
action buttons can also start conflicting operations on different snapshots.

**Verified fix:** Advance a monotonic input revision whenever an effective input
changes. Capture the revision at request start and discard responses from older
revisions, including errors. Hide invalidated output, report superseded work,
make conflicting long-running actions mutually exclusive, and reject or clear
competing input sources instead of assigning silent precedence.

**Regression verification:** Unit-test revision invalidation, stale-request
detection, action-button mutual exclusion, and exclusive source selection.
Exercise the served scripts through the real static routes and retain syntax
checks for the browser controller.

## Wrapper Return-Code Checks Erase Tri-State Diagnostics

**Description:** A local validation wrapper can consume a substrate that maps
specific nonzero exit codes to `UNDETERMINED`, then inspect the raw return code
before the typed status. The overall validation remains fail-closed, but the
wrapper reports the observation as a generic failure and loses the tri-state
diagnostic promised by the substrate.

**Verified fix:** Classify each obligation by its typed status before applying
generic nonzero-return handling. Preserve `UNDETERMINED` in the local diagnostic
and exclude it from the ordinary failed-step collection, while retaining a
non-passing wrapper exit. Process remaining nonzero violated obligations through
the existing failure path.

**Regression verification:** Use a real temporary Git repository and child
process exiting with an exit code configured as undetermined. Assert directly
that the wrapper returns no failed-step entry and emits the undetermined
diagnostic. Also execute the real wrapper CLI across the process boundary and
assert that it remains non-passing, reports `undetermined`, and never reports
the same obligation as `failed`.

## GitHub Issue Body Patch Leaves an Orphaned Markdown Fence

**Description:** A narrowly targeted GitHub Issue body replacement can leave a
closing Markdown fence between the end of one section and the next heading.
GitHub stores the body successfully, but the rendered contract contains an
orphaned fence and the section boundary is malformed.

**Verified fix:** Fetch the current body, replace the exact malformed sequence
with the same prose followed by a blank line and the next heading, then compare
the API readback byte-for-byte with the intended body. Do not rewrite unrelated
sections, comments, Project fields, or relationships.

**Regression verification:** Fetch the body through the GitHub API and assert
that the affected section does not end with a code fence, the next heading is
preceded by a blank line, and the API readback matches the submitted body
exactly.

## Python urllib Does Not Use the Platform Trust Store

**Description:** A Python provider using `urllib.request.urlopen` can fail TLS
certificate verification even when DNS, TCP, curl, and an authenticated provider
CLI all reach the same HTTPS endpoint successfully. The provider then reports a
network or timeout result, making a fail-closed live conformance check remain
undetermined. Python's default SSL context may use a CA source that differs from
the operating system trust store.

**Verified fix:** Add an exact `truststore` dependency and pass a request-local
`truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)` to `urlopen`. Keep certificate
and hostname verification enabled, do not mutate global SSL state, and classify
direct or `URLError`-wrapped `SSLCertVerificationError` failures separately from
ordinary network and timeout failures.

**Regression verification:** Test the exact context passed to `urlopen`, direct
and wrapped certificate-verification failures, unchanged timeout/network/HTTP
classification, and the absence of global SSL injection or verification bypass.
Run the provider against the real public endpoint and require the consumer's
complete fail-closed integrity suite to report a determined satisfied result.

## Python HTTPS Validation Fails When the Default CA Bundle Is Missing

**Description:** A Python `urllib` provider check can report a generic network
or timeout failure even though DNS and the remote API are healthy. The wrapped
cause is `SSLCertVerificationError`, the active default SSL context contains no
certificate authorities, and the interpreter's expected `cert.pem` is absent.
`pip install` may still work because pip carries a separate vendored CA bundle.

**Verified fix:** Run the certificate-installation command supplied by the
active Python distribution. For the python.org macOS distribution, this is
`Install Certificates.command`; it installs or updates `certifi` and binds the
interpreter's default OpenSSL CA path to that maintained bundle. Do not disable
TLS verification or treat a pip download as proof that standard-library HTTPS
trust is configured.

**Alternative verification:** Require the default SSL context to load a
non-empty CA set, call the affected HTTPS checker without environment overrides,
and run the complete canonical validation suite. Confirm independently that the
same API endpoint is reachable and returns the expected provider data.

## Mechanical Construction Synchronization Invents Derived Dependency Authority

**Description:** A mechanical construction synchronization can choose an
unapproved compatibility/version bump, copy selected dependency facts into a
non-authoritative construction plan, and rewrite a downstream dependency Issue
without preserving the exact execution-identity contract.

**Verified fix:** Apply the explicitly authorized SemVer transition and
synchronize every consumer. Keep the active System Brief as the canonical owner
of selected dependency facts; make construction plans reference that owner
without manually copying mutable package, revision, runtime, or Issue facts.
Preserve the exact downstream execution mapping, including runner Execution,
protocol attempt, cognitive-call identity, direct invocation, provider attempts,
and the distinction between call identity and provider response identity.

**Regression verification:** Assert the exact published versions and consumer
references, assert that the construction plan contains no selected dependency
identity or live Issue reference, and inspect the downstream Issue body for the
complete identity mapping and `call_id != provider response identity`. Run the
canonical repository-integrity suite and verify unrelated Project fields and
native relationships remain unchanged.

## Canonical JSON Value Artifacts Are Rejected as Documents

**Description:** A checker can reuse a canonical JSON document loader for an
artifact whose construction contract requires canonical JSON value bytes. The
semantic JSON is identical, but the loader incorrectly requires one trailing
newline and rejects the valid no-newline artifact.

**Verified fix:** Keep document and value serialization explicit. Preserve the
existing document loader for artifact classes that require a trailing newline,
and use a dedicated value loader for the no-newline artifact class. Do not
canonicalize raw producer output.

**Regression verification:** Prove both sides of the byte boundary: canonical
value bytes without a newline must pass end to end, while the same semantic JSON
with exactly one trailing newline must fail with the value-serialization
diagnostic. Retain packet tests proving document serialization still requires
its newline.

## Late Lifecycle Events Read Invalidated Pi Extension Contexts

**Description:** A session replacement or reload can invalidate an extension
context while an old-runtime lifecycle event such as `agent_settled` remains
queued. A handler that reads `ctx` before checking its shutdown state then throws
Pi's stale-context error even though no post-shutdown work remains.

**Verified fix:** Clear an extension-local activity sentinel during
`session_shutdown`. In potentially late handlers, check that local sentinel
before any `ctx` access and return immediately when the extension is inactive.
Do not catch or suppress the stale-context error, and do not retain the old
context for post-replacement work.

**Regression verification:** Run each real extension handler through
`session_shutdown` with an active context, then dispatch `agent_settled` with a
context proxy that throws on every property read. The late event must complete
without reading the proxy, while the existing active-settlement tests continue
to verify normal completion and refresh behavior.

## Immutable Validation Oracles Are Recomputed for Every Fixture

**Description:** A large validation test suite can call one complete checker for
hundreds of isolated fixtures while the checker embeds expensive immutable
self-conformance oracles. Parsing caches do not address this cost: every fixture
recomputes the same semantic corpus, and nested identity resolution may also
rebuild the same admission index repeatedly. One test file can consequently run
for hours even though no individual test is blocked.

**Verified fix:** Cache immutable oracle results process-locally by the exact
bytes of every dependency actually read and by the oracle implementation
identity. Never cache when a dependency is missing, unreadable, non-regular, or
reached through a symlink. Preserve dynamic manifest and evidence validation
outside the cache. Cache derived indexes only against an exact deep snapshot of
their authoritative source state, so direct mutations invalidate them. Build
committed Git fixtures once and materialize isolated linked worktrees, and reuse
preloaded generic governance only when the fixture's complete governance corpus
is byte-identical.

**Regression verification:** Prove cache hits on identical content, invalidation
on content changes and direct state mutation, preservation of cached errors,
and fail-closed behavior for missing, recursive, or symlinked dependencies.
Retain end-to-end tests that mutate protocol artifacts and governance routes,
then run the complete canonical integrity suite and compare wall-clock time with
the reproduced baseline.

## Git Line Framing Removal Strips Valid Path Bytes

**Description:** A Git command that emits a filesystem path followed by one LF
framing delimiter can return a path whose own final character is CR, LF, ASCII
space, or TAB. Applying `strip()`, `rstrip()`, `splitlines()`, or CRLF-wide
normalization removes valid path bytes and can reject an exact worktree root.

**Verified fix:** Require the output to end in LF, remove exactly that one final
byte, and decode or compare every preceding byte unchanged. Treat missing final
LF as malformed output and fail through the controlled error boundary. Do not
reconstruct or normalize the path.

**Regression verification:** Create real committed Git worktrees ending in CR,
LF, ASCII space, and TAB. Assert `git rev-parse --show-toplevel` returns the
byte-exact path plus one LF, exact-root validation succeeds, and nested-root
validation fails. Add a separate mocked no-final-LF response to prove malformed
framing fails closed.

## Append-Only Archive Tests Hardcode the Former Latest Entry

**Description:** Tests for an append-only report archive can hardcode the latest
report ID, observation window, and predecessor. The suite passes until the next
valid report is published, then positive fixtures target stale continuity and
fail despite correct production behavior.

**Verified fix:** Discover the latest archive through the production history
index, derive the synthetic candidate's predecessor and period start from that
entry, and generate a strictly later fixture identity. Keep stable historical
IDs only where a test intentionally targets immutability of that exact entry.

**Regression verification:** Publish or fixture an additional valid archive
entry, then run the complete suite. History-index tests must identify the new
last entry, positive continuity fixtures must follow it, and negative missing-
actor and cursor-advance oracles must remain failing for their intended reasons.

## Root-Only Administrative Guards Miss Resolved Nested Boundaries

**Description:** A filesystem observation guard can reserve an administrative
entry name at every lexical path depth while physically protecting only the
repository root's instance. On a case-insensitive filesystem, a nested
case-variant path can then enter a nested administrative directory. A symlink
into a sibling nested administrative subtree can bypass the guard on every
filesystem.

**Verified fix:** Walk only the current capability-resolved candidate ancestry.
At each participating parent, enumerate directory entries and require exact
native-name equality before opening the protected administrative entry. Apply
the existing platform identity classifier to that entry. Do not case-fold,
infer generic aliases, scan the worktree recursively, or treat the containing
directory as a discovered nested repository.

**Regression verification:** On case-insensitive hosts, reject mixed-case paths
that physically enter a nested exact administrative entry. On case-sensitive
hosts, prove a distinct stored case variant remains observable and
content-sensitive. On Unix, reject a tracked symlink into a sibling nested
administrative subtree before absent-path handling. Include native Windows
runtime tests for nested directory-form and file-form administrative aliases.

## Process Observation Failures Masquerade as Process Absence

**Description:** Process supervision can translate a failed or malformed `ps`
observation into `None` or an empty member list. Termination then reports success
while an owned process or descendant may still be alive. Separately, comparing
raw `lstart` text can reject the same process because day-of-month padding or
other whitespace differs between process-table queries.

**Verified fix:** Distinguish proven `ESRCH` absence from indeterminate
observation. Use one bounded, locale-fixed process-table adapter; reject launch,
timeout, nonzero-exit, empty-table, and malformed-row outcomes with a typed
ownership error. Normalize every observed and expected birth identity by
compressing whitespace before exact comparison, without rewriting durable
receipts. Never signal after identity observation becomes indeterminate.

**Regression verification:** Inject process-probe and process-table outcomes
through the real supervisor module. Cover live-process failures, `EPERM`, initial
and concurrent `ESRCH`, malformed global rows, zombies with active descendants,
zero signals after unknown identity, padded one-digit dates, exact date/time
mismatches, legacy receipt compatibility, TERM-to-KILL escalation, and
controller resume with unchanged state and no second launch.

**Follow-up — PID/PGID reuse:** Treat a valid numeric process group as
insufficient ownership evidence. Ignore malformed birth/state details only for
rows whose strict PID and PGID prove they are outside the target group, and
permit at most one complete retry of a targeted `malformed-response`. Never
signal from reconciliation after the receipt-bound leader is absent. Restrict
termination to a living supervisor that still owns the unreaped child
lifecycle, and never let a generic command runner signal a group after the root
process has emitted `exit`.

**Follow-up verification:** Cover leaderless PGID reuse, reuse after valid entry,
new members between TERM and KILL, chained transient observations, zero
reconciliation signals, living-supervisor cleanup, and root-exited descendants
that remain alive until explicitly cleaned by their test owner.

## Moving a Runtime Directory Splits Locks and Embedded Path State

**Description:** Renaming an application runtime directory can appear atomic
while leaving multiple non-atomic identities behind. Configuration, virtual
environments, Git linked-worktree pointers, scheduler material, durable state,
and lock paths may retain the old absolute root. A process that loaded the old
configuration before the rename can recreate the source and acquire a distinct
lock, while a crash during pointer or configuration repair can wedge every
retry.

**Verified fix:** Hold a stable POSIX gate outside both roots before loading
configuration, then acquire the ordinary state lock. Validate physical paths,
terminal state, scheduler absence, same-filesystem layout, and exact
configuration bytes before mutation. Hide configuration behind a durable
transaction barrier, use atomic no-replace root rename, rebase only exact known
defaults, recreate the venv, and repair only one-to-one qualified Git pointer
bindings. Keep pointer staging outside worktrees, bind it to a durable sidecar,
and publish pointer changes with atomic exchange plus post-exchange byte/mode
validation and rollback. Rebase historical operational paths only in memory;
do not rewrite receipts, sessions, states, logs, or evidence.

**Regression verification:** Exercise source/target collisions, symlink and
symlink-before-`..` aliases, lock loss, every rename/config/pointer/staging crash
boundary, short writes, mode changes under restrictive umask, internal and
external repositories, unrelated worktrees, ownership-marker files, partial
venvs, malformed durable state, explicit and empty overrides, and hard process
termination. After a real migration, compare an immutable byte manifest,
require all linked worktrees to resolve at the new root, prove no legacy venv
paths, rerun the full suite with default configuration, and confirm scheduler
state is unchanged.

## Windows Symlinks Retain Unusable Portable Separators

**Description:** Windows may successfully create a relative symbolic link from
a forward-slash path such as `../sibling/file`, and `read_link()` may return that
exact target, while dereference and canonicalization fail with
`ERROR_INVALID_NAME` (OS error 123). A separate check of the target file can
therefore pass even though reading through the actual link fails.

**Verified fix:** At the Windows-only filesystem transport boundary, replace
portable `/` separators with `MAIN_SEPARATOR_STR` before passing the target to
`symlink_file` or `symlink_dir`. Keep the declared portable path unchanged and
do not canonicalize, trim, case-fold, normalize Unicode, eliminate components,
follow the link, or precheck target existence.

**Regression verification:** On native Windows, use the real symlink creation
adapter to create a relative link to a sibling carrier. Require symlink metadata,
canonicalization, dereference, byte equality with the carrier, and preservation
of exact content bytes. Retain an Ubuntu comparison and any higher-level test
whose expected stage depends on successfully reading through the link.

## Reloading a Published Harness Fix Uses the Stale Local Checkout

**Description:** A harness fix can be published and verified on the remote while
the persistent local checkout remains behind because unrelated modifications
make automatic fast-forward reconciliation unsafe. Reloading a harness session
then reloads the stale local extension rather than the published revision, so
old behavior remains visible. Each running session also owns its loaded
extension instance and must reload independently.

**Verified fix:** Never overwrite, stash, or commit the unrelated checkout state.
Use the runtime's exact resource exclusion and local-extension inclusion
mechanisms to disable the stale auto-discovered extension and load an immutable
projection of the verified published commit. Preserve the gateway directory
shape and dependency symlinks required by relative imports. Verify the projected
blob identities against Git. Remove the override after the persistent checkout
can be safely fast-forwarded, then reload every active session.

**Regression verification:** Resolve resources through the production package
manager and require exactly one enabled instance of the affected extension, with
the stale auto-discovered path disabled. Load that enabled module through the
production TypeScript loader and exercise its real handler: high-risk commands
must not open a confirmation, critical commands must remain blocked, restricted
modification tools must still require authorization, and telemetry must retain
the expected severity and final action.

## Better-SQLite3 PRAGMA Reads Inherit Default Safe Integers

**Description:** After `Database#defaultSafeIntegers(true)`, integer-valued
`Database#pragma(..., { simple: true })` reads return JavaScript `bigint`
values. Exact comparisons against number literals therefore fail even though
the values are numerically equivalent. Text-valued PRAGMAs such as
`journal_mode` remain strings.

**Verified fix:** Compare integer PRAGMA results with exact bigint literals such
as `1n`, `2n`, `5000n`, and `0n`, while comparing `journal_mode` with its exact
string. Do not disable safe-integer mode for PRAGMA verification or infer the
effective setting from SQL text, messages, or logs. This follows from
`Database#pragma` creating an internal statement that inherits the database's
default safe-integer mode.

**Alternative verification:** When the authorized scope cannot add executable
tests, reproduce the behavior against the exact selected Better-SQLite3,
bundled SQLite, and Node versions. Verify every effective connection profile
with scalar PRAGMA reads, audit that only an explicitly rejected anti-example
uses number literals, and run the repository's complete integrity suite.

## Credential Lock Permission Does Not Authorize Credential Persistence

**Description:** A macOS sandbox can permit an OAuth credential store's lock
directory while still denying the store's direct write to the credential file.
Lock acquisition then succeeds, but refresh persistence fails with `EPERM`; a
successful read-only auth check does not detect the missing write capability.

**Verified fix:** Preserve the existing lock-directory exceptions and add an
exception for only the literal credential-file path. Do not authorize its
parent, a `subpath`, wildcard, temporary file, backup, adjacent JSON file, or
other account configuration. Confirm first that the installed store writes the
live file directly and does not use rename or temporary-file publication.

**Regression verification:** Generate the production profile under a fixture
`HOME` and use the real platform sandbox with inert credentials. Prove existing
file persistence, exact-file creation, lock operations, and fresh-process
readback. Independently require `EACCES` or `EPERM` for pre-existing neighbours,
an absent new neighbour, and sensitive reads, including a home path with spaces
and quotes. Provider refresh remains a separate live qualification.

## Prepared State Rejects a Product Observation Missing Its Internal Baseline

**Description:** A controller can observe only external product revisions, pass
that object unchanged through execution-context construction, and then fail when
persisting a prepared run because durable-state validation also requires the
exact internal attempt baseline. Unit tests can miss the production mismatch by
injecting an already-complete product object.

**Verified fix:** Keep external product observation responsible only for the
external repositories. At the context boundary that owns the attempt baseline,
reject any supplied own `internal` property that differs from that baseline and
return a fresh product object with `internal` bound to the exact attempt
baseline. Do not weaken durable-state validation or re-observe the controller's
current internal `HEAD`.

**Regression verification:** Use real temporary Git repositories and Git
`url.insteadOf` redirects in an isolated child process. Exercise the complete
observation-to-context-to-preparation-to-state path, interrupted preparation and
resume, contradictory supplied values, an internal main that advances beyond a
detached attempt baseline, and byte-preserving rejection by the unchanged state
validator.

## Resolving a Virtual-Environment Launcher Drops Its Environment Identity

**Description:** A process controller can accept an absolute virtual-environment
Python launcher and call `Path.resolve()` before execution. Because the launcher
is normally a symlink to the base interpreter, the resolved executable starts
without the virtual environment's prefix and site packages. A child that should
enter standby can instead fail during import with `ModuleNotFoundError`.

**Verified fix:** Preserve and execute the validated absolute launcher path
lexically. Resolve it only into a separately labeled diagnostic value; never use
the resolved target as the executable. Continue validating that the supplied
launcher exists and is absolute.

**Regression verification:** Execute the lexical launcher in a child process and
require both virtual-environment identity and import of an environment-only
dependency. Reproduce that the resolved target lacks that dependency, then run
the real controller and require its reported launcher path to remain lexical
through successful child standby and completion.

## Rejected Candidate Retries Lose the Controller Diagnostic

**Description:** A durable workflow can preserve a rejected candidate for a new
author attempt while omitting the validator's exact diagnostic from the rebuilt
execution context. The author sees the old candidate but not the reason it was
rejected, so a normal retry can repeat semantic continuity errors.

**Verified fix:** At the context boundary, include a non-empty prior controller
diagnostic only when a preserved candidate is actually available. Serialize the
diagnostic as one JSON string, label it explicitly as untrusted data, and pass
it through both fresh attempt preparation and prepared-prompt reconstruction.
Do not persist a second diagnostic field, truncate the text, weaken validators,
or reset retry counters and author budgets.

**Regression verification:** Use real temporary Git repositories, a byte copy
of the real archive, the real state store, and candidate fixture files. Cover
multiline and instruction-like diagnostics, preparation with and without a
candidate, interruption and resume, prompt reconstruction, exact identity and
budget preservation, and byte-identical original prompt and validators.

## Evidence Digests Fail on Mixed Runtime Object Graphs

**Description:** An external qualification harness can hash a genuine runtime
object graph with plain `json.dumps`. The graph may contain validators, tuple
mapping keys, sets, bytes, or other non-JSON runtime values even when its domain
data is JSON-compatible, causing evidence construction to fail only after an
expensive genuine execution. A `default=` callback handles unsupported values
but does not handle unsupported mapping keys.

**Verified fix:** Keep domain serialization and observational evidence hashing
separate. For evidence-only graph comparisons, recursively project mappings to
sorted key/value entry sequences, preserve JSON values, encode bytes and
containers deterministically, and represent every remaining non-JSON leaf by a
fully qualified type token. Never include `repr` output that may contain
process-specific addresses. Do not use this projection as a product identity or
canonical domain serialization.

**Regression verification:** Hash two independently allocated instances of the
same non-JSON runtime type under equal tuple-keyed mappings and require equal
digests, then execute the genuine end-to-end evidence path containing the real
runtime objects.

## Lowercase Parameter Expansion Fails on macOS Bash 3.2

**Description:** A shell loop can use Bash 4's `${name,,}` expansion to derive a
lowercase output filename. The default Bash on supported legacy macOS is 3.2,
which exits with `bad substitution` before running the enclosed command and can
leave an orchestration sequence partially applied.

**Verified fix:** Use explicit static output filenames for a fixed operation set,
or perform case conversion through a portable external operation when inputs are
genuinely dynamic. Do not depend on Bash 4-only parameter transformations in
macOS orchestration commands.

**Regression verification:** Execute the real command sequence with the platform
`/bin/bash`, require every expected output receipt, and verify the resulting
remote state independently after a reproduced partial attempt.

## Qualification Harness Assigns a Witness to the Wrong Validation Owner

**Description:** A qualification harness can require one target oracle to reject
a mutation whose actual purpose is to prove dependency invalidation. A
semantics-neutral metadata change may correctly leave that oracle green while
adjacent exact-artifact validators fail closed, causing the harness to report a
false evidence failure.

**Verified fix:** Classify the witness by its source-owned responsibility before
evaluating it. Preserve the target oracle's genuine unchanged result, require
the exact fail-closed diagnostics from the boundaries that own byte identity,
and keep cross-boundary coverage substitution `UNDETERMINED` unless separately
proved. Never rerun an exhausted witness merely to repair its classification.

**Regression verification:** Apply a genuine dependency-content mutation that
preserves schema semantics. Require the semantic oracle to remain green, the
actual exact-artifact owners to emit their diagnostics, and the pure evidence
classifier to accept both facts while preserving the original raw run.

## Regex Backtracking Broadens a Malformed Structured Prefix

**Description:** A regex that recognizes a hierarchical token with optional
segments and then asserts a word boundary can backtrack after the longest token
fails its boundary. A malformed value such as `2.2Afoo` may therefore be
accepted as ancestor `2` when the intervening dot satisfies the boundary,
turning malformed input into broader authority.

**Verified fix:** Parse the maximal structured candidate deterministically with
ASCII-specific grammar, validate the scalar immediately following that complete
candidate, and reject the complete candidate when the continuation is
alphanumeric or underscore. Never retry or reinterpret an ancestor prefix.

**Regression verification:** Cover valid bare, dotted, and terminal-uppercase
forms; punctuation boundaries; malformed alphanumeric and underscore suffixes;
Unicode alphanumeric suffixes; and non-ASCII digits. Also exercise the real
downstream authorization or hierarchy check so malformed input cannot pass by
resolving to an ancestor.

## Unobserved Fixture Rejections Leave Polling Tests Unbounded

**Description:** A concurrency test can start an asynchronous fixture, poll a
boolean until its callback enters, and observe the fixture promise only after
that loop. If acquisition rejects before entry, the rejection is initially
unobserved and the loop has no terminal condition. The test reports an
unhandled rejection and can retain helper operations until an external timeout.

**Verified fix:** Attach fulfilled and rejected outcome handlers immediately
when creating the first fixture promise. Race callback entry against that
non-rejecting outcome, bound entry and final settlement independently, and
release the held callback in `finally`. Preserve the primary operation error;
when a distinct settlement error also occurs, report both without duplicating
the same error object. Never remove fixture state after settlement becomes
undetermined.

**Regression verification:** Inject an acquisition rejection under strict
unhandled-rejection handling and require bounded propagation of the identical
error before the concurrent operation starts. Also cover synchronous failure,
completion before entry, successful entry and release, operation failure,
entry timeout, settlement timeout, combined primary and settlement errors, and
the real lock-exclusion scenario followed by successful reacquisition.

## Test Mutations Become No-Ops Under Restrictive Umasks

**Description:** A filesystem race or integrity test can apply a fixed mode with
`chmod` and assume that this changed the fixture. Under a restrictive umask, the
fixture may already have that mode, so the injected mutation is a no-op and an
expected fail-closed rejection never occurs.

**Verified fix:** Set the fixture's precondition explicitly to a known distinct
mode, read it back before starting the operation, then inject the target mode.
Keep the original rejection and post-failure preservation assertions. Do not
change production validation merely because an environment-dependent fixture
failed to establish its intended mutation.

**Regression verification:** Execute the real fixture test under a restrictive
umask that would otherwise create the file at the target mode. Require the
explicit initial-mode assertion, the injected distinct mode, the expected
migration rejection, and preservation of the changed mode and transaction.
Run the complete owning test file and broader targeted suite under that umask.

## Relative Tool Paths Break After a Subprocess Working-Directory Change

**Description:** A wrapper can validate a relative packet path successfully,
then launch a subprocess with that packet as its working directory while still
passing packet-derived relative paths as command arguments. Those arguments are
resolved again from the new working directory, so an existing schema or output
path becomes a nonexistent nested path and the tool fails before execution.

**Verified fix:** Reject symlinked execution inputs, resolve the packet and
program paths to strict absolute paths before validation or changing the child
working directory, and derive every subprocess artifact path from the resolved
packet root. Validate required input artifacts before starting the subprocess.

**Regression verification:** Invoke the real wrapper with relative packet and
program paths and a real subprocess fixture that checks the schema path from its
actual working directory. Require the subprocess to observe an existing
absolute schema path and an absolute output path rooted in the intended packet.

## Nested Routing Coordinates Retain an Already-Supplied Mapping Prefix

**Description:** A model loader can select a nested routing mapping, then pass
that mapping to a generic resolver while also prefixing the route with the
mapping's parent key. Resolution still reaches the expected target when the
loader instead supplies the full document, but the retained route tuple uses a
different coordinate basis from conforming implementations.

**Verified fix:** Pass the selected nested mapping as the resolver input and
construct route segments relative to that mapping. Do not strip or normalize a
prefix after resolution, because that conceals the value retained by the
resolver rather than correcting its input coordinates.

**Regression verification:** Use one shared multi-route fixture whose oracle
observes each resolver result's retained route, declared path, and relative
target directly in independent implementations. Preserve the old observation
shape by default, reject non-boolean observation controls, and confront the
result against a real consumer containing every required route.

## Optional JSON Schema Formats Silently Accept Invalid Values

**Description:** A JSON Schema validator can receive a `FormatChecker` while the
optional implementation for a declared format is absent. The checker then treats
unknown formats as conforming, so invalid date-time strings pass schema-only and
full validation. Permissive JavaScript date conversion can independently turn
invalid strings into `NaN`, causing every ordered comparison to evaluate false.

**Verified fix:** Install the maintained format extra at an exact validator
version, then qualify one checker instance by verifying registration and both
positive and negative functional probes before any validation mode can report
success. In runtime comparisons, validate the complete lexical and Gregorian
calendar form first, require a finite conversion, and compare nullable values
against `null` explicitly rather than through truthiness.

**Regression verification:** In isolated subprocesses, replace the checker with
both an unregistered implementation and one that accepts every value; require a
stable environment error and no valid result in every mode. Independently test
every schema date-time field and runtime receipt timestamp, impossible calendar
values, missing timezones, offsets, lowercase T/Z, nullable fields, and epoch
zero. Retain a syntactically valid out-of-window case to prove chronology checks
remain active after instant validation.

## Protocol Deadlines Become Flaky When Coupled to Real Transport Latency

**Description:** A test can configure a production protocol client with a very
short deterministic request deadline while also spawning a real process and
using native pipes. Under load, initialization or response transport may exceed
the deadline before the intended protocol response is classified. The test then
reports a timeout instead of the malformed or valid response it was meant to
verify, and the timeout stack alone may not identify which operation expired.

**Verified fix:** Test the short protocol deadline with the real client, a
transport-only child double, and a controlled clock at the exact boundary. Keep
separate real-process integration tests using the unchanged production timeout.
Share response cases and fixture payloads across both layers, require exact
error causes, and use bounded readiness, settlement, exit, and owned-child
cleanup. Synthetic transport delays may prove the boundary separation but do
not establish the cause of a historical flake.

**Regression verification:** Cover every malformed response and valid control
in both layers. In controlled time, prove pending state immediately before the
deadline, timeout exactly at the deadline, initialization timeout, queue
settlement, one failure notification, and no late replacement of the cause. In
real transport, assert the production timeout is selected and verify delayed
initialization and delayed responses still reach the exact protocol verdict.
Run the complete serialized suite without retries, skips, or concurrency
changes.

## Mutable Prompt Metadata Does Not Bind Prompt Semantics

**Description:** A packet verifier can validate immutable source snapshots and a
packet identity while trusting prompt length and hash fields stored beside the
prompt. Altering the prompt and updating those two mutable fields then passes
verification without changing the original packet identity.

**Verified fix:** Bind the complete prompt program to packet identity, including
trusted mission and policy material, independently recompute program and source
manifest identities, and reconstruct every expected prompt byte from those
bound inputs and exact source snapshots. Compare actual prompt bytes to that
reconstruction before checking declared hash and length.

**Regression verification:** Build a legitimate packet containing CRLF source
bytes, preserve every snapshot and the original packet identity, alter only the
prompt, update its declared hash and length, and require verification to reject
the content. Retain a positive CRLF packet test and reject attempts to alter the
bound program.

## Mutable Git Ref Lookup Produces an Incoherent Journal Snapshot

**Description:** A journal reader can observe a branch ref at commit A and then
retrieve content through the branch name after it advances to commit B. The
reader returns B's state associated with A's SHA, so a subsequent
compare-and-swap is based on a snapshot that never existed.

**Verified fix:** Read the ref exactly once, validate the observed commit SHA,
and retrieve journal content using that immutable commit SHA. Validate complete
API response shape, Base64 encoding, canonical bytes, and embedded request
identity before returning the commit/state pair.

**Regression verification:** Deterministically return ref A, advance the branch
to B, and make branch-name content resolve to B while commit-qualified content
resolves to A. Require the reader to return A/A. Also cover coherent stale
reads, competing non-fast-forward updates, and incomplete ref and content
responses.

## Abbreviated Task Updates Accumulate as Duplicate Rows

**Description:** A live task widget can parse a detailed ledger but fail to
reconcile later abbreviated updates when detailed identifiers use a colon, such
as `T1 : description`, or updates group identifiers as `T1–T5` and `T6/T7`.
Each update is then appended as a new row, inflating task and status counts.

**Verified fix:** Parse the identifier expression independently from `:` or
em-dash descriptions, normalize numeric ranges and slash-separated groups into
canonical identifier sets, and apply each update to matching detailed tasks.
Preserve the original task descriptions and attach explicit update text as
detail rather than replacing or duplicating the task.

**Regression verification:** Feed the production Markdown parser, reconciler,
and renderer a detailed seven-task ledger followed by exact, ranged, and
slash-group updates. Require seven final status rows, the original descriptions,
the final per-task statuses, the explicit blocked detail, and no abbreviated
range or group rows.

## Prose-Only Task Progress Leaves a Passive Ledger Stale

**Description:** An agent can announce that one task completed and another
started using ordinary prose without emitting a structured Task Ledger update.
A passive widget has no authoritative status transition to consume, so it keeps
showing the last structured state even though the surrounding narrative has
advanced.

**Verified fix:** Keep the widget strict and make the producer contract
explicit. Emit a canonical, machine-parseable Task Ledger transition block in
the same assistant message, before status prose or the next tool call. Require a
complete final ledger and specify that prose alone never satisfies the update
obligation.

**Regression verification:** A repository test must require the always-loaded
agent directives to route active ledgers to the canonical producer contract and
must require that contract to contain the exact parseable transition shape,
ordering requirement, code-fence prohibition, and complete-final-ledger rule.

## Slash-Separated Task Descriptions Expand During Streaming

**Description:** A Task Ledger reconciler can treat slash-separated prose such
as `commit/publication` as a grouped identifier expression. One accidental
abbreviated item then switches the complete ledger into update mode, where every
unmatched task is appended again for each repeated streaming snapshot. A
seven-task widget can consequently grow to more than one thousand rows.

**Verified fix:** Accept single-letter symbolic identifiers and identifiers with
numeric components, but reject multi-letter prose words as symbolic identifiers.
Treat an implicit abbreviated update as such only when every incoming item is a
valid task reference. Make unmatched updates idempotent by replacing an exact
task match before appending a genuinely new task.

**Regression verification:** Reconcile a complete ledger containing
`commit/publication` 250 times and require byte-equivalent two-row state. Feed
the exact seven-task production ledger through repeated `message_update` events
and session restoration, requiring one live render and seven restored rows.
Replay the captured streaming session character by character and require both
the maximum and final row counts to remain seven.

## Descriptor Metadata Does Not Prove a Stable File Observation

**Description:** A reader can validate a path against an open regular-file
descriptor and compare descriptor metadata before and after reading, yet accept
stale bytes after the path is rebound to another inode. A same-inode rewrite of
equal length can also evade size and coarse timestamp comparisons. Hashes,
structured facts, or negative credential-screening claims may then describe
bytes no longer present at the named path.

**Verified fix:** Track the caller's complete first sequential read with a
bounded incremental byte count and SHA-256, then perform a second fixed-block
read from offset zero through the same open descriptor. Accept only equal byte
counts and digests after EOF, and finally revalidate the path with `lstat`
against the still-open descriptor's device, inode, and regular-file type. Treat
any incomplete read, mismatch, absent path, symlink, or observation error as
indeterminate. This is bounded coherence, not a lock or protection against
adversarial ABA mutation.

**Regression verification:** Deterministically schedule mutations after the real
consumer reaches EOF but before context exit. Cover rename-away plus regular-file
replacement and same-inode, same-size rewrites under an oracle that suppresses
timestamp changes. Require event facts to become unavailable, old artifact
digests to become unavailable, credential screening to become indeterminate,
and bounded reads to raise. Retain stable empty, exact-limit, known-pattern,
cross-block, and large-file memory controls.

## Ephemeral Remote Markers Cannot Establish Durable Attempt Consumption

**Description:** An at-most-once operation can store its consumed marker and raw
diagnostics only under a remote temporary directory. Shutdown, rebuild, or
ordinary temporary-file cleanup then removes both the anti-replay fact and the
only causal evidence, making a consumed identity appear unused and leaving
sanitized receipts unable to explain the failure.

**Verified fix:** Permanently close known consumed identities in code. For future
authorized identities, write an exclusive, fsynced request reservation to the
designated controller's private persistent storage before command emission.
Before remote Shutdown, retain bounded diagnostics only after sanitary receipt
admission, remote and local credential screening, and remote/local digest
agreement. Keep reservation, receipt retention, and diagnostic retention as
separate truthful controls; never automatically delete a reservation.

**Regression verification:** Simulate controller restart and complete remote
`/tmp` deletion after arming, then require replay refusal from persistent local
state. Exercise concurrent arming, partial and malformed claims, fsync failure,
contamination, oversized or aliased artifacts, transfer and hash failures, and
verified local survival after remote deletion. Require the Shutdown boundary to
run after every retention outcome without converting partial retention to PASS.

## Sandbox Child Uses an Interpreter Outside Its Replaced PATH

**Description:** A trusted workflow can start a sandbox runtime successfully but
pass the bare command `python3` after replacing the child PATH with a minimal
permission-profile value. When the trusted interpreter is installed outside
that PATH, the sandbox reaches child execution and returns executable-not-found.
The wrapper then reports only a generic sandbox probe failure and emits no
observation receipt.

**Verified fix:** Resolve the broker process interpreter through
`sys.executable`, require its strict resolved target to be an absolute,
executable regular file, and pass that absolute path as the sandbox child
command. Do not broaden the permission-profile PATH or weaken the sandbox.
Reject an invalid interpreter before launching the sandbox runtime.

**Regression verification:** Execute the real subprocess runner against a
sandbox shim under an empty PATH. Make the shim reject relative or
non-executable child commands and emit a valid observation only for the absolute
resolved interpreter. Also replace `sys.executable` with a missing path and
require the probe to fail before the runner is called.

## Optional Credential Environment Falls Back to Ambient Authority

**Description:** A private-source helper can return no child environment when a
repository is absent from its dedicated allowlist. A later subprocess then
inherits an ambient workflow token, allowing private metadata access or clone
under privileged publication authority instead of failing before source access.

**Verified fix:** For the private mode, use a strict environment constructor
that independently requires both exact allowlist membership and a nonempty
dedicated source token. Build the child environment from a narrow key allowlist
and set only that source token; never represent missing private authority as
`None` when `None` means ambient inheritance. Keep the optional helper only for
paths where public access is valid.

**Regression verification:** Exercise the real preparation boundary with an
ambient privileged token. Test absent private allowlist with a dedicated token,
and present allowlist with no dedicated token. Both must reject explicitly
before source metadata access, journal construction, or clone.

## New Receipt Fields Break Immutable Historical Evidence

**Description:** Extending a mode-specific evidence receipt with a newly
required discriminator can invalidate authentic historical receipts that
predate the field, even when their original evidence type, assurance scope,
metadata, and identities remain unchanged. Making the field universally
optional can instead permit cross-mode substitution.

**Verified fix:** Validate legacy omission only for the historical mode whose
original receipt contract lacked the field, using authenticated surrounding
metadata plus its original evidence type and scope. Require the discriminator
for every new mode and reject any contradictory value when the legacy field is
present. Never rewrite historical evidence.

**Regression verification:** Revalidate an exact baseline-shaped legacy receipt
without the new field and require success. Require a new-mode receipt missing or
altering the discriminator to fail, and retain public/private cross-mode
substitution tests.

## Partial Source Resolvers Overclaim Compiler Semantics

**Description:** A source-boundary checker can parse a language AST and then
approximate imports, aliases, lexical scopes, and namespaces. Unsupported
self-referential aliases or same-spelled declarations in another namespace or
scope can make the approximation accept a root that the compiler resolves
externally. Adding cases incrementally turns the checker into an unsound custom
compiler front end.

**Verified fix:** When the actual migration contract only requires preserving
independently inspected source, replace semantic approximation with immutable
source identity. Require regular tracked files, hash the current working bytes
through the version-control system's normal path-specific content filters, and
compare against explicit accepted object identities. Keep rebaselining an
explicit independently reviewed decision.

**Regression verification:** Check the accepted working files, then use
non-production temporary copies to prove rejection after one-byte changes,
import aliases, qualified calls, macros, modules, conditional declarations,
removal, nonregular replacement, and symlink replacement. Restore the original
bytes and require success. Also fail closed on version-control process failure
and malformed object output.
