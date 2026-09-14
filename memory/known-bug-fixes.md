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
