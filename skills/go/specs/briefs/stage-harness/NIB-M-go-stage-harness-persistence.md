---
id: NIB-M-GO-STAGE-HARNESS-PERSISTENCE
type: nib-module
version: "1.0.0"
scope: go-stage-harness/persistence
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness Persistence

VegaCorp - July 2026

---

## 1. Purpose

This module creates the artefact directory before stage invocation and writes
the canonical `output.json` after M6 assembly. It owns the filesystem side
effects that bracket stage execution.

The module does not validate stage drafts, collect Git state, or decide final
status.

---

## 2. Inputs

For artefact directory setup:

```ts
type CreateArtefactDirectoryInput = {
  input: ResolvedStageInput;
};
```

For canonical output persistence:

```ts
type WriteCanonicalOutputInput = {
  output: StageOutput;
};
```

Dependency contracts:

- `DC-ZOD` for final pre-write `StageOutput` validation.
- `DC-NODE-RUNTIME-FS-PATH-CRYPTO` for non-recursive `mkdir`, deterministic JSON
  serialization, exclusive temp-file creation, atomic rename, process ID usage,
  and best-effort cleanup.

---

## 3. Outputs

For setup:

```ts
type CreateArtefactDirectoryResult =
  { ok: true; input: ResolvedStageInput } | { ok: false; reason: string };
```

For persistence:

```ts
type WriteCanonicalOutputResult =
  { ok: true; output: StageOutput } | { ok: false; reason: string };
```

When either result is `ok: false`, no valid `output.json` is guaranteed to
exist.

---

## 4. Algorithm

### 4.1 Create artefact directory

```ts
async function createArtefactDirectory(
  input: CreateArtefactDirectoryInput,
): Promise<CreateArtefactDirectoryResult> {
  try {
    await fs.mkdir(input.input.artefactDir, { recursive: false });
    return { ok: true, input: input.input };
  } catch (cause) {
    return {
      ok: false,
      reason: stringifyFilesystemError(cause),
    };
  }
}
```

`recursive` must be `false`. Preflight already verified that the parent exists
and `artefactDir` does not exist. If creation fails, the harness stops before
stage invocation and writes no `output.json`.

### 4.2 Serialize canonical output

Before writing, validate `output` with `stageOutputSchema`. If validation fails,
return `ok: false`.

Serialize as deterministic JSON:

```ts
const payload = JSON.stringify(output, null, 2) + "\n";
```

The schema defines object shape, so no custom key sorting is required in v1.
This serialization is the canonical persisted `StageOutput` artifact for the
stage harness. It is not a general JSON canonicalization algorithm. Any
cryptographic hash of a JSON business object must use the workflow JCS profile
defined in [`canonical-hashing.md`](../../working/workflow/canonical-hashing.md).

### 4.3 Atomic write

Write to a temporary file in `output.artefactDir`, then rename over
`output.json`:

```ts
const temporaryPath = path.join(
  output.artefactDir,
  `.output.${process.pid}.${randomSuffix}.tmp`,
);

await fs.writeFile(temporaryPath, payload, { flag: "wx" });
await fs.rename(temporaryPath, path.join(output.artefactDir, "output.json"));
```

If any write or rename step fails, return `ok: false`.

If write succeeds but rename fails, attempt to remove the temporary file.
Failure to remove the temporary file does not change the result; the result is
still `ok: false`.

### 4.4 No durability fsync

Do not call `fsync` on the file or parent directory in v1. Durability fsync is
explicitly reserved for a future extension.

---

## 5. Example

Input output object:

```ts
{
  runId: "01JTESTRUN00000000000000000",
  stage: "lint",
  status: "passed",
  artefactDir: "<resolved-run-artifacts>/lint",
  evidenceRefs: ["evidence/lint.json"],
  errors: [],
  headShaAfter: "<commit-after-stage>",
  trackedWorktreeHash: "<tracked-worktree-hash>",
  worktreeClean: true,
}
```

Expected file:

```text
<resolved-run-artifacts>/lint/output.json
```

The file contains pretty-printed JSON with a trailing newline.

---

## 6. Edge cases

- `artefactDir` already exists at setup time: setup fails and no output exists.
- Parent directory disappears after preflight: setup fails and no output exists.
- `output.json` exists before M7: M5 reports a reserved-file violation; M7 still
  writes canonical output if M6 produced a valid `StageOutput`.
- Temporary file name collides: choose another random suffix or fail without
  overwriting.
- Disk full during write: persistence fails and no valid output is guaranteed.
- Rename fails: persistence fails and temporary cleanup is best effort.
- Output schema validation fails at persistence time: persistence fails and no
  output is written.

---

## 7. Constraints

- The stage must never write `output.json`; only this module writes it.
- Setup must use non-recursive directory creation.
- Persistence must write `output.json` atomically by temporary file plus rename.
- Persistence must not use `fsync` in v1.
- The module must not write invalid canonical output.

---

## 8. Integration

M2 integration:

```ts
const created = await createArtefactDirectory({
  input: preflight.input,
});

if (!created.ok) {
  throw new HarnessSetupError(created.reason);
}
```

M7 integration:

```ts
const persisted = await writeCanonicalOutputAtomically({
  output: assembled.output,
});

if (!persisted.ok) {
  throw new HarnessPersistenceError(persisted.reason);
}
```

`runStage` returns `persisted.output`.

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
