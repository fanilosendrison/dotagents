---
id: DC-NODE-RUNTIME-FS-PATH-CRYPTO
type: dependency-contract
version: "1.0.0"
dependency_version: "Node.js v22.22.2; Bun 1.3.12 compatibility target"
scope: node-runtime-fs-path-crypto
status: active
consumers: [codex]
referenced_by:
  - NIB-M-GO-HARNESS-PREFLIGHT
  - NIB-M-GO-HARNESS-INVOCATION
  - NIB-M-GO-HARNESS-STATE
  - NIB-M-GO-HARNESS-EVIDENCE
  - NIB-M-GO-HARNESS-PERSISTENCE
  - NIB-T-GO-PHASE-HARNESS
superseded_by: []
---

# Dependency Contract - Node Runtime Filesystem, Path, Crypto

## 0. Identity

- Component name: Node-compatible runtime APIs.
- Version: Node.js `v22.22.2`; Bun `1.3.12` compatibility target.
- Source: Node standard library APIs as implemented by the selected runtime.
- Role: perform path resolution, filesystem inspection and mutation, symlink
  handling, SHA-256 hashing, JSON serialization, process identifiers, and child
  process execution.

## 1. Interface

The harness may use these APIs or direct equivalents:

```ts
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

await fs.realpath(pathname);
await fs.mkdir(pathname, { recursive: false });
await fs.lstat(pathname);
await fs.stat(pathname);
await fs.readFile(pathname);
await fs.readlink(pathname);
await fs.writeFile(pathname, data, { flag: "wx" });
await fs.rename(from, to);
await fs.rm(pathname, { force: true });

path.isAbsolute(pathname);
path.dirname(pathname);
path.basename(pathname);
path.resolve(...parts);
path.join(...parts);
path.sep;

createHash("sha256").update(data).digest("hex");
JSON.stringify(value, null, 2);
process.pid;
```

## 2. Behavioral Contract

`fs.realpath` returns the canonical filesystem path after resolving symlinks.
Evidence containment must compare realpaths, not raw path strings.

`fs.mkdir(path, { recursive: false })` succeeds only when the target directory
does not already exist and its parent exists.

`fs.lstat` observes the path entry itself. It must be used before following
symlinks. `fs.stat` follows symlinks and must not be used to decide whether an
indexed symlink is a symlink.

`fs.readlink` returns the symlink target string. For hashing symlinks, the
consumer must hash the raw target bytes, not the target file bytes.

`fs.readFile` returns file bytes. Regular-file hashing must use these bytes
directly and must ignore Git filters or line-ending normalization.

`fs.writeFile` with `flag: "wx"` must fail if the temporary file already exists.

`fs.rename` within the same directory is the v1 atomic publication mechanism for
`output.json`. The harness does not provide `fsync` durability in v1.

`path.resolve(realpath(dirname(artefactDir)), basename(artefactDir))` is the
canonical way to resolve an artefact directory that does not yet exist.

`path.join(artefactDir, evidenceRef)` is used only after rejecting absolute
evidence refs, NUL bytes, and `..` path segments.

`createHash("sha256")` returns lowercase hex SHA-256 digests.

`JSON.stringify(output, null, 2) + "\n"` is the canonical serialized
`output.json` payload.

## 3. Error Semantics

Filesystem and runtime errors must be mapped according to phase-harness stage:

- Preflight filesystem errors produce preflight failure and no `output.json`.
- Artefact directory creation errors produce setup failure and no `output.json`.
- State collection read errors produce blocking `PhaseError`s and set only the
  affected canonical field to `null`.
- Evidence validation filesystem errors produce blocking validation errors and
  an `errored` output when persistence still succeeds.
- Persistence write or rename errors produce no valid `output.json`.

`ENOENT` from `lstat` during tracked hashing means a tracked path is deleted.
`ENOENT` after a successful `lstat` means a race condition and makes
`trackedWorktreeHash` unavailable.

Permission errors such as `EACCES` must never be silently skipped.

## 4. Integration Patterns

Preflight uses path and realpath APIs to canonicalize `workDir` and
`artefactDir`.

State collection uses `lstat`, `readFile`, `readlink`, and SHA-256 hashing for
`trackedWorktreeHash`.

Evidence validation uses `path.join`, `realpath`, and file type checks for
realpath containment and regular-file validation.

Invocation uses JavaScript exception handling and `JSON.stringify` only to
produce a best-effort thrown-value message.

Persistence uses `writeFile` with `wx`, then `rename`, then best-effort cleanup
with `rm` when rename fails.

## 5. Consumer Constraints

- Do not use shell string interpolation for child process execution.
- Do not normalize path case or Unicode.
- Do not compare evidence containment before resolving realpaths.
- Do not hash symlink targets by reading target files.
- Do not use recursive artefact directory creation.
- Do not call `fsync` in v1.
- Do not treat temporary-file cleanup failure as a successful persistence.

## 6. Known Limitations

- Atomic rename is assumed only within the same directory. The temporary file
  must be created in `artefactDir`.
- Runtime APIs can vary between Node and Bun. If Bun is used to execute the
  implementation, the listed Node-compatible semantics must be verified by the
  NIB-T tests.
- Process-global stdout and stderr capture is out of scope for in-process
  phases.
