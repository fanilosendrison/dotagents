---
id: NIB-M-GO-PROJECT-DISCOVERY-REGISTRY
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/project-discovery-registry
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Project Discovery Registry

VegaCorp — July 2026

---

## 1. Purpose

This module establishes the static registry and precedence rules used by the `project-discovery-finalize` bootstrap task. It defines the file markers, configurations, default commands, package managers, and precedence mappings for declarative and heuristic project detection.

---

## 2. Inputs

This is a statically defined data module. It does not consume runtime inputs directly, but acts as a library configuration consumed by:
- [NIB-M-GO-PROJECT-DISCOVERY-FINALIZE.md](./NIB-M-GO-PROJECT-DISCOVERY-FINALIZE.md)

---

## 3. Outputs

Provides static configuration schemas and mappings. The structure exported by this registry conforms to:

```ts
type RegistryEcosystem = {
  name: string;
  priority: number; // Lower numbers have higher priority
  signals: {
    lockfiles: string[];
    manifests: string[];
  };
  toolingConfigs: {
    name: string;
    markerFiles: string[];
    commandTemplate: string[];
  }[];
  defaultCommands: {
    kind: "lint" | "test" | "typecheck" | "build";
    command: string[];
  }[];
};
```

---

## 4. Algorithm

### 4.1 Declarative Mapping (`STACK_EVAL.yaml`)
When declarative decisions are extracted from `STACK_EVAL.yaml`, they must be mapped to commands according to the following matrix:

| Decision Field | Value | Target Gate | PM-Runner Prefix Substitution |
|---|---|---|---|
| `linter` | `biome` | `lint` | `<pm-runner> biome check` |
| `linter` | `eslint` | `lint` | `<pm-runner> eslint .` |
| `linter` | `ruff` | `lint` | `uv run ruff check` or `ruff check` |
| `test_runner` | `bun:test` | `test` | `bun test` |
| `test_runner` | `jest` | `test` | `<pm-runner> jest` |
| `test_runner` | `vitest` | `test` | `<pm-runner> vitest` |
| `test_runner` | `pytest` | `test` | `uv run pytest` or `pytest` |
| `test_runner` | `cargo test`| `test` | `cargo test` |
| `type_checker` | `tsc` | `typecheck` | `<pm-runner> tsc --noEmit` |
| `type_checker` | `mypy` | `typecheck` | `uv run mypy` or `mypy` |
| `package_manager` | *any* | `build` | `<pm-runner> build` |

`<pm-runner>` prefix mapping based on `decisions.package_manager`:
- `bun` $\rightarrow$ `bun run`
- `npm` $\rightarrow$ `npx`
- `pnpm` $\rightarrow$ `pnpm exec`
- `yarn` $\rightarrow$ `yarn run`

### 4.2 Ecosystem Prioritization (Heuristic Scan)
When scanning a project heuristically, ecosystems must be checked in the following strict priority sequence:

1. **JavaScript/TypeScript** (Priority 1)
   - Manifests: `package.json`, `deno.json`, `deno.jsonc`
   - Lockfiles: `bun.lockb`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`
2. **Rust** (Priority 2)
   - Manifests: `Cargo.toml`
   - Lockfiles: `Cargo.lock`
3. **Go** (Priority 3)
   - Manifests: `go.mod`
   - Lockfiles: `go.sum`
4. **Python** (Priority 4)
   - Manifests: `pyproject.toml`, `requirements.txt`
   - Lockfiles: `uv.lock`, `poetry.lock`, `Pipfile.lock`
5. **C/C++** (Priority 5)
   - Manifests: `CMakeLists.txt`, `Makefile`, `meson.build`
6. **Java/Kotlin** (Priority 6)
   - Manifests: `pom.xml`, `build.gradle`, `build.gradle.kts`
7. **.NET** (Priority 7)
   - Manifests: `*.csproj`, `*.fsproj`
   - Lockfiles: `packages.lock.json`
8. **Ruby** (Priority 8)
   - Manifests: `Gemfile`
   - Lockfiles: `Gemfile.lock`
9. **PHP** (Priority 9)
   - Manifests: `composer.json`
   - Lockfiles: `composer.lock`
10. **Elixir** (Priority 10)
    - Manifests: `mix.exs`
    - Lockfiles: `mix.lock`
11. **Generic Task Runners** (Priority 11)
    - Manifests: `Makefile`, `justfile`, `Taskfile.yml`, `Taskfile.yaml`

### 4.3 Command Precedence Rules
- **Specific vs Generic**: If a specific ecosystem command (e.g. `cargo clippy` or `npm run lint`) is registered for a given kind (e.g., `lint`), it takes precedence over any matching command from a generic task runner (e.g. `make lint`).
- **Audit Trails**: The generic command must not be deleted from evidence. It is saved in the discovery log with status `disabled-by-precedence` and a reference to the active command.

---

## 5. Example

### 5.1 Static Registry Lookup for Rust Ecosystem
```json
{
  "name": "rust",
  "priority": 2,
  "signals": {
    "manifests": ["Cargo.toml"],
    "lockfiles": ["Cargo.lock"]
  },
  "defaultCommands": [
    {
      "kind": "test",
      "command": ["cargo", "test"]
    },
    {
      "kind": "build",
      "command": ["cargo", "build"]
    }
  ],
  "toolingConfigs": [
    {
      "name": "clippy",
      "markerFiles": ["clippy.toml"],
      "commandTemplate": ["cargo", "clippy"]
    },
    {
      "name": "rustfmt",
      "markerFiles": ["rustfmt.toml"],
      "commandTemplate": ["cargo", "fmt", "--check"]
    }
  ]
}
```

---

## 6. Edge cases

- **Multi-language repositories**: If files matching multiple ecosystems (e.g. a Python backend with a TypeScript frontend) are detected in the same directory, all relevant ecosystems are registered. Commands are generated for each, and deduplicated using precedence rules within each respective folder scope.

---

## 7. Constraints

- **Static Declarations Only**: This registry contains only static definitions, lists, and templates. It must not invoke any disk I/O, regex evaluations, or system execution.

---

## 8. Integration

Imported by the Project Discovery task to evaluate files found in the workspace:

```ts
import { ECOSYSTEM_REGISTRY } from "./registry.js";
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
