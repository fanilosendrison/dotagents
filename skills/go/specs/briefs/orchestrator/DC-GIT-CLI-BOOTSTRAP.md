---
id: DC-GIT-CLI-BOOTSTRAP
type: dependency-contract
version: "1.0.0"
dependency_version: "2.37.1 (Apple Git-137.1)"
scope: git-cli-bootstrap
status: active
consumers: [claude-code]
referenced_by:
  - NIB-S-GO-TURNLOCK-ORCHESTRATOR
  - NIB-M-GO-ASYNC-GIT-RUNNER
  - NIB-M-GO-PREREQUISITE-VALIDATION
  - NIB-M-GO-REPO-CAPTURE
  - NIB-M-GO-DIRTY-STATE-CAPTURE
  - NIB-M-GO-WORKSPACE-SETUP-WORKTREE
  - NIB-M-GO-PROJECT-DISCOVERY-FINALIZE
superseded_by: []
---

# Dependency Contract — Git CLI (Bootstrap Extensions)

VegaCorp — July 2026

---

## 0. Identity

- **Component name**: Git command-line executable.
- **Version**: `git version 2.37.1 (Apple Git-137.1)`.
- **Source**: Local system executable available as `git`.
- **Role**: Provides advanced repository control, worktree initialization, remote checking, patch serialization and application, submodule updates, LFS operations, and process environment controls (hooks bypass) for the `/go` startup workflow.
- **Extension**: This contract extends [DC-GIT-CLI.md](../stage-harness/DC-GIT-CLI.md) (stage-harness) with bootstrap-specific commands.

---

## 1. Interface

The bootstrap pipeline may call only the following Git commands (either on the source directory or within the private workspace/worktree).

### 1.1 Global Version Check
```sh
git --version
```
- **Returns**: A single line on `stdout` indicating the installed version (e.g. `git version 2.37.1`).

### 1.2 Path and State Resolution
```sh
git -C <dir> rev-parse --is-inside-work-tree --show-cdup --git-dir
git -C <dir> symbolic-ref HEAD
git -C <dir> branch -r --list <remote>/<branch>
```
- **Returns**: Git workspace characteristics and resolved branch references. `symbolic-ref` outputs the full ref name (e.g. `refs/heads/main`).

### 1.3 Default Branch and Config Identification
```sh
git -C <dir> config --get init.defaultBranch
```
- **Returns**: The default branch name configured for new repositories (e.g. `main` or `master`) on `stdout`.

### 1.4 Workspace Verification & Ancestry Checks
```sh
git -C <dir> merge-base --is-ancestor <commitA> <commitB>
```
- **Returns**: No `stdout`. Exits with code `0` if `<commitA>` is an ancestor of `<commitB>`, or exits `1` otherwise.

### 1.5 Worktree Management
```sh
git -C <sourceDir> worktree add <worktreePath> <branchNameOrSha>
git -C <sourceDir> worktree prune
git -C <sourceDir> worktree list --porcelain
git -C <sourceDir> worktree lock <worktreePath> --reason <reason>
git -C <sourceDir> worktree unlock <worktreePath>
git -C <sourceDir> worktree remove --force <worktreePath>
git -C <worktreePath> worktree repair
```
- **Returns**: Modifies worktree configuration under `.git/worktrees/`. `worktree list --porcelain` outputs directory pathways and HEAD commits for active worktrees.

### 1.6 Remote Verification and Config
```sh
git -C <dir> remote -v
git -C <dir> remote add <name> <url>
git -C <dir> remote set-url <name> <url>
git -c core.hooksPath=/dev/null -C <dir> push -u <remote> <branchName>
```
- **Returns**: Output lists for remote configurations, or edits `.git/config` remote variables, or pushes branches to the provider.

### 1.7 Initial Setup and Commit Generation
```sh
git -c core.hooksPath=/dev/null -C <dir> init
git -c core.hooksPath=/dev/null -C <dir> commit --allow-empty -m <message>
git -c core.hooksPath=/dev/null -C <dir> branch -f <branchName>
```
- **Returns**: Initializes a new repository or records a new commit object. `-c core.hooksPath=/dev/null` suppresses execution of local client-side commit hooks.

### 1.8 Repository Discovery & Ignored Files Verification
```sh
git -C <dir> check-ignore <path>
git -C <dir> ls-files -v
```
- **Returns**: Outputs matching ignore rules or lists files with status tags (e.g., skip-worktree/assume-unchanged check).

### 1.9 Index Bypassing and Object Hashing (Dirty State Capture)
```sh
# Spawned with env variable: GIT_INDEX_FILE=<tempIndexPath>
git -C <sourceDir> read-tree HEAD
git -C <sourceDir> diff-index --cached --binary --full-index HEAD
git -C <sourceDir> diff --cached --binary --full-index
git -C <sourceDir> hash-object <filePath>
```
- **Returns**: Compares the temp index to HEAD or generates a binary patch. `hash-object` calculates the unique SHA-1 hash for the given file content.

### 1.10 Patch Verification and Replay
```sh
git -c core.hooksPath=/dev/null -C <worktreeDir> apply --check --binary <patchPath>
git -c core.hooksPath=/dev/null -C <worktreeDir> apply --binary <patchPath>
```
- **Returns**: Applies binary diff structure cleanly to `<worktreeDir>`. `--check` evaluates eligibility without modifying files.

### 1.11 Submodules and LFS
```sh
git -C <worktreeDir> submodule update --init --recursive
git -C <worktreeDir> lfs pull
```
- **Returns**: Downloads and updates nested submodules and Git LFS resources.

### 1.12 Status Verification (Human-Readable quotePath)
```sh
git -c core.quotePath=false -C <dir> status --porcelain
```
- **Returns**: Outputs line-delimited status entries with unquoted UTF-8 filenames.

---

## 2. Behavioral Contract

- **Hooks Bypass**: All mutating operations (`init`, `commit`, `apply`, `submodule update`) must run with `-c core.hooksPath=/dev/null` to bypass arbitrary developer hooks that could trigger interactive blockages or local scans.
- **Source Non-Mutation**: Except for the explicit case of creating/initializing a new target repository (when it is clean and uninitialized), the source repository must **never** be mutated by bootstrap tasks. Binary diff calculations must use a temporary isolated index (`GIT_INDEX_FILE` environment redirect) to prevent altering the developer's work index.
- **Worktree Lock Exclusivity**: When adding a worktree, `git worktree lock` must be called immediately to secure the pathway. On cleanup or run completion, `git worktree unlock` and `git worktree remove --force` must be used to prune resources.
- **Detached Head Ancestry**: When validating existing workspaces on resume (`skipSetup = true`), the workspace HEAD commit must be checked as an ancestor of the target remote branch utilizing `merge-base --is-ancestor` instead of checking for strict branch pointer equality.

---

## 3. Error Semantics

- **Version Validation**: If `git --version` output does not match `2.18.0` or newer, `prerequisite-validation` must throw a blocking error.
- **Porcelain Parsing**: Porcelain statuses (`git status --porcelain`) must be parsed by checking characters directly. Unicode characters in filenames must be preserved by running with `-c core.quotePath=false`.
- **Merge Conflicts**: If `git apply --check` or `git status` reports unmerged changes or unresolved conflict markers, the dirty-state adoption sequence must fail-closed.
- **Subprocess failures**: Exit codes other than `0` for mutating or setup Git commands (such as `worktree add`, `submodule update`, `lfs pull`) must raise a fatal error and mark the task status as `errored` or `failed`.

---

## 4. Integration patterns

All Git subprocesses must be invoked asynchronously via `Bun.spawn` (refer to `DC-BUN-SPAWN-ASYNC-RUNTIME` for execution details).
Stderr outputs must be captured separately to compile precise logs in case of Git command rejections.

---

## 5. Consumer constraints

- **Stdout redirection**: No Git command output should be written directly to the console. stdout must be captured (`"pipe"`) to prevent collision with Turnlock's stdin/stdout communication protocols.
- **Quoting and Escaping**: When passing parameters like branch names, paths, or commit messages, values must be passed as distinct vector elements to the subprocess runner, **never** concatenated as raw strings.
- **Working Directory context**: Every repository-dependent execution must supply the target directory context using `-C <path>` rather than changing directory in-process (`cd`).

---

## 6. Known limitations

- **Apple Git specificities**: Behavior matching `git worktree list --porcelain` is version-specific; formatting changes across major Git upgrades must be validated.
- **LFS availability**: `git lfs pull` requires the `git-lfs` extension binary to be present on the host environment; its absence is treated as a fatal task error.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
