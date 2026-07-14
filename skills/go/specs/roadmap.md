# `/go` Skill Development Roadmap

---

## Phase 1: Orchestrator Skeleton & `run-init` Bootstrap (Pragmatic Core)
* **Goal**: Establish a minimal, working Turnlock skeleton and implement the initial bootstrap logic.
* **Steps**:
  1. **Minimal State Schema**: Define a minimal `WorkflowState` Zod schema containing only the base properties (e.g., `runId`, `workspaceRoot`, and `artefactRoot`).
  2. **Minimal FSM Scaffold**: Create the Turnlock orchestrator in `src/orchestrator/index.ts` with only two initial phases:
     - `run-init`: The bootstrap phase.
     - `dummy-phase`: A temporary placeholder phase to represent "the rest of the workflow" and keep the FSM compileable.
  3. **Implement `run-init`**: Build the bootstrap logic inside the `run-init` phase:
     - Read the initial bootstrap context (`BootstrapState`).
     - Initialize paths and resolve directories (`runDir`, `artefactRoot`).
     - Write the run-ownership marker file (`run-init-ownership.json`).
     - Validate the target repository root.
     - Transition to the `dummy-phase` to verify state transfer.
  4. **Verify Onboarding**: Write integration tests verifying that the FSM starts, completes `run-init` successfully, and transitions to the placeholder phase with the correct base state.

---

## Phase 2: Incremental Stage Specification & FSM Discovery
* **Goal**: Specify, implement, and dynamically wire each stage one by one into the orchestrator, letting the FSM structure grow naturally.
* **Cycle for Each Stage (e.g., `implementation-settlement`, `mechanical-gates`)**:
  1. **NIB Specification**: Write the Normative Implementation Brief for the stage. At this step, define:
     - The input configuration this stage needs.
     - What errors, statuses, or evidence it returns.
     - What decisions it needs to make (e.g., retry on merge conflicts, trigger remediation loops, or proceed).
  2. **State & Transition Discovery**:
     - Enrich the global `WorkflowState` Zod schema with the variables discovered in step 1.
     - Define the new Turnlock phase (e.g., `turnlockImplementationPhase`) that wraps the stage function.
  3. **Standalone Function & Test**:
     - Write the standalone async stage function conforming to the `Stage` contract.
     - Test the stage function in isolation with custom tests using `runStage` and the `stage-harness`.
  4. **Orchestrator Wiring**:
     - Replace the temporary FSM transitions/placeholders with the newly defined Turnlock phase and configure its real success and failure transitions in the FSM.

---

## Phase 3: E2E Integration & Verification
* **Goal**: Validate the complete FSM execution chain from onboarding to pull request publishing once all stages are wired.
* **Steps**:
  1. **Transition Coverage**: Verify FSM recovery paths (such as retry loops on conflicts or remediation routes on code verification failures).
  2. **E2E Integration Tests**: Run the final orchestrator on simulated repository fixtures, asserting that the FSM successfully traverses all stages and publishes correctly formatted commits and pull requests.
