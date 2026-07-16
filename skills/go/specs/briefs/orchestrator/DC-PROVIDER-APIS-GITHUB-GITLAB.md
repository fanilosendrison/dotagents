---
id: DC-PROVIDER-APIS-GITHUB-GITLAB
type: dependency-contract
version: "1.0.0"
dependency_version: "GitHub REST v3 / GitLab REST v4"
scope: provider-apis
status: active
consumers: [claude-code]
referenced_by:
  - NIB-S-GO-TURNLOCK-ORCHESTRATOR
  - NIB-M-GO-WORKSPACE-SETUP-WORKTREE
superseded_by: []
---

# Dependency Contract — Provider APIs (GitHub & GitLab)

VegaCorp — July 2026

---

## 0. Identity

- **Component name**: GitHub REST API v3 / GitLab REST API v4.
- **Version**: GitHub API version `2022-11-28`, GitLab REST API `v4`.
- **Source**: External HTTP remote provider endpoints.
- **Role**: Allows remote repository creation (when initializing a new workspace project) and credentials setup during the `/go` workspace setup phase.

---

## 1. Interface

The workspace-setup task communicates with the providers using standard HTTPS REST calls.

### 1.1 GitHub Project Creation
```http
POST /user/repos HTTP/1.1
Host: api.github.com
Authorization: Bearer <GitHub_PAT_Token>
X-GitHub-Api-Version: 2022-11-28
Content-Type: application/json

{
  "name": "my-new-project-repository",
  "private": true,
  "auto_init": false
}
```
If creating under an organization namespace:
```http
POST /orgs/{org}/repos HTTP/1.1
```

### 1.2 GitLab Project Creation
```http
POST /api/v4/projects HTTP/1.1
Host: gitlab.com
Authorization: Bearer <GitLab_PAT_Token>
Content-Type: application/json

{
  "name": "my-new-project-repository",
  "visibility": "private",
  "initialize_with_readme": false
}
```

---

## 2. Behavioral Contract

- **Empty Repositories Only**: Creation parameters must enforce `auto_init: false` (GitHub) or `initialize_with_readme: false` (GitLab). This guarantees the remote repository remains unborn and clean, preventing history collisions during initial git pushes.
- **Privacy Enforcement**: Repository privacy flags (`private: true` or `visibility: "private"`) must be explicitly declared in payloads to prevent accidental leaks of code.
- **Auth Headers Configuration**:
  - GitHub: header `Authorization: Bearer <TOKEN>`.
  - GitLab: header `Authorization: Bearer <TOKEN>` or `PRIVATE-TOKEN: <TOKEN>`.
- **Endpoint Defaults**: Defaults are `https://api.github.com` and `https://gitlab.com`. Consuming modules must support custom endpoints read from `ProviderConfig` for enterprise self-hosted environments.

---

## 3. Error Semantics

HTTP response codes must be checked explicitly:

| Response Code | Meaning | Consumer Action |
|---|---|---|
| `201 Created` | Project successfully registered | Proceed with remote push. |
| `401 Unauthorized` | Invalid PAT token | Throw a blocking prerequisite error. |
| `403 Forbidden` | Insufficient token scopes | Throw a blocking permission error. |
| `404 Not Found` | Target organization namespace does not exist | Abort with invalid target error. |
| `409 Conflict` | Repository name already exists on target account | Throw a blocking error (errored) as required by workspace-setup spec. |

---

## 4. Integration patterns

The configuration parameters are read from the global client file `~/.go/config.json`.
HTTP calls must be executed using the native `fetch` runtime APIs of the execution environment (Node / Bun). No heavy external HTTP libraries (such as `axios`) are allowed.

---

## 5. Consumer constraints

- **Token Protection Invariant**: Token strings parsed from configuration **must never** be written to task checklists, checkpoints, log records, stdout logs, or exception messages. If an error occurs, print only the parsed domain or token prefix/length, redacting the token bytes.
- **Endpoint Safety**: Custom API endpoints must use the secure `https://` protocol; unencrypted `http://` calls are rejected.

---

## 6. Known limitations

- **Phase 1 Boundary**: Advanced interactions (such as Pull Request publishing, CI checks monitoring, branch lock overrides) are out of scope for Phase 1. This contract restricts API usage to simple project registration.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
