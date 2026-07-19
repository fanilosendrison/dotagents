# 📄 Dependency Contract

*VegaCorp — March 2026*

---

## 1. Definition

A **Dependency Contract** is a normative construction document that specifies the interface, behavior, and integration constraints of an external component that an implementing agent must consume without implementing.

A Dependency Contract answers a single question: "How must the agent use this dependency correctly?" It does not describe code to produce — it constrains code that is being produced.

### 1.1 Relationship to NIBs

A Dependency Contract is not a NIB. The distinction is directional:

|  | NIB | Dependency Contract |
| --- | --- | --- |
| **Instruction** | "Build this" | "When you build, respect this" |
| **Scope** | Code to produce | Code already produced (by someone else) |
| **Agent role** | Implementer | Consumer |
| **Existence without NIBs** | Standalone | Always referenced by a NIB-M |

A Dependency Contract never exists in isolation. It is always referenced by one or more NIB-Ms that describe modules consuming the dependency. The NIB-M says "this module uses component X" — the Dependency Contract says "here is exactly how component X works."

### 1.2 Why not just read the dependency's documentation?

Three reasons:

**Scope reduction.** A dependency's full documentation covers everything the dependency can do. The implementing agent needs to know only what is relevant to the system being built. A Dependency Contract is scoped to the consuming system's needs — it documents the subset of the dependency's interface that the agent will actually use.

**Non-ambiguity.** Library documentation is written for humans who can infer intent from examples and prose. An implementing agent needs exact types, exact error semantics, and exact behavioral contracts. A Dependency Contract translates human documentation into agent-consumable precision.

**Normative authority.** When the dependency's documentation is ambiguous or incomplete, the Dependency Contract makes a decision and documents it. The agent follows the contract, not the upstream docs. If the contract is wrong, the tests (NIB-T) catch it.

### 1.3 Fundamental property: finite lifespan

Like NIBs, a Dependency Contract has a finite useful lifespan. After implementation, the actual usage of the dependency in the code shows how it is consumed — call patterns, error handling, configuration. The contract becomes redundant with the code.

After the Transition phase (see NIB methodology §4.3), the Dependency Contract is archived alongside the NIBs it was referenced by.

---

## 2. Content

### 2.1 Required content

**Interface specification.** The exact interface of the external component: types, method signatures, return types, error types. Written in the same language as the consuming system, or in language-agnostic pseudocode if the dependency is polyglot.

**Behavioral contract.** What each method does, not just its signature. Preconditions (what the caller must guarantee), postconditions (what the method guarantees), and invariants (what is always true). Special attention to:

- What constitutes a valid input vs. an invalid input.
- What the method returns on success.
- What the method does on failure (throw, return error type, return null).
- Whether the method has side effects.

**Error semantics.** The complete taxonomy of errors the dependency can produce, with the expected handling strategy for each. This is where most integration bugs live — the Dependency Contract makes error handling explicit rather than discovered at runtime.

**Integration patterns.** How the dependency is instantiated, configured, and called within the consuming system. Not abstract examples from upstream docs — concrete patterns showing how the dependency fits into the specific architecture being built.

**Constraints on the consumer.** Rules the consuming code must follow. Examples:

- "The schema must conform to draft-07 of the JSON Schema specification."
- "The `complete()` method must be called with a non-empty system prompt."
- "The client instance must not be shared across concurrent invocations."
- "Temperature must be between 0 and 1 inclusive."

**Version pinning.** The exact version of the dependency the contract describes. If the dependency updates, the contract may need to be revised before the NIB-T tests are written.

### 2.2 Optional content

**Comparison with alternatives.** If the dependency was chosen over alternatives, a brief rationale. This is ADR-adjacent content — it explains a decision. It can be extracted into an ADR during the Transition phase.

**Known limitations.** Behaviors of the dependency that the consuming system must work around. These often become edge cases in the NIB-M and test vectors in the NIB-T.

**Performance characteristics.** If the dependency has performance properties that affect the consuming system's design (latency, rate limits, token costs), they are documented here rather than discovered during validation.

### 2.3 Forbidden content

- **Implementation details of the dependency.** The contract describes the interface, not the internals. How the dependency achieves its behavior is irrelevant to the consuming agent.
- **Reimplementation instructions.** If the architect wants the agent to reimplement the dependency's functionality, that is a NIB-M, not a Dependency Contract.
- **Upstream documentation copy.** The contract is a curated, scoped, non-ambiguous subset — not a mirror of the upstream docs.

---

## 3. Structure

A Dependency Contract follows a standard structure. Sections may be omitted if not applicable, but the order is fixed.

```
# Dependency Contract — [Component Name]

## 0. Identity
- Component name
- Version
- Source (package registry, repository, internal)
- Role in the consuming system (one sentence)

## 1. Interface
- Types / interfaces / signatures
- Exact method contracts

## 2. Behavioral contract
- Per-method: preconditions, postconditions, invariants
- Success paths
- Failure paths

## 3. Error semantics
- Error taxonomy
- Expected handling strategy per error type

## 4. Integration patterns
- Instantiation / configuration
- Call patterns within the consuming architecture
- Lifecycle (singleton, per-request, etc.)

## 5. Consumer constraints
- Rules the consuming code must follow
- Invalid usage patterns to avoid

## 6. Known limitations
- Workarounds required
- Edge cases propagated to the consuming system
```

---

## 4. Lifecycle

### 4.1 Creation

A Dependency Contract is written by the architect during the Conception phase, alongside or shortly after the NIB-M that references it. It is written when:

- The consuming module delegates non-trivial behavior to an external component.
- The dependency's interface has subtleties that the agent could get wrong (error handling, configuration, schema constraints).
- The dependency is internal to the organization (another package in the monorepo) and its documentation may not exist or may be incomplete.

A Dependency Contract is **not** written when:

- The dependency is trivially consumed (e.g., a utility function with an obvious signature).
- The dependency's usage is fully specified in the NIB-M itself (a one-line call with no configuration).
- The dependency is a language standard library feature.

### 4.2 Consumption

The implementing agent consults the Dependency Contract during the TDD construction sequence (see **Construction Sequence** document), when implementing the module that consumes the dependency. The NIB-M references the contract explicitly:

> "Phase E uses `StructuredExtractor` from `llm-to-json` for W2 extraction — see Dependency Contract `DC-LLM-TO-JSON` for the extraction contract, error semantics, and schema requirements."
> 

The agent reads the contract, implements the integration, and the NIB-T tests verify that the integration is correct.

### 4.3 Archival

After the Transition phase, the Dependency Contract is archived alongside the NIBs. The code shows how the dependency is actually consumed. If the dependency is upgraded to a new version that changes the interface, a new Dependency Contract is written for the new version — the old one remains archived as historical context.

### 4.4 Relationship to dependency upgrades

A Dependency Contract describes a specific version. When the dependency is upgraded:

- **Non-breaking change:** No action needed. The contract remains valid. The tests (NIB-T) confirm compatibility.
- **Breaking change, pre-Transition:** The contract is updated to reflect the new version. The NIB-T tests are updated accordingly.
- **Breaking change, post-Transition:** The code is the source of truth. The upgrade is handled as a code change with test updates. No contract update — the archived contract reflects the version it was written for.

---

## 5. Metadata standard

Each Dependency Contract carries metadata consistent with the NIB metadata format:

```yaml
---
id: DC-LLM-TO-JSON                # Unique identifier (DC prefix)
type: dependency-contract          # Fixed type
version: "1.0.0"                   # Version of the contract (not the dependency)
dependency_version: "0.3.2"        # Version of the dependency described
scope: llm-to-json                 # Dependency name
status: active                     # active | construction-archive
consumers: [claude-code]           # Who consumes this document
referenced_by: [NIB-M-PHASE-E]    # Which NIB-Ms reference this contract
superseded_by: []                  # Empty while active; filled on archival
---
```

The `superseded_by` field tracks which code files replace this contract as the source of truth for how the dependency is consumed. While `active`, the field is empty — the contract is the authority. On archival, the field is filled with the files that show the actual integration patterns, error handling, and configuration.

---

## 6. Anti-patterns

### 6.1 Writing a Dependency Contract for every dependency

Not every dependency warrants a contract. A contract is justified only when the integration has subtleties the agent could get wrong. A utility library with a self-explanatory API does not need a contract — the NIB-M's algorithm section covers it implicitly.

### 6.2 Copying upstream documentation

A Dependency Contract is a curated subset, not a mirror. Copying the full upstream docs introduces noise (irrelevant features), staleness (upstream docs update, the copy doesn't), and ambiguity (the agent doesn't know which parts are relevant).

### 6.3 Maintaining the contract post-Transition

The same anti-pattern as maintaining NIBs in sync with the code. After Transition, the code shows how the dependency is consumed. The contract is an archived construction artifact.

### 6.4 Using a Dependency Contract as a substitute for tests

The contract describes how the dependency should be used. The NIB-T tests verify that it is used correctly. The contract without tests is an assertion without verification — it may be wrong.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*