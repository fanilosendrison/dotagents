# `/go` Skill Development Guidelines

This document contains essential context and rules for agents working on the `/go` skill codebase.

## 1. Local Testing and Git Hooks

### Problem
The local testing suite (`bun test`) creates temporary Git repositories on the fly. By default, Git inherits the global configuration from the host machine, including global hooks (e.g., `core.hooksPath` set to `~/.gravity/git-hooks`). This causes local test commits to be blocked or rejected by host enforcers.

### Solution
All test repository commit helper functions inside [git-fixture.ts](file:///Users/famillesendrison/.agents/skills/go/tests/stage-harness/helpers/git-fixture.ts) must bypass host hooks by passing the `--no-verify` flag to `git commit`.

Ensure any new test fixture commit uses `--no-verify`:
```typescript
await runGit(workDir, ["commit", "-m", "initial", "--no-verify"]);
```

## 2. Folder Structure

```
skills/go/
├── .gitignore                     # Ignores node_modules/, test-temp/, tmp/
├── AGENTS.md                      # You are here — agent development guidelines
├── SKILL.md                       # Skill declaration + instruction loader
├── bun.lock
├── package.json
├── tsconfig.json
├── node_modules/                  # Dependencies (zod)
├── src/
│   └── stage-harness/             # Standalone stage execution harness
│       ├── index.ts               # Public entry point (StageInput → StageOutput)
│       ├── run-stage.ts           # Core pipeline orchestration
│       ├── errors.ts              # Typed error classes
│       ├── schemas.ts             # Zod contracts (StageInput, StageOutput, WorkSession)
│       ├── types.ts               # TypeScript types derived from schemas
│       ├── modules/               # Sequential harness stages
│       │   ├── assembly.ts
│       │   ├── evidence.ts
│       │   ├── invocation.ts
│       │   ├── persistence.ts
│       │   ├── preflight.ts
│       │   └── state.ts
│       └── runtime/               # Low-level utilities
│           ├── git.ts
│           ├── hash.ts
│           ├── path-validation.ts
│           └── thrown-values.ts
├── tests/
│   └── stage-harness/
│       ├── acceptance/            # Behavioral validation of the harness pipeline
│       │   └── run-stage.acceptance.test.ts
│       ├── fixtures/              # Preconfigured test data (repos, stages)
│       │   ├── repositories.ts
│       │   └── stages.ts
│       ├── helpers/               # Test utilities
│       │   ├── assert-stage-output.ts
│       │   ├── fault-injection.ts
│       │   ├── git-fixture.ts     # Temporary git repos (--no-verify, see §1)
│       │   ├── hash-expectations.ts
│       │   └── temp-artifacts.ts
│       └── properties/            # Property-based tests
│           └── run-stage.properties.test.ts
└── specs/
    ├── CONTEXT.md                 # Spec index — canonical vocabulary, ADRs, NIBs
    ├── roadmap.md                 # Development roadmap
    ├── adr/                       # Active Architecture Decision Records (13 ADRs)
    │   ├── ADR-go-workflow-vocabulary.md
    │   ├── ADR-go-stages-vs-turnlock-phases.md
    │   ├── ADR-go-stage-harness-v1-non-goals.md
    │   ├── ADR-go-stage-output-envelope-and-typed-business-artifacts.md
    │   ├── ADR-go-physical-worktree-isolation.md
    │   ├── ADR-go-token-propagation-git-askpass.md
    │   ├── ADR-go-mandatory-provider-config-fail-fast.md
    │   ├── ADR-go-prerequisite-validation.md
    │   ├── ADR-go-implicit-repo-capture-control.md
    │   ├── ADR-go-repo-capture-robustness.md
    │   ├── ADR-go-workspace-setup-skip-setup.md
    │   ├── ADR-go-review-before-packaging-with-package-verify.md
    │   └── ADR-go-workspace-agnostic-terminology.md
    ├── briefs/                    # Normative Implementation Briefs (NIB)
    │   └── stage-harness/
    ├── legacy/                    # Historical documents (pre stage/phase vocabulary split)
    │   └── working-pre-semantic-turnlock-split/
    └── working/                   # In-progress design specs
        ├── standards/             # Canonical vocabulary, hashing, conventions
        │   ├── canonical-vocabulary.md
        │   ├── canonical-hashing.md
        │   ├── external-primitives.md
        │   ├── software-design-workflow.md
        │   └── multi-agent-concurrency.md
        ├── contracts/             # Workflow contracts
        │   ├── go-workflow-contract.md
        │   └── workflow-artifacts.md
        ├── run-init/              # Bootstrap tasks (prerequisite-validation → project-discovery-finalize)
        │   ├── run-init.md
        │   ├── prerequisite-validation.md
        │   ├── repo-capture.md
        │   ├── dirty-state-capture.md
        │   ├── run-capture.md
        │   ├── workspace-setup.md
        │   ├── workspace-setup.worktree.md
        │   ├── workspace-setup.sandbox.md
        │   ├── repo-discovery-draft.md
        │   └── project-discovery-finalize.md
        └── stages/                # Métier stages (implementation → package-and-publish)
            ├── implementation.md
            ├── agent-conduct-check.md
            ├── mechanical-gates.md
            ├── review-remediation.md
            ├── ideal-review.md
            ├── pr-ci-review.md
            └── package-and-publish.md
```

## 3. Manual Testing and Temporary Repositories
When running manual command-line dry-runs or test scripts that initialize local Git repositories (e.g., via agent command execution), always perform them inside `test-temp/` or `tmp/` directories. 

These directories are ignored by the local `.gitignore` to prevent Git from treating empty initialized subdirectories as untracked submodules.

## 4. macOS Constraint for OCI Sandbox (Phase 1.b)

### Problem
The `workspace-setup.sandbox.md` strategy requires an OCI runtime (OrbStack, Colima, Docker Engine). All current OCI runtimes for macOS require **macOS 13 (Ventura) or newer**. The development environment runs macOS Monterey 12.7.6.

### Consequence
Phase 1.b (OCI Sandbox strategy) implementation is **blocked** until macOS is upgraded to Ventura (13) or Sonoma (14). Phase 1.a (Git Worktree strategy) is unaffected — it is 100% host-side and requires only Git ≥ 2.18.

### Verified runtimes (all blocked on Monterey 12.7.6)
| Runtime        | Minimum macOS  |
|----------------|----------------|
| OrbStack       | macOS 14       |
| Colima         | macOS 13       |
| Docker Desktop | macOS 13       |
| Podman machine | macOS 13       |
| Lima           | macOS 13       |

### References
- [`specs/roadmap.md`](./specs/roadmap.md) Phase 1.b — blocked notice with cross-reference
- [`specs/working/run-init/workspace-setup.sandbox.md` §2](./specs/working/run-init/workspace-setup.sandbox.md#2-prérequis-techniques) — macOS constraint callout
- [`operational-rules/implementation.md` §5](../../operational-rules/implementation.md) — environmental constraints (No Docker on this system)
