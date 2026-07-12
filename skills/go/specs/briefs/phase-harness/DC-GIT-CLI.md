---
id: DC-GIT-CLI
type: dependency-contract
version: "1.0.0"
dependency_version: "2.37.1 (Apple Git-137.1)"
scope: git-cli
status: active
consumers: [codex]
referenced_by:
  - NIB-M-GO-HARNESS-PREFLIGHT
  - NIB-M-GO-HARNESS-STATE
  - NIB-T-GO-PHASE-HARNESS
superseded_by: []
---

# Dependency Contract - Git CLI

## 0. Identity

- Component name: Git command-line executable.
- Version: `git version 2.37.1 (Apple Git-137.1)`.
- Source: local system executable available as `git`.
- Role: provide repository identity, commit validation, tracked-file listing,
  index mode metadata, sparse-checkout detection, and worktree status.

## 1. Interface

The harness may call only these Git commands.

```ts
type GitCommandResult = {
  exitCode: number;
  stdout: Buffer;
  stderr: Buffer;
};
```

### `rev-parse --show-toplevel`

```sh
git -C <workDir> rev-parse --show-toplevel
```

Returns the repository top-level path on stdout with a trailing newline.

### `cat-file -t`

```sh
git -C <workDir> cat-file -t <objectId>
```

Returns the object type, such as `commit`, on stdout.

### `cat-file -e`

```sh
git -C <workDir> cat-file -e <objectId>^{commit}
```

Returns no required stdout. Exit code `0` means the object resolves to a commit.

### `sparse-checkout list`

```sh
git -C <workDir> sparse-checkout list
```

Returns sparse-checkout patterns on stdout when sparse checkout is configured.

### `config --bool core.sparseCheckout`

```sh
git -C <workDir> config --bool core.sparseCheckout
```

Returns `true`, `false`, or exits non-zero when the value is unset.

### `ls-files -v -z`

```sh
git -C <workDir> ls-files -v -z
```

Returns NUL-terminated records whose first byte is the status tag used to detect
skip-worktree and assume-unchanged entries.

### `rev-parse HEAD`

```sh
git -C <workDir> rev-parse HEAD
```

Returns the current `HEAD` object ID on stdout with a trailing newline.

### `status --porcelain=v1 -z --ignore-submodules=none`

```sh
git -C <workDir> status --porcelain=v1 -z --ignore-submodules=none
```

Returns no stdout when the worktree is clean. Returns NUL-delimited porcelain
records when tracked, untracked, or submodule state is dirty.

### `ls-files -s -z`

```sh
git -C <workDir> ls-files -s -z
```

Returns NUL-terminated records with this byte format:

```text
<mode> <object> <stage>\t<path>\0
```

## 2. Behavioral Contract

All commands must be executed with `-C <resolvedWorkDir>`, where
`resolvedWorkDir` is the canonical repository root produced by preflight.

`stdout` must be treated as bytes. Commands using `-z` must be parsed by NUL
bytes, not by newline or locale-sensitive string operations.

`rev-parse --show-toplevel` must equal `resolvedWorkDir` after trimming one
trailing line ending. Any other value means the input is not the repository
root.

`baseSha` validation must require both:

- `cat-file -t <baseSha>` returns `commit`.
- `cat-file -e <baseSha>^{commit}` exits with code `0`.

`ls-files -v -z` tag interpretation:

- Tag `S` means skip-worktree and is unsupported.
- Any lowercase ASCII tag means assume-unchanged and is unsupported.
- Any unsupported tag condition is a preflight failure.

`ls-files -s -z` mode interpretation:

- Modes beginning with `100` are regular tracked files.
- Mode `120000` is a symlink.
- Mode `160000` is a submodule pointer.
- Stage values other than `0` are unmerged entries and must make
  `trackedWorktreeHash` unavailable.

`status --porcelain=v1 -z --ignore-submodules=none` must include dirty submodule
worktrees. Empty stdout means clean.

## 3. Error Semantics

Any non-zero exit from a preflight Git command is a preflight failure and
produces no `output.json`.

Any non-zero exit while collecting canonical state produces a blocking
`PhaseError`, sets only the corresponding canonical field to `null`, and does
not prevent attempts to collect the other canonical fields.

Stderr is diagnostic only. The harness may include a concise stderr excerpt in
the failure reason or `PhaseError.message`, but it must not parse correctness
from localized stderr text.

## 4. Integration Patterns

Preflight uses:

- `rev-parse --show-toplevel`
- `cat-file -t`
- `cat-file -e`
- `sparse-checkout list`
- `config --bool core.sparseCheckout`
- `ls-files -v -z`

State collection uses:

- `rev-parse HEAD`
- `status --porcelain=v1 -z --ignore-submodules=none`
- `ls-files -s -z`

Every command invocation must provide an argument vector, not a
shell-concatenated string. User-provided values such as `workDir` and `baseSha`
must never be interpolated into shell source.

## 5. Consumer Constraints

- Use `Buffer` output for `-z` commands.
- Split `-z` records on byte `0x00`.
- Do not trim, decode, or normalize paths before bytewise ordering for
  `trackedWorktreeHash`.
- Trim at most the trailing line ending for non-`-z` commands whose output is a
  single scalar.
- Do not treat untracked or ignored files as part of `trackedWorktreeHash`.
- Do not infer repository state from stderr.

## 6. Known Limitations

- This contract describes Apple Git `2.37.1`; behavior must be rechecked if the
  implementation runs under another Git distribution.
- Sparse checkout, skip-worktree, and assume-unchanged entries are rejected
  rather than supported.
- Dirty submodule contents affect `worktreeClean` but not `trackedWorktreeHash`,
  which only records the submodule pointer.
