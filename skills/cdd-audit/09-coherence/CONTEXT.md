---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 9
name: "Gate C — Inter-CDD Coherence"
role_description: "Coherence Auditor"
inputs:
  - path: "/specs/"
    format: "markdown-cdd-corpus"
  - path: ".cdd-audit/LATEST.txt"
    format: "pointer-to-run-dir"
outputs:
  - path: "$RUNDIR/"
    format: "markdown-coherence-report"
dependencies:
  - "~/.agents/conventions/cubits-design-doc.md"
unlock_condition: "Step 03 is CLEAN (correctly factored, all boundaries typed)"
---

# Step 4: Inter-CDD Coherence

Lis `$RUNDIR/structural-report.md` pour connaître l'état du step 3.

## Question

> Do the CDDs fit together without contradictions, vocabulary drift, or silent external dependencies?

## Persona

**ARCHITECT** — *"Do the components fit together without friction?"*

## Unlock Condition

This step only executes if **Step 03 (Structural) is CLEAN**. If Step 03 is blocked, do not execute. Report: *"Coherence audit blocked: Step 03 (Structural) is not clean."*

Additionally, this step requires **at least 2 CDDs with defined I/O contracts** to perform contract matching. If only one CDD exists, report: *"Coherence audit skipped: only one CDD in corpus. No inter-CDD contracts to match."* and mark the step as CLEAN (nothing to validate).

## Execution

This step uses a **single sub-agent** with the entire corpus. Coherence checks are inherently cross-document.

### Sub-Agent Instructions

**Context:** Fresh. Provide the entire `/specs` corpus and the Step 01 behavioral report (for `SPEC_CONFLICT` cross-references).

**Posture:**
> *"Every inter-CDD connection is a contract. If upstream output does not mechanically match downstream input, the system breaks at the boundary. If the same concept wears two names, the NIB generator produces two incompatible schemas."*

**Task:**
Apply the four coherence checks below.

### 3.1 Contract Matching

For every upstream→downstream pair in the corpus:

- Upstream outputs must exactly match downstream inputs. Flag any type or semantic mismatch.
- **Upstream Cleanup that destroys downstream resources:** flag any upstream Cleanup logic that destroys physical or logical resources required by a downstream node.

For each mismatch, specify the upstream CDD/output field, downstream CDD/input field, and the nature of the mismatch.

### 3.2 Vocabulary Consistency

The same concept must use the same term everywhere.

- If one CDD says `"user"` and another says `"account"` for the same entity → 🔴 Blocker.
- If one CDD says `"payment"` and another says `"transaction"` for the same operation → 🔴 Blocker.

For each drift, propose the canonical term.

### 3.3 STD/CNV Compliance

No CDD may contradict an existing permanent Standard or Convention.

- Flag any divergence from an active STD or CNV.
- Silent override (override without explicit justification) = 🔴 Blocker.
- If no STDs or CNVs exist, report this check as N/A.

### 3.4 Declare Unverified Areas

If a CDD references a `STD`, `CNV`, or upstream `CDD` that you **cannot find or read** in the provided corpus:

- Explicitly declare it as **UNVERIFIED**.
- For each unverified reference, state which CDD references it, what it references, and what validation is blocked.

## Post-Sub-Agent Consolidation

Collect the sub-agent's findings. Cross-reference any `SPEC_CONFLICT` flags from Step 01 that pointed to inter-CDD issues — verify they are resolved or confirmed by the Coherence step.

## Clean Criterion

All inter-CDD contracts match, vocabulary is consistent across the corpus, no STD/CNV violation exists, and every external reference is either verified or explicitly declared unverified.

## Output

Write `coherence-report.md` to `$RUNDIR/`.

```markdown
# Step 3 — Coherence Report

## Contract Matching

| Upstream CDD | Output | Downstream CDD | Input | Match? | Finding |
|-------------|--------|----------------|-------|--------|---------|
| CDD-N-A | PaymentResult { id, status } | CDD-O-B | PaymentOutcome { id, state } | ❌ | Semantic mismatch: "status" vs "state" |

### 🔴 Blockers
- **[Upstream] → [Downstream]:** [description] — Category [1/2]

## Vocabulary Consistency

| Term A (CDD) | Term B (CDD) | Proposed Canonical |
|-------------|-------------|-------------------|
| "user" (CDD-A) | "account" (CDD-B) | "user" |

### 🔴 Blockers
- **Vocabulary drift:** [details] — Category 2

## STD/CNV Compliance

| CDD | STD/CNV | Compliance | Finding |
|-----|---------|-----------|---------|
| CDD-N-NAME | STD-WORKFLOW | ❌ | Contradicts artifact naming rule |

### 🔴 Blockers
- **[CDD]:** Silent contradiction of [STD] — Category [1/2]

## Unverified References

| CDD | References | Status | Blocked Validation |
|-----|-----------|--------|-------------------|
| CDD-O-NAME | STD-SECURITY (not in corpus) | UNVERIFIED | Cannot validate security boundary contracts |

## Step 3 Verdict: CLEAN / BLOCKED

- CLEAN: all contracts match, vocabulary consistent, no violations → proceed to Step 5.
- BLOCKED: mismatch or violation → fix before advancing.
```
