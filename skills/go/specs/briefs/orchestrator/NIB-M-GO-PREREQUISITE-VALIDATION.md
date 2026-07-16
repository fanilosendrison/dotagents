---
id: NIB-M-GO-PREREQUISITE-VALIDATION
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/prerequisite-validation
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Prerequisite Validation

VegaCorp — July 2026

---

## 1. Purpose

This module executes the initial fail-fast checks of the `/go` bootstrap phase. It validates the host environment's Git CLI version compatibility, securely parses and validates the provider token credentials configuration (`~/.go/config.json`), and writes the corresponding validation artifact and task checkpoint.

---

## 2. Inputs

- **Context Parameters**: `runId` and `artefactRoot`.
- **Static files and binaries**:
  - `~/.go/config.json` (resolved via `realpath`).
  - `git --version` (available on system `PATH`).
- **Dependency Contracts**:
  - [DC-GIT-CLI-BOOTSTRAP.md](../DC-GIT-CLI-BOOTSTRAP.md) for version execution.
  - [DC-BUN-SPAWN-ASYNC-RUNTIME.md](../DC-BUN-SPAWN-ASYNC-RUNTIME.md) for environment path resolving and file permission checks.

---

## 3. Outputs

- Writes the validation artifact `prerequisite-validation.json` to the directory:
  `<artefactRoot>/startup/prerequisite-validation/`
- Writes the `BootstrapTaskCheckpoint` file `task-record.json` to the directory:
  `<artefactRoot>/startup/prerequisite-validation/`
- Returns a Promise resolving to `PrerequisiteValidation` (the validated parsed context, containing no token).
- Throws a blocking `PhaseError` if any prerequisite fails, halting execution immediately.

---

## 4. Algorithm

### 4.1 Git Version Validation
1. Execute `git --version` asynchronously.
2. If execution fails or throws, raise a blocking prerequisite error: "Git CLI is not installed or not available on system PATH" (resolves to `errored`).
3. Parse the version string using regex:
   `/git version (\d+)\.(\d+)\.(\d+)/`
4. Verify the version is greater than or equal to `2.18.0`:
   - Major version $> 2$, or
   - Major version $= 2$ and Minor version $\ge 18$.
5. If the version is obsolete, throw a blocking error: "Installed Git version is unsupported. Version 2.18.0 or newer is required" (resolves to `failed`).

### 4.2 Provider Config Location and Permissions
1. Resolve the path to `~/.go/config.json` using `os.homedir()`.
2. Verify the configuration file exists. If missing, throw a blocking error: "Configuration file ~/.go/config.json is missing" (resolves to `failed`).
3. Check the file permissions on POSIX systems using `fs.stat`:
   - Read the mode bits.
   - If the file is readable or writeable by group or others (POSIX mode bits mask `0o077` is non-zero), print a security warning to `process.stderr` advising the user to set tighter permissions (e.g. `chmod 600 ~/.go/config.json`). Do not block execution, but warn.

### 4.3 Credentials Parsing and Validation
1. Read the file contents as UTF-8 and parse the JSON. If parsing fails, throw `failed`.
2. Validate the parsed configuration strictly against the flat `ProviderConfig` schema (no additional undeclared fields allowed):
   - `provider`: `"github"` or `"gitlab"`.
   - `token`: non-empty string.
   - `username`: non-empty string.
   - `defaultVisibility`: `"private"` or `"public"`.
   - `apiEndpoint`: optional url string (must be absolute HTTP/HTTPS parseable URL).
3. **Token Format Enforcement**:
   - For `provider: "github"`, verify the token string starts with one of the standard prefixes: `ghp_`, `github_pat_`, `gho_`, `ghs_`, or `ghu_`.
   - For `provider: "gitlab"`, verify the token string starts with `glpat-`.
   - If any token has an invalid format or contains placeholder words (e.g. `YOUR_TOKEN_HERE`, `TODO`), throw `failed`.

### 4.4 Save Artifact and Checkpoint
1. Create the subfolder:
   `targetDir = path.join(artefactRoot, "startup", "prerequisite-validation")`
2. Construct the `PrerequisiteValidation` artifact object (excluding the sensitive token):
   ```ts
   {
     schema: "go.prerequisite-validation.v1",
     runId,
     provider: config.provider,
     username: config.username,
     defaultVisibility: config.defaultVisibility,
     apiEndpoint: config.apiEndpoint,
     gitVersion: rawGitVersionString,
     validatedAt: new Date().toISOString()
   }
   ```
3. Save this object atomically to `targetDir/prerequisite-validation.json`.
4. Concurrently, compute `inputHash` as the SHA-256 digest of the raw byte concatenation of:
   - The raw contents of `~/.go/config.json` (as read from disk, before parsing).
   - The raw stdout string output of `git --version`.
5. Save the `BootstrapTaskCheckpoint` object atomically to `targetDir/task-record.json`, using the calculated `inputHash` and fixing all other hash references (`repoCaptureHash`, `workflowPolicyHash`, `captureContextHash`) to the 64-zero sentinel hash value `sha256:0000000000000000000000000000000000000000000000000000000000000000`.

---

## 5. Example

### 5.1 Valid Provider Configuration File
Contents of `~/.go/config.json`:
```json
{
  "provider": "github",
  "token": "ghp_ExampleTokenBytesStructureGoesHere36",
  "username": "developer-user",
  "defaultVisibility": "private"
}
```

### 5.2 Saved Validation Artifact
Saved `prerequisite-validation.json`:
```json
{
  "schema": "go.prerequisite-validation.v1",
  "runId": "01JTESTRUNID00000000000000",
  "provider": "github",
  "username": "developer-user",
  "defaultVisibility": "private",
  "gitVersion": "git version 2.45.0",
  "validatedAt": "2026-07-16T15:28:00.000Z"
}
```

---

## 6. Edge cases

- **Malformed JSON**: If the configuration file contains invalid JSON syntax, catch the parser exception and wrap it in a clean error: "Failed to parse ~/.go/config.json" (resolves to `failed`).
- **No Token Redaction Bypass**: Under no circumstances should error logs or exceptions output the token bytes or validated value.

---

## 7. Constraints

- **No Token Serialization**: Under no circumstances should the token string be saved to the validation JSON, the task checkpoint, or printed in logs.
- **Fail-fast behavior**: Prerequisite checks must execute sequentially at the absolute beginning of the pipeline before any other bootstrap tasks or workspaces are initialized.

---

## 8. Integration

Executed as the first task of the bootstrap pipeline:

```ts
import { validatePrerequisites } from "./prerequisites.js";

const validation = await validatePrerequisites({ runId, artefactRoot });
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
