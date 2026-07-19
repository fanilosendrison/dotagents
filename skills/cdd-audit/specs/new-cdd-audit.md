# CDD Audit: Extraction-Readiness Protocol

## Purpose

A CDD audit determines whether a corpus of Cubits Design Docs is **extraction-ready**: ready for mechanical NIB generation.

A corpus is extraction-ready when an agent can translate every CDD into NIBs (NIB-S, NIB-M, NIB-T) without inventing any behavior, boundary, or constraint.

The audit evaluates three sequential gates. A corpus blocked at any gate cannot advance to the next.

---

## Core Invariant

The CDD-to-NIB translation must behave like a compilation, not a creative act.

If the NIB generator must make a product decision, invent an oracle, guess a boundary, or assume an environment constraint, the CDD has failed. The audit exists to catch these failures before the translation begins.

---

## Gate 1 — Behavioral Completeness

### Question

> For every behavior described in this corpus, can an agent derive a test that distinguishes a correct implementation from an incorrect one, using only what the CDD provides?

### What to verify

For each behavioral requirement in the corpus:

1. **Oracle derivability.** The expected result must be dictated by the CDD, not invented by the agent. Flag any behavior whose expected result requires a product assumption.
2. **Precondition controllability.** The test must be able to place the system in the required initial state. If a precondition depends on an unspecified external factor, flag it.
3. **Effect observability.** The consequence of the behavior must be observable (return value, state change, event, error). If the CDD says "the system handles this correctly" without specifying what "correctly" produces, flag it.
4. **Invariant precision.** Every invariant must be mechanically verifiable. "Must be fast" is not an invariant. "Response time < 200ms at p99" is.
5. **Edge case coverage.** Every conditional branch in the logical pipeline must have a defined outcome. If a branch says "the agent will determine dynamically" or "adapt based on context" without a strict fallback, flag it as a blocker.
6. **Error behavior.** Every failure mode must map to a specific recovery action or error output. Unmapped failure modes are blockers.

### Classification

For each requirement, assign one of:

| Status | Meaning |
| ----------------------- | ----------------------------------------- |
| `TDD_READY` | Oracle derivable, controllable, observable |
| `SPEC_GAP` | Expected result missing or undefined |
| `SPEC_AMBIGUITY` | Multiple plausible interpretations exist |
| `SPEC_CONFLICT` | Contradicts another normative source |
| `SPIKE_NEEDED` | Behavior must be discovered first |

### Gate 1 passes when

Every behavioral requirement is either `TDD_READY` or explicitly tagged with a blocking status and a resolution path. Zero unclassified requirements remain.

---

## Gate 2 — Structural Completeness

### Question

> Is the corpus factored correctly, and are all system boundaries explicit enough for the NIB generator to produce exact type contracts?

### What to verify

#### 2.1 Factorization

1. **DAG split.** If a CDD describes multiple sequential or parallel steps with distinct I/O boundaries, it must be split into a CDD-O (Orchestrator) and CDD-N (Node) documents. A monolithic CDD that orchestrates AND executes is a blocker.
2. **Strategy split.** If a CDD dictates a specific technological approach where alternatives exist, extract a CDD-I (Interface) and move the technology to a CDD-S (Strategy).
3. **Global rule extraction.** If a CDD defines a format, naming convention, vocabulary, or invariant consumed by other components, extract it into a permanent STD or CNV. A CDD must not legislate for external systems.

#### 2.2 System boundaries

For every CDD in the corpus, verify:

4. **Input contracts.** Exact data types consumed by the component. The NIB generator must be able to produce Zod schemas directly from these definitions. If inputs are described in prose only ("receives some user data"), flag it.
5. **Output contracts.** Exact data types produced. Same standard as inputs.
6. **Upstream/downstream identification.** Every CDD must explicitly name its upstream providers and downstream consumers. If a CDD references an input without stating which component produces it, flag it.
7. **Event contracts.** If the component publishes or subscribes to events, the event schema and semantics must be explicit.
8. **Error contracts.** The error types returned or propagated at each boundary must be defined.

#### 2.3 Inter-CDD coherence

9. **Contract matching.** Upstream outputs must match downstream inputs across the entire corpus. Flag any mismatch.
10. **Vocabulary consistency.** The same concept must use the same term everywhere. If one CDD says "user" and another says "account" for the same entity, flag it.
11. **STD/CNV compliance.** No CDD may contradict an existing permanent Standard or Convention.

### Gate 2 passes when

The corpus is factored into correctly typed CDDs with no monolithic documents, no boundary ambiguity, and no inter-document contradiction.

---

## Gate 3 — Operational Completeness

### Question

> Are all production constraints explicit enough for the NIB generator to produce infrastructure and deployment sections without guessing?

### What to verify

1. **Security.** Access constraints, trust boundaries, authentication/authorization requirements. If absent, flag it.
2. **Idempotence and state.** Retry management, idempotence keys, state recovery after crash. If the component is stateful and this is not addressed, flag it.
3. **Cleanup.** Resource teardown logic. If the component acquires resources (files, connections, locks), the cleanup path must be defined.
4. **Infrastructure and environment.** OS targets, binary dependencies, network constraints, storage assumptions. If the CDD assumes an environment without stating it, flag it.
5. **Performance constraints.** If performance matters, quantified thresholds must exist (not "must be fast").
6. **Observability.** If the system must be monitored, the signals (metrics, traces, structured logs) must be specified.
7. **Migration and compatibility.** If the component replaces or modifies an existing system, the migration path and backward compatibility rules must be defined.

### Gate 3 passes when

Every operational constraint relevant to the component is explicitly defined. The NIB generator can produce the Infrastructure & Environment section of each NIB without inventing any constraint.

---

## The Three Personas Verification

After evaluating the three gates, verify the corpus passes three perspectives:

- **Developer:** Do I know exactly what to build without ambiguity? *(Gate 2)*
- **QA Tester:** Can I derive every test oracle from the specs alone? *(Gate 1)*
- **SRE Operator:** Do I know how the system recovers from a crash? *(Gate 3)*

If any persona cannot answer "yes" using only the corpus text, the corpus is not extraction-ready.

---

## Output: Extraction-Readiness Verdict

### Per-CDD status

For each CDD in the corpus, produce:

```text
CDD-N-PAYMENT-PROCESSOR
  Gate 1: PASS (12/12 requirements TDD_READY)
  Gate 2: PASS (all boundaries typed, no inter-CDD conflict)
  Gate 3: BLOCKED (missing: retry policy, cleanup path)
  Verdict: NOT EXTRACTION-READY
```

### Corpus-level verdict

```text
Corpus Verdict: NOT EXTRACTION-READY

Blocking issues:
  - CDD-N-PAYMENT-PROCESSOR: Gate 3 — 2 operational gaps
  - CDD-O-CHECKOUT: Gate 2 — monolithic, requires DAG split

Ready for extraction:
  - CDD-N-CART-CALCULATOR (all gates pass)
  - CDD-I-NOTIFICATION (all gates pass)
```

### Extraction-readiness equation

A corpus is extraction-ready when:

```text
extraction-ready =
    behavioral-complete     (Gate 1: every requirement is TDD_READY or explicitly blocked)
  ∧ structural-complete     (Gate 2: factorization resolved, boundaries typed, no conflicts)
  ∧ operational-complete    (Gate 3: all production constraints explicit)
```

---

## Severity and Resolution Classes

Every finding must carry both a severity and a resolution class.

### Severity

- 🔴 **Blocker.** The defect would cause the NIB generator to invent behavior, guess a boundary, or omit a production constraint.
- 🟡 **Minor.** Formatting debt, readability issues, cosmetic drift, missing but deductible metadata.

### Resolution class

- **Category 1 — Mechanical.** The resolution is unambiguous. Propose the exact correction. Do not apply it yourself.
- **Category 2 — Design decision.** Multiple viable paths exist. List the options with trade-offs. Wait for the architect to arbitrate.
- **Category 3 — Structural formatting.** The architectural content exists in the text but the CDD does not follow the 11-header layout. Emit a single 🟡 Minor: "Document requires structural crystallization."

### Abort threshold

If a single CDD contains 4+ 🔴 Blockers, abort the incremental review. Recommend a return to drafting.

---

## Mandatory Prerequisites

Before executing this audit:

1. Read the CDD doctrine at `~/neelopedia/engineering/cubits-design-doc.md`.
2. Read the CDD structural reference at [cdd-structure-reference.md](../assets/cdd-structure-reference.md).
3. Scan and read the entirety of the `/specs` directory. Audit the full corpus as a coherent whole.

---

## Enforcement

> [!CAUTION]
> **You are an auditor, not an editor.** Analyze, report, and propose. Do not modify any file. Generate the audit report and wait for human validation.
