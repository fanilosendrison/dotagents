---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 10
name: "Gate D — Operational Completeness"
role_description: "Operational Auditor"
inputs:
  - path: "/specs/"
    format: "markdown-cdd-corpus"
  - path: ".cdd-audit/LATEST.txt"
    format: "pointer-to-run-dir"
outputs:
  - path: "$RUNDIR/"
    format: "markdown-operational-report"
dependencies:
  - "~/.agents/conventions/cubits-design-doc.md"
unlock_condition: "Step 04 is CLEAN (all contracts match, vocabulary consistent)"
---

# Step 5: Operational Completeness

Lis `$RUNDIR/coherence-report.md` pour connaître l'état du step 4.

## Question

> Are all production constraints explicit enough for the NIB generator to produce infrastructure and deployment sections without guessing?

## Persona

**SRE OPERATOR** — *"Do I know how the system recovers from a crash?"*

## Unlock Condition

This step only executes if **Step 04 (Coherence) is CLEAN**. If Step 04 is blocked, do not execute. Report: *"Operational audit blocked: Step 04 (Coherence) is not clean."*

## Execution

Fan out **one sub-agent per CDD**. Each sub-agent receives a single CDD and applies the 7-point operational checklist.

### Sub-Agent Instructions (per CDD)

**Context:** Fresh. Provide only the assigned CDD.

**Posture:**
> *"The NIB generator cannot guess how to operate this system in production. If a constraint is not explicitly in the CDD, the deployment will be incomplete. Production is unforgiving."*

**Task:**
For the assigned CDD, verify all 7 operational concerns:

#### 4.1 Security
Access constraints, trust boundaries, authentication/authorization requirements. If the component handles data or exposes an interface and security is not addressed → 🔴 Blocker.

#### 4.2 Idempotence and State
Retry management, idempotence keys, state recovery after crash. If the component is stateful and idempotence is not addressed → 🔴 Blocker.

#### 4.3 Cleanup
Resource teardown logic. If the component acquires resources (files, connections, locks), the cleanup path must be defined. Undefined cleanup = 🔴 Blocker.

#### 4.4 Infrastructure and Environment
OS targets, binary dependencies, network constraints, storage assumptions. If the CDD assumes an environment without stating it → 🔴 Blocker.

#### 4.5 Performance Constraints
If performance matters, quantified thresholds must exist. `"Must be fast"` is not a constraint. `"< 200ms p99"` is.

#### 4.6 Observability
If the system must be monitored, the signals (metrics, traces, structured logs) must be specified. Unspecified observability for a production component = 🟡 Minor.

#### 4.7 Migration and Compatibility
If the component replaces or modifies an existing system, the migration path and backward compatibility rules must be defined. Undefined migration path = 🔴 Blocker.

**Classification rules:**
- If a concern is not applicable (e.g., a stateless CDD-N has no migration concern), mark it N/A with a one-line justification. Do not flag N/A concerns as blockers.

## Post-Sub-Agent Consolidation

After all sub-agents complete, consolidate per-CDD:

- Merge all operational findings.
- For each CDD, produce a 7-point status row (PASS / BLOCKED / N/A).
- Apply the Abort Threshold: if a CDD has 4+ operational 🔴 Blockers, recommend return to drafting.

## Clean Criterion

Every operational constraint relevant to each component is explicitly defined. The NIB generator can produce Infrastructure & Environment sections without inventing.

## Output

Write `operational-report.md` to `$RUNDIR/`.

```markdown
# Step 4 — Operational Report

## Per-CDD Status

| CDD | Security | Idempotence | Cleanup | Infra/Env | Perf | Observability | Migration | Verdict |
|-----|----------|------------|---------|-----------|------|--------------|-----------|---------|
| CDD-O-NAME | PASS | BLOCKED | PASS | PASS | N/A | MINOR | N/A | BLOCKED |

## Findings

### 🔴 Blockers
- **[CDD]:** 4.2 Idempotence — retry policy undefined, component is stateful — Category 1
- **[CDD]:** 4.3 Cleanup — lock acquisition has no teardown path — Category 1

### 🟡 Minor
- **[CDD]:** 4.6 Observability — production component, no metrics specified — Category 1

### Return to Drafting (Abort Threshold)
- **[CDD]:** N operational 🔴 Blockers. Recommend return to drafting.

## Step 4 Verdict: CLEAN / BLOCKED

- CLEAN: all relevant constraints defined → proceed to Step 6.
- BLOCKED: missing constraint → fix before advancing.
```
