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

## 2. Codebase Structure
- **src/stage-harness/**: Implementation of the stage execution pipeline.
  - `run-stage.ts`: Core orchestration logic.
- **tests/stage-harness/**: Acceptance and property tests.
  - `acceptance/`: Direct behavioral validation of the harness pipeline.
  - `helpers/git-fixture.ts`: Manages temporary repository setups.
- **specs/**: Normative Implementation Briefs (NIBs) and architectural specifications.

## 3. Manual Testing and Temporary Repositories
When running manual command-line dry-runs or test scripts that initialize local Git repositories (e.g., via agent command execution), always perform them inside `test-temp/` or `tmp/` directories. 

These directories are ignored by the local `.gitignore` to prevent Git from treating empty initialized subdirectories as untracked submodules.
