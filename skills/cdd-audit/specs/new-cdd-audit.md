---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "specification"
domain: "architecture"
status: "draft"
name: "CDD Audit: Extraction-Readiness Protocol (Draft)"
---

# CDD Audit: Extraction-Readiness Protocol

## Purpose

A CDD audit determines whether a corpus of Cubits Design Docs is **extraction-ready**: ready for mechanical NIB generation.

A corpus is extraction-ready when an agent can translate every CDD into NIBs (NIB-S, NIB-M, NIB-T) without inventing any behavior, boundary, or constraint.

The audit evaluates **four sequential gates** plus a **schema pre-check (Gate 0)**. A corpus blocked at any gate cannot advance to the next.

---

## Core Invariant

The CDD-to-NIB translation must behave like a compilation, not a creative act.

If the NIB generator must make a product decision, invent an oracle, guess a boundary, or assume an environment constraint, the CDD has failed. The audit exists to catch these failures before the translation begins.

---

## Posture

> **The burden of proof is on the document, never on the reviewer.**
> If a capability or constraint is not explicitly and mechanically provable in the text, assume it does not exist.
>
> Architecture is decided at design time, not implementation time.

You are an architectural enforcer. Your goal is to determine whether every fact needed by the NIB generator is present, explicit, and mechanically verifiable in the corpus. Do not fill gaps with your own knowledge. Do not assume. Verify.

---

## Mandatory Prerequisites

Before executing this audit:

1. Read the CDD doctrine at `~/.agents/conventions/cubits-design-doc.md`. This file defines the CDD typologies (CDD-O/N/I/S), the factorization patterns, the OKF frontmatter schema, the lifecycle, and the extraction-readiness criterion.
2. Read the CDD structural reference at `assets/cdd-structure-reference.md`. This file defines the exact 11 mandatory Markdown headers and their order, the YAML frontmatter template, and the per-typology layout rules (e.g., CDD-I omits the Pipeline section).
3. Scan and read the entirety of the `/specs` directory. **Do not tunnel-vision on a single file.** Audit the full corpus as a coherent whole.

---

## Gate 0 — Schema (Formal Conformance)

### Question

> Is the document formally well-formed? Are its metadata, typology, and structure correct?

This gate is cheap (~2 min per document). It must pass before any deeper analysis begins. Formal conformance is non-negotiable.

### 0.1 OKF YAML Frontmatter

Verify the YAML frontmatter of every CDD:

- `format` must be exactly `"cubits-design-doc"`. Flag any invalid or missing value.
- `status` must be one of the authorized values:
  - `draft` — Subject to Hostile Review. Remains draft while any ambiguity exists.
  - `baselined` — Certified "Ready to Freeze". Absolute source of truth.
  - `extracted-archive` — Validated and extracted (e.g., NIBs generated).
  - `superseded` — Obsolete, replaced by a revamp before extraction.
- Permanent documents (prefixed `STD-` or `CNV-`) must use `kind: "KnowledgeAsset"` and bypass the CDD lifecycle.

Flag any invalid schema, unauthorized status, or missing frontmatter field as a 🔴 Blocker (Category 1).

### 0.2 Typology

Verify that every CDD strictly obeys **exactly one** of the four typological profiles:

| Profile | Role | Rules |
|---------|------|-------|
| **CDD-O** (Orchestrator) | Delegates work to nodes | Possesses a DAG. Does NOT perform low-level operations. |
| **CDD-N** (Node) | The worker | Possesses a strict pipeline. Does NOT delegate to other components. |
| **CDD-I** (Interface) | The abstract contract | Defines I/O contracts. **Omits the Pipeline section.** |
| **CDD-S** (Strategy) | The operational approach | Inherits I/O from a CDD-I. Possesses a highly detailed operational pipeline. |

Flag any CDD that violates its profile rules or exhibits traits of multiple profiles without clear separation. Profile violation = 🔴 Blocker (Category 1 or 2, depending on whether a clean split is obvious).

### 0.3 Structural Layout

Verify the Markdown layout against the CDD structural reference (11 mandatory headers).

- If the architectural **content** is present in the text but the headers are missing or malformed → do not pollute the report with 11 separate issues. Emit a single 🟡 Minor (Category 3): *"Document requires structural crystallization."*
- If a subject is entirely **absent** (the author never defined Idempotence, Failure Modes, etc.) → this is NOT a formatting issue. It is a missing architectural decision and must be flagged in the appropriate behavioral or operational gate as a 🔴 Blocker.

### Gate 0 passes when

Every CDD has a valid frontmatter, conforms to exactly one typological profile, and is structurally accounted for (even if Category 3 crystallization is pending).

**→ ÉCHEC = STOP. Do not proceed to Gate 1. Formal conformance is non-negotiable.**

---

## Gate 1 — Structural Completeness

### Question

> Is the corpus factored correctly, and are all system boundaries explicit enough for the NIB generator to produce exact type contracts?

### Persona

**DEVELOPER** — *"Do I know exactly what to build without ambiguity?"*

### 1.1 Factorization

Apply the split heuristics ruthlessly. If any condition is met, the design must be refactored before it can pass this gate.

1. **DAG Split.** If a CDD describes multiple sequential or parallel steps with distinct I/O boundaries, it must be split into a CDD-O (Orchestrator) and one or more CDD-N (Node) documents. A monolithic CDD that orchestrates AND executes is a 🔴 Blocker.

2. **Strategy Split.** If a CDD dictates a specific technological approach where viable alternatives exist, the interface must be extracted into a CDD-I (Interface) and the technology-specific part moved to a CDD-S (Strategy). Hard-coding a strategy without an abstraction layer is a 🔴 Blocker.

3. **Global Rule Extraction.** If a CDD defines a format, naming convention, vocabulary, or invariant consumed by other components, it must be extracted into a permanent **STD** (Standard) or **CNV** (Convention). A CDD must not legislate for external systems. Local definition of a cross-cutting rule is a 🔴 Blocker.

### 1.2 System Boundaries

For every CDD in the corpus, verify:

1. **Input contracts.** Exact data types consumed by the component. The NIB generator must be able to produce Zod schemas directly from these definitions. Prose descriptions ("receives some user data") = 🔴 Blocker.

2. **Output contracts.** Exact data types produced. Same standard as inputs.

3. **Upstream/downstream identification.** Every CDD must explicitly name its upstream providers and downstream consumers. If a CDD references an input without stating which component produces it, flag as 🔴 Blocker.

4. **Event contracts.** If the component publishes or subscribes to events, the event schema and semantics must be explicit. Implicit event contracts = 🔴 Blocker.

5. **Error contracts.** The error types returned or propagated at each boundary must be defined. Undefined error surfaces = 🔴 Blocker.

### 1.3 Directory Structure

The `/specs` directory must not become a flat landfill.

- Assess the physical folder hierarchy.
- If documents are not logically grouped by domain (e.g., `/orchestrator/`, `/auth/`) or lifecycle (e.g., `/working/`, `/archive/`), propose an optimal directory tree refactoring.
- Emit as 🟡 Minor (Category 1): propose the target tree.

### Gate 1 passes when

The corpus is factored into correctly typed CDDs with no monolithic documents, no missing boundary definitions, and a coherent directory structure.

**→ ÉCHEC = STOP. Do not classify behaviors (Gate 2) when component boundaries are undefined.**

---

## Gate 2 — Behavioral Completeness

### Question

> For every behavior described in this corpus, can an agent derive a test that distinguishes a correct implementation from an incorrect one, using only what the CDD provides?

### Persona

**QA TESTER** — *"Can I mathematically verify every behavior is correct?"*

### What to verify

For each behavioral requirement in the corpus:

#### 2.1 Oracle Derivability

The expected result must be dictated by the CDD, not invented by the agent. Flag any behavior whose expected result requires a product assumption.

#### 2.2 Precondition Controllability

The test must be able to place the system in the required initial state. If a precondition depends on an unspecified external factor, flag it.

#### 2.3 Effect Observability

The consequence of the behavior must be observable (return value, state change, event, error). If the CDD says *"the system handles this correctly"* without specifying what "correctly" produces, flag it.

#### 2.4 Invariant Precision

Every invariant must be **mechanically verifiable**. Accepted verification methods include: scripts (bash, eBPF), strong typing, or logic assertions.

- `"Must be fast"` → 🔴 Blocker. Not mechanically verifiable.
- `"Response time < 200ms at p99"` → ✅ Mechanically verifiable.

#### 2.5 Edge Case Coverage

Every conditional branch in the logical pipeline must have a defined outcome.

- If a branch says *"the agent will determine dynamically"* or *"adapt based on context"* without a strict fallback → 🔴 Blocker.
- Architecture is decided at design time, not implementation time.

#### 2.6 Error Behavior

Every failure mode must map to a specific recovery action or error output. Unmapped failure modes are 🔴 Blockers.

#### 2.7 Hunt the Magic — Non-Deterministic AI Assumptions

Flag any text implying an AI or agent will *"read and understand"*, *"infer"*, *"decide"*, or *"determine"* without an explicit, deterministic decision procedure.

- *"The AI will read the context and adapt its response"* → 🔴 Blocker. No decision procedure defined.
- Require deterministic boundaries for any AI-mediated behavior.

#### 2.8 Anti-Goals

Every CDD must explicitly state what the component will **not** do. Missing anti-goals = 🔴 Blocker.

Anti-goals constrain the implementation space and prevent scope creep. Without them, the boundary between "in scope" and "out of scope" is invisible to the NIB generator.

#### 2.9 Hunt Intra-CDD Contradictions

Flag any internal inconsistency within a single CDD:

- Pipeline steps that violate a stated Invariant.
- Internal operations that betray a stated Non-Goal.
- Mutually incompatible requirements.

Intra-CDD contradiction = 🔴 Blocker.

### Classification

For each behavioral requirement, assign exactly one status:

| Status | Meaning |
| ----------------------- | ----------------------------------------- |
| `TDD_READY` | Oracle derivable, precondition controllable, effect observable |
| `SPEC_GAP` | Expected result missing or undefined — architect can resolve now |
| `SPEC_AMBIGUITY` | Multiple plausible interpretations exist — architect must disambiguate |
| `SPEC_CONFLICT` | Contradicts another normative source (intra-CDD or inter-CDD) — requires arbitration |
| `SPIKE_NEEDED` | Behavior is genuinely undiscoverable at design time — must be discovered empirically first |

> **`SPIKE_NEEDED` is not a quality failure.** It means the behavior cannot be known without empirical measurement (e.g., optimal cache parameters, ML model thresholds, real-world latency tuning). It blocks extraction-readiness but routes to a spike ticket, not a spec correction.

### Gate 2 passes when

Every behavioral requirement is classified. Zero unclassified requirements remain.

---

## Gate 3 — Inter-CDD Coherence

### Question

> Do the CDDs fit together without contradictions, vocabulary drift, or silent external dependencies?

### Persona

**ARCHITECT** — *"Do the components fit together without friction?"*

### 3.1 Contract Matching

For every upstream→downstream pair in the corpus:

- Upstream outputs must exactly match downstream inputs. Flag any type or semantic mismatch.
- **Upstream Cleanup that destroys downstream resources:** flag any upstream Cleanup logic that destroys physical or logical resources required by a downstream node. This is a specific and insidious class of inter-CDD contradiction.

### 3.2 Vocabulary Consistency

The same concept must use the same term everywhere.

- If one CDD says `"user"` and another says `"account"` for the same entity → flag as 🔴 Blocker.
- If one CDD says `"payment"` and another says `"transaction"` for the same operation → flag as 🔴 Blocker.

Vocabulary drift breaks contract matching and makes the NIB generator produce incompatible schemas.

### 3.3 STD/CNV Compliance

No CDD may contradict an existing permanent Standard or Convention.

- Flag any divergence from an active STD or CNV.
- If the CDD intentionally overrides a permanent document, this must be explicitly stated and justified. Silent override = 🔴 Blocker.

### 3.4 Declare Unverified Areas

If a CDD references a `STD`, `CNV`, or upstream `CDD` that you **cannot find or read** in the corpus:

- Explicitly declare it as **UNVERIFIED** in your report.
- Do not leave silent assumptions. An unverifiable reference means the contracts at that boundary cannot be validated.

### Gate 3 passes when

All inter-CDD contracts match, vocabulary is consistent, no STD/CNV violation exists, and every external reference is either verified or explicitly declared unverified.

---

## Gate 4 — Operational Completeness

### Question

> Are all production constraints explicit enough for the NIB generator to produce infrastructure and deployment sections without guessing?

### Persona

**SRE OPERATOR** — *"Do I know how the system recovers from a crash?"*

### What to verify

For each CDD in the corpus:

1. **Security.** Access constraints, trust boundaries, authentication/authorization requirements. If the component handles data or exposes an interface and security is not addressed → 🔴 Blocker.

2. **Idempotence and state.** Retry management, idempotence keys, state recovery after crash. If the component is stateful and idempotence is not addressed → 🔴 Blocker.

3. **Cleanup.** Resource teardown logic. If the component acquires resources (files, connections, locks), the cleanup path must be defined. Undefined cleanup = 🔴 Blocker.

4. **Infrastructure and environment.** OS targets, binary dependencies, network constraints, storage assumptions. If the CDD assumes an environment without stating it → 🔴 Blocker.

5. **Performance constraints.** If performance matters, quantified thresholds must exist. `"Must be fast"` is not a constraint. `"< 200ms p99"` is.

6. **Observability.** If the system must be monitored, the signals (metrics, traces, structured logs) must be specified. Unspecified observability for a production component = 🟡 Minor.

7. **Migration and compatibility.** If the component replaces or modifies an existing system, the migration path and backward compatibility rules must be defined. Undefined migration path = 🔴 Blocker.

### Gate 4 passes when

Every operational constraint relevant to the component is explicitly defined. The NIB generator can produce the Infrastructure & Environment section of each NIB without inventing any constraint.

---

## Transverse Rules

These rules apply across all gates.

### Abort Threshold (The Veto)

If a single CDD contains **4 or more 🔴 Blockers**, abort the incremental review for that document.

- Do not list micro-corrections.
- Recommend the document **returns to drafting** (*"Return to drafting" veto*).

A document with 4+ blockers is not ready for detailed audit — it needs foundational rework first.

### Status Gate

As long as a **single 🔴 Blocker** or **any Category 2 / Category 3 Finding** remains unresolved, the CDD stays at `status: draft`.

Only a clean audit (all gates pass, no blockers, no open findings) allows promotion to `status: baselined`.

### Declare Unverified Areas

This rule applies to **every gate**, not just Gate 3.4.

If you encounter a reference to a `STD`, `CNV`, or upstream `CDD` that is not present in the corpus — at any point during the audit — explicitly declare it as **UNVERIFIED**. Do not silently assume the reference is valid, the contract matches, or the constraint is inherited.

---

## The Three Personas Verification

After evaluating all four gates, verify the corpus passes three independent perspectives:

| Persona | Gate | Question |
|---------|------|----------|
| **Developer** | Gate 1 | Do I know exactly what to build without ambiguity? |
| **QA Tester** | Gate 2 | Can I mathematically verify every behavior is correct? |
| **SRE Operator** | Gate 4 | Do I know how the system recovers from a crash? |

If any persona cannot answer *"yes"* using only the corpus text, the corpus is not extraction-ready.

*(Gate 3 — Coherence — is the architect's perspective. It is validated by the audit itself, not by a separate persona.)*

---

## Severity and Resolution Classes

Every finding must carry both a severity and a resolution class. They are orthogonal: a 🔴 Blocker can be a mechanical Category 1 fix, and a 🟡 Minor can require a Category 2 design decision.

### Severity

- **🔴 Blocker.** The defect would cause the NIB generator to invent behavior, guess a boundary, omit a production constraint, leave a failure path unhandled, or produce an unresolvable ambiguity. Any of: incorrect implementation, contract violation, unhandled failure path, subjective unverifiable goal, or unresolvable ambiguity.
- **🟡 Minor.** Formatting debt, readability issues, cosmetic drift, missing but deductible metadata.

### Resolution Class

- **Category 1 — Mechanical.** The resolution is unambiguous; only one viable path exists in the system. Propose the exact correction in the report. **Do not modify the file yourself.** The human validates and applies.
  - *Examples:* YAML schema errors (🟡 Minor), mathematically obvious Failure Mode fixes (🔴 Blocker).

- **Category 2 — Design Decision.** Multiple viable paths exist. The problem requires architectural arbitration.
  - *Action:* List the finding, expose the alternatives with trade-offs, and wait for the human to arbitrate. Do not invent the solution.
  - *Examples:* Factorization arbitration ("Should we extract CDD-I/S?"), Deferred Decisions with multiple viable fallbacks, ambiguous blind spots. (Almost always 🔴 Blocker.)

- **Category 3 — Structural Formatting.** **Strictly for formatting issues**: the architectural **content** is present in the text but the CDD does not follow the 11-header layout.
  - *Action:* Do not pollute the report by listing 11 separate missing sections. Emit a **single 🟡 Minor Category 3 finding**: *"Document requires structural crystallization."*
  - *Warning:* If a subject is entirely **missing** from the draft (e.g., the author never defined Idempotence or Failure Modes), this is **NOT** a formatting issue. It is a missing architectural decision and must be flagged as a 🔴 Blocker in the appropriate gate.

---

## Output: Extraction-Readiness Verdict

### Per-CDD Status

For each CDD in the corpus, produce a gate-by-gate status block:

```text
CDD-O-CHECKOUT
  Gate 0: PASS (valid frontmatter, typology CDD-O, layout crystallized)
  Gate 1: PASS (correctly factored, all boundaries typed)
  Gate 2: BLOCKED
    - REQ-003 (Timeout behavior)  → SPEC_GAP
    - REQ-007 (Fraud threshold)   → SPIKE_NEEDED
    - 10/12 requirements TDD_READY
  Gate 3: PASS (no inter-CDD conflict)
  Gate 4: BLOCKED
    - Missing: retry idempotency keys (4.2)
    - Missing: cleanup path for lock acquisition (4.3)
  Verdict: NOT EXTRACTION-READY
```

### Corpus-Level Verdict

```text
Corpus Verdict: NOT EXTRACTION-READY

Blocking issues:
  - CDD-O-CHECKOUT: Gate 2 — 2 unclassified requirements
  - CDD-O-CHECKOUT: Gate 4 — 2 operational gaps
  - CDD-N-PAYMENT-PROCESSOR: Gate 1 — monolithic, requires DAG split

Ready for extraction:
  - CDD-N-CART-CALCULATOR (all gates pass)
  - CDD-I-NOTIFICATION (all gates pass)
```

### Extraction-Readiness Equation

A corpus is extraction-ready when:

```text
extraction-ready =
    schema-valid(Gate 0)
  ∧ structural-complete(Gate 1)
  ∧ behavioral-complete(Gate 2)
  ∧ coherent(Gate 3)
  ∧ operational-complete(Gate 4)
```

### Routing Matrix

For every non-`TDD_READY` requirement and every blocker, produce a routable action:

| CDD | Requirement | Status | Action | Owner |
|-----|------------|--------|--------|-------|
| CDD-O-CHECKOUT | REQ-003 (Timeout) | SPEC_GAP | Définir comportement timeout + fallback | Architecte |
| CDD-O-CHECKOUT | REQ-007 (Fraud) | SPIKE_NEEDED | Benchmarker seuils sur données réelles | Équipe R&D |
| CDD-N-PAYMENT | — | Gate 1 blocked | DAG split → CDD-O + CDD-N | Architecte |

---

## Sub-Agent Execution Architecture

The audit is designed for parallel execution. The main agent orchestrates; sub-agents execute focused checks.

### Execution Flow

```
MAIN AGENT
  │
  ├── Read entire corpus (Mandatory Prerequisites)
  │
  ├── GATE 0 — Schema (main agent only, cheap)
  │     └── Per CDD: frontmatter, typology, layout
  │     └── STOP if any CDD fails Gate 0
  │
  ├── GATE 1 — Structural
  │     ├── [1 sub] 1.1 Factorization (entire corpus)
  │     ├── [Fan-out per CDD] 1.2 Boundaries (one sub per CDD)
  │     └── [1 sub] 1.3 Directory structure
  │     └── Main consolidates → STOP or CONTINUE
  │
  ├── GATE 2 — Behavioral
  │     └── [Fan-out per CDD] 2.1→2.9 all hunts + classification
  │         (one sub per CDD; each sub applies all 9 checks)
  │     └── Main consolidates classification matrix
  │
  ├── GATE 3 — Coherence
  │     └── [1 sub] 3.1→3.4 (entire corpus)
  │     └── Main consolidates
  │
  ├── GATE 4 — Operational
  │     └── [Fan-out per CDD] 4.1→4.7 checklist (one sub per CDD)
  │     └── Main consolidates
  │
  └── VERDICT — Main agent only
        ├── Per-CDD status
        ├── Corpus-level verdict
        ├── Extraction-readiness equation
        └── Routing matrix
```

### Sub-Agent Context Rules

| Sub-agent scope | Context | Rationale |
|-----------------|---------|-----------|
| Gate 1.1 (factorization) | Entire corpus | DAG/Strategy/Global splits require cross-document awareness |
| Gate 1.2 (boundaries) | Single CDD | Boundary checks are document-local |
| Gate 1.3 (directory) | Directory tree | Structural assessment only |
| Gate 2 (behavioral) | Single CDD | All behavioral hunts apply to one document; grouping them avoids re-reading |
| Gate 3 (coherence) | Entire corpus | Contract matching and vocabulary require cross-document comparison |
| Gate 4 (operational) | Single CDD | Operational checklist is document-local |

### Sub-Agent Posture

Every sub-agent must apply the adversarial posture:

> *"The burden of proof is on the document, never on the reviewer. If a capability or constraint is not explicitly and mechanically provable in the text, assume it does not exist."*

Sub-agents are auditors, not editors. They report findings; the main agent synthesizes the verdict.

---

## Enforcement

> [!CAUTION]
> **READ-ONLY ENFORCEMENT: YOU ARE AN AUDITOR, NOT AN EDITOR**
>
> You must analyze, report, and propose. **DO NOT modify any file yourself.**
> Generate the audit report and wait for human validation.
>
> Every finding must be routable to an action and an owner. A verdict without a routing matrix is incomplete.
