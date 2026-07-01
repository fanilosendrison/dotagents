---
id: NIB-T-GIT-COMMITS-PUSH
type: nib-tdd
version: "1.0.0"
scope: git-commits-push
status: active
consumers: [claude-code]
superseded_by: []
---

# 🧪 NIB-T — TDD Tests Brief : git-commits-push-TL

*VegaCorp — July 2026*

---

## 1. Overview

This document defines the Acceptance Tests, Property Tests, Contract Invariants, and Fixtures required to validate the `git-commits-push-TL` system.

Following the Implicit-Free Execution (IFE) methodology, these tests must be implemented **before** any production code is written (RED phase of the Construction Sequence) and must verify the **observable behavior** of the system.

---

## 2. Test Fixtures & Environment Setup

To ensure hermetic testing, the test suite must provide helpers to generate isolated environments:

### `GitRepoFixture`
- **Purpose**: Creates an isolated, temporary Git repository on the local filesystem.
- **Capabilities**:
  - `init()`: Initialize a new git repository.
  - `commit(message)`: Create a commit to set up a history.
  - `writeAndStage(filename, content)`: Write a file and run `git add`.
  - `setRemote(url)`: Mock a remote origin.
  - `checkoutDetached()`: Put the repository in a detached HEAD state.

### `MockTurnlockEnvironment`
- **Purpose**: Simulates the filesystem state provided by Turnlock orchestrator.
- **Capabilities**:
  - Provides a temporary `<runDir>`.
  - `writeSettings(settingsObj)`: Write a `settings.json` mock.
  - `writeLLMResult(jobId, resultObj)`: Write a mock `results/commit-jobs-0/${jobId}.json` to simulate Phase 3 LLM completion for a specific job.

---

## 3. Acceptance Tests (Behavior-Driven)

These tests validate the happy path and expected user flows of the CLI.

### Test A1: End-to-End Initial Run (Phases 1, 2, 3)
- **Given** a directory containing two git repositories: `repo-clean` (no changes) and `repo-dirty` (staged changes).
- **Given** valid settings in `settings.json`.
- **When** the system is executed without `--resume`.
- **Then**:
  - It discovers only `repo-dirty`.
  - It extracts the diff and computes the `diffHash`.
  - It delegates an `agent-batch` to Turnlock, which automatically writes a manifest `delegations/commit-jobs-0.json` containing the job (with prompt payload serialized as JSON).
  - It automatically writes a `state.json` storing the FSM state.
  - It outputs exactly one `@@TURNLOCK@@` delegation protocol block to stdout.
  - It exits with code 0.

### Test A2: End-to-End Resume Run (Phases 4, 5)
- **Given** a previously saved `state.json` mapping `repo-dirty` to `SUCCESS` in Phase 2 with a specific `diffHash`.
- **Given** a mock LLM output in `results/commit-jobs-0/repo-dirty.json` containing a valid commit message matching `CommitJobResultSuccess` schema.
- **Given** the repository `repo-dirty` still has the identical `diffHash`.
- **When** the system is executed with `--resume`.
- **Then**:
  - It commits the changes using the provided message.
  - It attempts to push (if `autoPush` is true).
  - It prints the Phase 5 execution report (`=== TURNLOCK EXECUTION REPORT ===`).
  - It exits with code 0.

---

## 4. Property Tests (Anti-Cheat / Edge Cases)

These tests enforce resilience against boundary conditions and state mutations.

### Test P1: DiffHash Race Condition Prevention (Phase 4)
- **Given** a resume execution with a valid LLM result.
- **Given** the current state of the repository has *changed* since Phase 2 (e.g., a new file was added manually by the user, changing the `diffHash`).
- **When** the system executes Phase 4 (`--resume`).
- **Then**:
  - The system MUST NOT execute the commit.
  - It must update the `repo-dirty` state to `FAILED` with a race condition error.
  - The Phase 5 report must show `repo-dirty` as failed.

### Test P2: Detached HEAD Exclusion (Phase 1)
- **Given** a repository in a "Detached HEAD" state with uncommitted changes.
- **When** Phase 1 runs.
- **Then** the repository is excluded from discovery and does not proceed to Phase 2.

### Test P3: Git Push Upstream Fallback (Phase 4)
- **Given** a repository with no remote named `origin`, but a remote named `custom-remote`.
- **Given** the current branch has no upstream branch configured.
- **When** Phase 4 executes with `autoPush` true.
- **Then** the system falls back to pushing using `git push -u custom-remote <branch>` and succeeds.

### Test P4: Git Push Skip No-Remote (Phase 4)
- **Given** a repository with no remotes configured.
- **When** Phase 4 executes.
- **Then** the push step is gracefully skipped, and the repository status is set to `SUCCESS`.

---

## 5. Contract Invariants (Dependencies & Failures)

These tests ensure compliance with Dependency Contracts and Global Invariants.

### Test I1: Secret Scanner Fail-Closed (DC-SECRET-SCANNER)
- **Given** a repository with staged changes containing a mocked secret (e.g., `AWS_KEY=AKIA...`).
- **When** Phase 2 processes this repository.
- **Then**:
  - The worker for this repository marks it as `FAILED`.
  - The execution does NOT halt for other parallel repositories.
  - The `manifest` generated in Phase 3 does not include this repository.

### Test I2: Non-Interactive Shell Safety (Global Invariant I1)
- **Given** a repository where `git push` requires interactive authentication (e.g., missing SSH key).
- **When** Phase 4 executes the push.
- **Then**:
  - `git push` must fail immediately due to `GIT_TERMINAL_PROMPT=0`.
  - The system must not hang waiting for user input.
  - The failure is gracefully recorded in `state.json` and printed in the Phase 5 report.

### Test I3: Parallel Validation Isolation (Phase 2 & 4)
- **Given** three repositories: `repo-A` (valid changes), `repo-B` (test suite fails), and `repo-C` (valid changes).
- **When** Phase 2 is executed.
- **Then**:
  - `repo-B` is marked as `FAILED` with a test execution error.
  - `repo-A` and `repo-C` are marked as `SUCCESS`.
  - The manifest generated for Phase 3 contains only `repo-A` and `repo-C`.
  - Processes for validation of all three repositories must execute concurrently without blocking one another.

### Test I4: Turnlock stdout Compliance (DC-TURNLOCK)
- **Given** a full execution of the orchestrator (either initial or resume).
- **When** the skill performs discovery, parallel validation, or git execution.
- **Then**:
  - The skill MUST NOT write any arbitrary logs (e.g., `console.log`) to `stdout`.
  - All textual logs MUST be written to `stderr` or using Turnlock's `io.logger`.
  - The only data ever written to `stdout` must be the final `@@TURNLOCK@@` protocol blocks generated by `runOrchestrator`.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
