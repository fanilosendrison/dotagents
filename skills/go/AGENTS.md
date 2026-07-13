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
    ├── adr/                       # Active Architecture Decision Records (6 ADRs)
    ├── briefs/stage-harness/      # Normative Implementation Briefs (NIB, DC, NX)
    ├── legacy/                    # Historical documents (pre stage/phase vocabulary split)
    └── working/                   # In-progress design specs
        ├── workflow/              # Canonical vocabulary, hashing, contract, concurrency
        ├── startup/               # run-init, workspace-setup, repo discovery
        ├── stages/                # implementation, agent-conduct, mechanical-gates, review
        ├── artifacts/             # Workflow artifact types
        ├── packaging/             # package-plan, package-verify, PRs
        └── review/                # ideal-review, PR CI gate
```

## 3. Manual Testing and Temporary Repositories
When running manual command-line dry-runs or test scripts that initialize local Git repositories (e.g., via agent command execution), always perform them inside `test-temp/` or `tmp/` directories. 

These directories are ignored by the local `.gitignore` to prevent Git from treating empty initialized subdirectories as untracked submodules.
