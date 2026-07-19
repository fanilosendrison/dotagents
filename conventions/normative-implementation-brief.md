# 📋 Normative Implementation Brief (NIB)

*Cubits — March 2026*

---

## 1. Definition

A **Normative Implementation Brief** (NIB) is an instruction document for an implementing agent (LLM coding agent). It materializes all design decisions required to produce correct code, minimizing the agent's decisional space.

The NIB is the application of explicit decision-making to the development workflow itself: every determinant decision is explicitly materialized before execution, in a verifiable and contestable form.

### 1.1 What a NIB is not

A NIB is not a traditional spec, a design doc, or a prompt. It is distinguished from each by its combination of properties:

| Property | Traditional spec | Google Design Doc | Cubits Design Doc (CDD) | NIB |
| --- | --- | --- | --- | --- |
| Audience | Human developer | Humans debating an approach | Architect (Conception) & Agent generating NIBs | Implementing agent |
| Contains implementable code | Rarely | No | Typed sketches permitted as non-normative functional contracts | Yes — authoritative types, exact algorithms, signatures |
| Contains the "why" | Sometimes | Yes (that's the point) | No for alternatives (ADRs). Yes for system physics. | Partially — embedded in decisions |
| Pedagogical intent (Doctrine) | Rarely | Yes | Yes (explains the mechanics) | Strictly none (mechanical execution only) |
| Defines system boundaries (I/O) | Abstractly | Yes (High-level) | Yes (Functional contract) | Yes (Strict types & schemas) |
| Concrete I/O payload examples | Separate appendix | No | When necessary to prove the logic | Integrated as test vectors |
| Edge cases identified | Rarely | No | Yes — exhaustive Failure Modes mapping | Yes — listed with expected behavior |
| Useful lifespan | Intended to be permanent | Permanent | Finite — until NIB generation | Finite — until implementation |
| Granularity | Module/interface | Architecture | Functional architecture / System physics | Function by function / Strict contracts |

### 1.2 Fundamental property: finite lifespan

A NIB has a moment of birth (the architect writes it), a moment of peak utility (the agent implements), and a moment of obsolescence (the code is tested and validated). After implementation, code and tests become the source of truth. The NIB becomes an archived construction artifact — it is not maintained in sync with the code.

---

## 2. NIB taxonomy

A system is built from three types of NIBs, issued in a precise order and consumed sequentially by the implementing agent.

### 2.1 NIB-S — System Brief

The System Brief describes the system as a whole. It is the highest-level document, establishing the frame within which all other NIBs operate.

**Required content:**

- **System objective** — the problem being solved, in one sentence.
- **Pipeline architecture** — the phases/modules, their execution order, the dependencies between them. Diagram or textual description.
- **Module boundaries** — for each phase, the consumed inputs and produced outputs, with exact types.
- **Global invariants** — properties that must hold across the entire system (e.g., "1-indexed", "read-only for validation phases", "deterministic").
- **Cross-cutting policies** — rules that apply to multiple modules (e.g., "P1 — protected zones are never modified").
- **Output contract** — the exact types of the system's final result, with the semantics of each field.
- **Orchestration** — the pseudocode of the orchestrator that wires the phases together.

**Forbidden content:**

- Internal algorithms of a module. The NIB-S says "Phase C detects implicit headings using 4 patterns C1-C4" — it does not describe how C1 works. That is the role of the NIB-M.
- Implementation details (regex choices, internal data structures).

**Derived artifacts:** The NIB-S may produce convention documents that describe the physical structure of the project (e.g., target file tree, naming conventions). These are mechanical projections of the decisions in the NIB-S and NIB-Ms — they contain no decisions of their own. Unlike NIBs, convention documents remain maintained after implementation because they guide file placement and naming for new additions. Their maintenance cost is negligible: they reflect the actual directory structure, and divergence is immediately visible.

### 2.2 NIB-M — Module Brief

The Module Brief describes an individual module in sufficient detail for an agent to implement it without asking questions. One NIB-M is issued for each module identified in the NIB-S.

**Required content:**

- **Purpose** — what the module does, in 2–3 sentences.
- **Inputs** — the exact types consumed, with their provenance (which module produces them).
- **Outputs** — the exact types produced, with the semantics of each field.
- **Algorithm** — implementable pseudocode for each public function and non-trivial internal function. Types for intermediate structures are included.
- **Examples** — at least one complete example with concrete input, intermediate steps, and expected output. The example serves as both documentation and an implicit test vector.
- **Edge cases** — boundary conditions identified a priori, with the expected behavior for each. Edge cases not covered in v1 are listed with a "v2" or "known limitation" note.
- **Constraints** — module-specific invariants (e.g., "read-only", "deterministic", "no re-parse").
- **Integration** — the call snippet from the orchestrator, showing how the module fits into the pipeline.

**Forbidden content:**

- Repetition of global invariants already in the NIB-S (reference, don't duplicate).
- Architectural decisions that affect other modules (those belong in the NIB-S).

#### Decomposing a complex module into multiple NIB-Ms

Some modules carry multiple distinct responsibilities that cannot be adequately described in a single document without exceeding a reasonable size or mixing concerns. When a module is too complex for one NIB-M, it decomposes naturally into multiple NIB-Ms with complementary scopes.

The decomposition signal is structural: if a module has two or more areas of concern that have different types, different algorithms, and different edge cases, each area warrants its own NIB-M. The NIB-Ms share the same module identifier but cover distinct scopes.

**Example:** A module that orchestrates LLM-assisted decisions may require one NIB-M for the orchestration flow (state machine, retry logic, rollback) and a second NIB-M for the LLM interaction content (prompts, schemas, extraction contracts, guidance tables). The two documents are complementary — one describes how the module operates, the other describes what it says to the LLM.

This decomposition at the NIB level often predicts a future decomposition at the code level. If two NIB-Ms are needed to describe a single source file, that file will likely be split into sub-modules as the codebase matures.

The NIB-S does not need to be updated when a NIB-M is decomposed — the system-level view of the module remains unchanged. The decomposition is internal to the module's construction documentation.

### 2.3 NIB-T — TDD Tests Brief

The TDD Tests Brief describes the tests to implement first (RED), before production code. It materializes the system's observable contract — what the system must do as seen from the outside.

The NIB-T covers three types of tests:

- **Acceptance tests** (test vectors) — concrete input/output pairs. "Given this document, the system must produce this output." Each fixture specifies the input, the expected output, and the property being verified. These are the bulk of the NIB-T.
- **Property tests** (anti-cheat) — structural invariants that prevent hardcoding and overfitting. They verify properties like idempotence, EOL robustness, independence from filesystem, and rejection of out-of-bounds edits. They do not test a specific input/output pair — they test that a property holds across inputs.
- **Contract invariants** — transversal assertions that apply to all fixtures. "The output never modifies protected zones." "The index always excludes H1." "The report always contains the validation field." These are documented once and enforced across the entire test suite.

The NIB-T does **not** describe unit tests. Unit tests verify internal functions — they depend on the internal structure of the code, which does not exist when the NIB-T is written. Unit tests emerge naturally during implementation (GREEN) and during subsequent code review or refactoring.

**Required content:**

- **Fixture organization** — the test folder structure, the naming convention.
- **Test vectors** — for each fixture, the input, expected output, and the property being tested. The format is tabular or structured, directly translatable into assertions.
- **Anti-cheat** — property tests that verify structural invariants across inputs.
- **Contract invariants** — transversal assertions enforced across all fixtures.
- **Helpers** — test utility functions to provide (mocks, composite assertions, fixture builders).

**Forbidden content:**

- Implementation details of production code. The NIB-T says "when input is X, output must be Y" — it does not say how.
- Test vectors for non-observable internal behavior (test behavior, not implementation).
- Unit tests for internal functions (these emerge during implementation).

### 2.3.1 Tests that do NOT belong in the NIB-T

The NIB-T contains only **behavioral** tests that MUST fail before any production runtime code exists (RED phase). The following categories are NOT RED tests and MUST NOT be prescribed in the NIB-T — they emerge naturally at GREEN Layer 1 (Public API) and are tracked separately in a "GREEN Layer 1 companion" list:

- **Surface / export checks** — "module X exports Y" is a type-level assertion; it becomes trivially true as soon as Layer 1 compiles.
- **Constants** — `PROTOCOL_VERSION === 1` verifies a literal, not a behavior.
- **Hardcoded-fixture shape tests** — a test that builds an object inline and checks its fields has no runtime component; it tests the fixture, not the code producing it.
- **Error-class instantiation checks** — `new MyError(...).prop === X` is trivially GREEN as soon as the class is scaffolded.
- **Test-harness self-tests** — tests that verify mock helpers (mock-clock, mock-fs, fixture builders) are test infrastructure, not production contracts.

**Guiding question**: if the test passes trivially after `tsc --noEmit` succeeds (before any runtime code is written), it is NOT a RED test.

**Contract invariants — sharpened definition**: a genuine contract invariant is a **post-condition applied across the outputs of acceptance tests**. It rides parasitically on fixtures, not as a standalone assertion. Example: "no event emitted during ANY acceptance test contains PII" is a valid contract invariant (fails if one acceptance test accidentally leaks PII). By contrast, "module exports `runOrchestrator`" is a surface check, not a contract invariant — it belongs to GREEN Layer 1 companion.

### 2.4 Companion documents: dependency contracts

A NIB-M may reference external dependencies — components the agent consumes without implementing. These dependencies sometimes require their own normative documentation: the interface contract, the expected behavior, the error semantics, the integration patterns.

A **dependency contract** is a normative construction input that constrains how the agent uses an external component. It is not a NIB — it does not describe code to produce. But it is normative: if the agent ignores it, the implementation is incorrect.

**What it contains:**

- The exact interface of the external component (types, method signatures).
- The behavioral contract (what each method does, what it returns, error cases).
- Integration patterns (how the component is instantiated, configured, and called).
- Constraints the consuming code must respect (e.g., "the schema must be valid JSON Schema draft-07", "temperature must be between 0 and 1").

**How it relates to NIBs:**

- The NIB-M references the dependency contract: "Phase E uses StructuredExtractor from llm-to-json — see dependency contract for the extraction contract."
- The agent consults the dependency contract during implementation when it needs to understand how to call the external component correctly.
- The dependency contract has the same finite lifespan as a NIB: after implementation, the actual usage in the code shows how the dependency is consumed. The contract becomes redundant.

**What it is not:**

- Not a NIB-M for the external component (the agent does not implement it).
- Not a general-purpose reference document (it is scoped to what the agent needs to know for this specific system's construction).

See the dedicated **Dependency Contract** document for the full specification.

---

## 3. Consumption

NIBs and Dependency Contracts are consumed by an implementing agent in a strict TDD sequence (RED → GREEN). The NIB-T is consumed first to produce failing tests, then the NIB-S, NIB-Ms, and Dependency Contracts are consumed to implement production code until all tests pass.

See the **Construction Sequence** document for the full workflow.

---

## 4. NIB lifecycle

```jsx
CONCEPTION          CONSTRUCTION        TRANSITION          EVOLUTION
    │                    │                   │                   │
    ▼                    ▼                   ▼                   ▼
 Architect           Agent TDD          Architect           Code + Tests
 writes NIBs     implements RED→GREEN   archives NIBs       are the source
                                        extracts ADRs       of truth
                                        updates agent config
```

### 4.1 Conception phase (pre-code)

The architect writes the three NIBs. The NIB-S is written first, the NIB-Ms in parallel or sequentially, the NIB-T last (it depends on the interfaces defined in NIB-S and NIB-M).

The NIBs are the source of truth. No code exists.

### 4.2 Construction phase (implementation)

The agent consumes the NIBs and implements in TDD. The NIBs are the source of truth. Code is being produced.

If the agent encounters an ambiguity in a NIB, it stops and asks the architect for clarification. It does not improvise.

### 4.3 Transition phase (end of GREEN)

The transition occurs at the end of GREEN — the moment all tests pass. At this point, every decision in the NIBs has been consumed and materialized in the code and tests. The NIBs have fulfilled their purpose.

Everything that follows — refactoring, validation on real documents, bug fixes, feature additions — operates on code and tests only. The tests must remain GREEN through all of these. This is not a special phase; it is the permanent invariant of the codebase.

The architect performs three actions:

**1. Archive the NIBs.** Each NIB's metadata changes from `status: active` to `status: construction-archive`. NIBs remain in the repository but are no longer consulted as a reference for current behavior.

**2. Establish the hierarchy in agent configuration.** Rule added:

- For the *what* and the *how* → read the code and the tests.
- For the *why* → read the ADRs (which were extracted during the Conception phase from Cubits Design Docs).
- Files with `status: construction-archive` are initial construction documents — do not use them as a reference for the current state of the code.

### 4.4 Evolution phase (steady state)

Code and tests are the source of truth. NIBs are never updated.

- **Fix / refactor:** Code + tests suffice. No NIB. No ADR.
- **Contestable architectural decision:** A new ADR is written (once, never changes).
- **Major extension (new module):** A new NIB-M is written for the new scope. The cycle restarts at the Conception phase for that scope only.

---

## 5. Formal properties

### 5.1 Decisional completeness

A NIB is complete if an agent can implement the described system without making any decision not covered by the document. Every conditional branch in production code should correspond to an explicit decision in the NIB (algorithm, edge case, or constraint).

Completeness is formally undecidable (one cannot prove all cases are covered). The NIB methodology makes gaps visible: when the agent encounters an uncovered case, it stops instead of improvising. The gap is identified and corrected in the NIB.

### 5.2 Inter-NIB coherence

The three NIBs form a coherent system:

- Types in NIB-M must be compatible with module boundaries in NIB-S.
- Test vectors in NIB-T must match the input/output contracts in NIB-S and NIB-M.
- Edge cases in NIB-M must have corresponding test vectors in NIB-T.

The architect is responsible for this coherence. The agent verifies it implicitly: if a test (NIB-T) fails on a faithful implementation of the NIB-M, it is an inter-NIB inconsistency.

### 5.3 Non-ambiguity

A NIB must minimize possible interpretations. The tools of non-ambiguity are:

- **Exact type signatures** rather than prose descriptions.
- **Implementable pseudocode** rather than natural-language algorithms.
- **Concrete examples** with input/output rather than abstract descriptions.
- **Edge cases with expected behavior** rather than "to be handled".
- **Explicit constraints** rather than implicit conventions.

### 5.4 Verifiability

A NIB is verifiable if the architect can confirm that the agent's implementation respects the NIB by examining the passing tests. The NIB-T is the primary verification mechanism: if all tests pass, the contract is respected.

---

## 6. Metadata standard

Each NIB and companion document is an OKF `RuntimeArtifact`. It must carry the mandatory OKF metadata along with its NIB-specific lifecycle properties:

```yaml
---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "nib-system"               # nib-system | nib-module | nib-tddtests | dependency-contract
workspace: "go"
date: "YYYY-MM-DD"
step_id: 1                         # Orchestrator workflow step
id: NIB-S-NORMALIZER               # Unique identifier
version: "1.0.0"                   # Version of the NIB (not the code)
scope: md-structural-normalizer    # System or module covered
status: active                     # active | construction-archive
consumers: [claude-code]           # Who consumes this document
superseded_by: []                  # Empty while active; filled on archival
---
```

The `superseded_by` field tracks which code and test files replace the document as the source of truth. While the document is `active`, the field is empty — the document is the authority. When the status changes to `construction-archive`, the field is filled with the paths of the files that now contain the information: the production code and the tests. Anyone (human or agent) who encounters the archived document knows where to look for the current truth.

---

## 7. Anti-patterns

### 7.1 Maintaining NIBs in sync with the code

NIBs are not living documents. Maintaining them in sync with the code creates a continuous cost (update at every commit), a risk of subtle divergence (partial sync is worse than no sync), and a self-referential loop (the agent writes the code then updates the NIB that describes the code).

### 7.2 Using a NIB as a reference post-implementation

After the Transition phase, code and tests are the source of truth. Consulting an archived NIB to understand the system's current behavior produces potentially incorrect information.

### 7.3 Writing a NIB for a fix or a refactor

A NIB is a construction document for code that does not exist yet. A fix or a refactor operates on existing code — the code itself is the sufficient context.

### 7.4 Mixing the "why" and the "how"

The "how" has a finite lifespan (it is replaced by the code). The "why" has a permanent lifespan (it explains decisions). Mixing them in the same document means the "why" is archived with the "how" and becomes inaccessible. This is why the "why" is strictly prohibited in NIBs and must be extracted into ADRs during the Conception phase from the initial Cubits Design Docs.

### 7.5 Prescribing always-green tests in the NIB-T

A test that passes trivially before any production runtime code exists is not a RED test. Prescribing it in the NIB-T produces the illusion of coverage while guiding no development. Symptom: the NIB-T prescribes N tests, but after scaffolding stubs that satisfy the public API types, ~10% of them already pass (surface/export checks, constants, fixture-shape tests, mock-helper self-tests). Those tests don't belong in the NIB-T — they belong to a separate GREEN Layer 1 companion list, consumed when the corresponding layer is implemented. See §2.3.1 for the detailed list.

---

*Cubits — "Reliability precedes intelligence."*