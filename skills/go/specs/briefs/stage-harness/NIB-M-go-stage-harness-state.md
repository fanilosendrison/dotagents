---
id: NIB-M-GO-STAGE-HARNESS-STATE
type: nib-module
version: "1.0.0"
scope: go-stage-harness/state
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness State

VegaCorp - July 2026

---

## 1. Purpose

This module collects canonical repository state after a stage returns or throws.
It computes `headShaAfter`, `trackedWorktreeHash`, and `worktreeClean`
independently so the final output records as much state as possible.

The module does not decide final stage status. It reports unavailable canonical
fields as blocking harness errors for M6 assembly.

---

## 2. Inputs

```ts
type CollectCanonicalStateInput = {
  input: ResolvedStageInput;
};
```

`input.workDir` is the resolved Git repository root produced by M1.

Dependency contracts:

- `DC-GIT-CLI` for `rev-parse`, `status`, and `ls-files` command semantics.
- `DC-NODE-RUNTIME-FS-PATH-CRYPTO` for `lstat`, `readFile`, `readlink`, symlink
  behavior, file-mode observation, and SHA-256 hashing.

---

## 3. Outputs

```ts
type CanonicalStateSnapshot = {
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
  errors: StageError[];
};
```

Each `null` field must correspond to at least one blocking `StageError`.

---

## 4. Algorithm

### 4.1 Collect fields independently

```ts
async function collectCanonicalState(
  input: CollectCanonicalStateInput,
): Promise<CanonicalStateSnapshot> {
  const errors: StageError[] = [];

  const headShaAfter = await collectHeadShaAfter(input.input, errors);
  const trackedWorktreeHash = await collectTrackedWorktreeHash(
    input.input,
    errors,
  );
  const worktreeClean = await collectWorktreeClean(input.input, errors);

  return {
    headShaAfter,
    trackedWorktreeHash,
    worktreeClean,
    errors,
  };
}
```

Failure in one collector must not prevent the other collectors from running.

### 4.2 Collect `headShaAfter`

Run:

```sh
git -C <resolved-work-dir> rev-parse HEAD
```

On success, trim one trailing line ending and return the object ID string.

On failure, return `null` and append a blocking `StageError` with a message that
names `headShaAfter`.

### 4.3 Collect `worktreeClean`

Run:

```sh
git -C <resolved-work-dir> status --porcelain=v1 -z --ignore-submodules=none
```

Return `true` when stdout is empty. Return `false` when stdout is non-empty.

On command failure, return `null` and append a blocking `StageError` with a
message that names `worktreeClean`.

### 4.4 Collect `trackedWorktreeHash`

Run:

```sh
git -C <resolved-work-dir> ls-files -s -z
```

Parse NUL-terminated records in the exact format:

```text
<mode> <object> <stage>\t<path>\0
```

For each record:

1. Parse `mode`, `objectId`, `stage`, and raw path bytes.
2. If `stage !== "0"`, stop hash computation and return `null` with a blocking
   error naming the unmerged path.
3. Determine current content hash and normalized mode:
   - Regular file, index mode starting with `100`: call `lstat`, require a
     regular file, read raw bytes, hash with SHA-256, and normalize mode to
     `100755` if any executable bit is set or `100644` otherwise.
   - Symlink, index mode `120000`: call `lstat`, require a symlink, read the raw
     symlink target with `readlink`, and hash the target bytes with SHA-256. Do
     not hash the target file.
   - Deleted tracked path: if `lstat` returns `ENOENT`, use content hash
     `DELETED` and mode `0`.
   - Submodule, index mode `160000`: use the index object ID as the content hash
     and use mode `160000`. Do not inspect submodule worktree contents.
4. If the on-disk type does not match the index mode, return `null` with a
   blocking error naming the path. Submodules are exempt from this check.
5. If `lstat` succeeds but a later read fails with `ENOENT`, treat it as a race
   and return `null` with a blocking error naming the path.
6. If any other read error occurs, return `null` with a blocking error naming
   the path.

Sort tuples by raw path bytes with bytewise comparison. Do not use locale-aware
string sorting.

Serialize each tuple as raw NUL-delimited records:

```text
<raw-path-bytes>\0<mode>\0<content-hash>\0
```

Concatenate all records and return the SHA-256 hash of the concatenated bytes.

For zero tracked files, return:

```text
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
```

---

## 5. Example

Repository state:

- `HEAD` resolves to `<commit-after-stage>`.
- `git status --porcelain=v1 -z --ignore-submodules=none` is empty.
- One tracked regular file `src/a.ts` exists with non-executable mode.

Expected output:

```ts
{
  headShaAfter: "<commit-after-stage>",
  trackedWorktreeHash: "<sha256-of-tracked-records>",
  worktreeClean: true,
  errors: [],
}
```

If the tracked file cannot be read because of permissions, expected output:

```ts
{
  headShaAfter: "<commit-after-stage>",
  trackedWorktreeHash: null,
  worktreeClean: true,
  errors: [
    {
      message: "trackedWorktreeHash unavailable: cannot read src/a.ts",
      severity: "blocking",
      file: "src/a.ts",
    },
  ],
}
```

---

## 6. Edge cases

- Conflicted index stage other than `0`: `trackedWorktreeHash` is `null`.
- Deleted tracked file: hash uses `DELETED` and mode `0`.
- Regular file becomes a symlink after indexing: hash is `null`.
- Symlink target is missing: still hash the symlink target string.
- `readlink` fails for a symlink: hash is `null`.
- Submodule pointer changes: hash changes because the index object ID changes.
- Dirty submodule worktree: hash may be unchanged, but `worktreeClean` is
  `false` because status uses `--ignore-submodules=none`.
- `git rev-parse HEAD` fails: only `headShaAfter` is `null` unless other
  collectors also fail.

---

## 7. Constraints

- The module must not mutate `workDir` or `artefactDir`.
- The hash algorithm must use raw filesystem bytes, not Git blob IDs, for
  regular files.
- The hash algorithm must ignore untracked and ignored files.
- The hash algorithm must include tracked file modes, symlink targets, deleted
  tracked files, and submodule pointers.
- The module must preserve independent best-effort collection.

---

## 8. Integration

`runStage` calls M4 immediately after M3:

```ts
const canonicalState = await collectCanonicalState({
  input: normalizedInput,
});
```

M6 consumes the snapshot and turns any state errors into an `errored` canonical
output.

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
