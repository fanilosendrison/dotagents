---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "convention"
domain: "architecture"
severity: "strict"
name: "Cubits Design Doc (CDD) Standard"
---

# 📋 Cubits Design Doc (CDD)

*Cubits — March 2026*

---

## 1. Definition

A **Cubits Design Doc** (CDD) is the foundational architectural and conceptual document of the Explicit Decision-making methodology. It acts as the "Bureau d'études" (Design Bureau) where the system's physics, constraints, and failure modes are brainstormed, debated, and resolved before any implementation instruction is written.

It is the raw material from which the actual assembly manuals (NIBs) are extracted.

### 1.1 The Logical vs Mechanical Boundary

A CDD is exhaustive regarding the **conceptual and logical behavior** of the system. If a functional edge case exists, the CDD must document the expected logical response. 
However, a CDD strictly avoids describing the system in its **mechanical details** (the implementation). The CDD dictates the conceptual physics of *what* the system does, while the NIB dictates the exact syntax, Zod schemas, or APIs used to achieve it.

> **Nuance (Typed Sketches vs Pseudo-code):** While the *logical pipeline* can be expressed abstractly, *functional contracts* (I/O) should be expressed as **Typed sketches** (e.g., `ts` interfaces). TypeScript is vastly superior to pseudo-code here because it leaves **zero ambiguity** and is the native language of the LLM Agents that will consume the CDD to generate NIBs. These sketches remain strictly **non-normative notation** — the exact Zod schema generated in the NIB will be authoritative on any divergence.

### 1.2 What a CDD is not

A CDD is not a traditional spec, a Google Design Doc, or a Normative Implementation Brief (NIB). It is distinguished from each by its combination of properties:

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

### 1.3 The Normative Standards Exception (STD / CNV)

**Normative Standards (STD)** and **Conventions (CNV)** (e.g., Canonical Vocabulary, Workflow Contracts) are born from the exact same conception process as CDDs. In practice, they often start *inside* a CDD and are "factored out" when they become too large or apply globally across the workspace. 
However, once factored out, they become a distinct class of documents: they are **permanent**, act as global rulesets, and are never "archived after NIB generation". They escape the finite CDD lifecycle.

### 1.4 Fundamental property: finite lifespan

The CDD is an architectural scaffolding. Its useful lifespan is strictly **finite**. 
During the conception phase, two permanent artifacts are produced:
1. **Architectural Decision Records (ADR)**: The "why" (debates, rejected alternatives) is extracted from the *brainstorming session* with the agent that led to the final CDD.
2. **Normative Implementation Briefs (NIB)**: The "how" (pseudo-code, schemas, exact constraints) is extracted directly from the mature CDD.

After NIB generation, the CDD is archived. It is not maintained in sync with the codebase. The NIBs take over for the construction phase.



---

## 2. CDD Anatomy

A CDD must contain the raw material necessary for an agent to generate robust NIBs without ambiguity.

**Required content:**

- **Contextual Placement (Workflow Position)** — situating the component within the global architecture (upstream dependencies, downstream consumers).
- **Pedagogical Intent (The Doctrine)** — explaining the abstract mechanics, absolute constraints, and behavioral rules (the **System Physics**).
- **System Boundaries (Functional Contract)** — explicitly defining the conceptual Inputs and Outputs of the module.
- **Infrastructure & Environment Assumptions** — explicitly defining the physical constraints required for the logic to execute (e.g., OS dependencies, network isolation, ephemeral storage). If an assumption applies globally to the workspace, the CDD must not redefine it locally but must link to the appropriate global Standard (e.g., an Environment Contract) as per the Factorization Patterns.
- **Abstract Logical Pathway (The Pipeline)** — the sequential logic required to achieve the goal, described abstractly without exact API calls.
- **Exhaustive Failure Modes Mapping** — identifying conceptual blind spots, functional edge cases, and documenting the expected logical response when things go wrong (the foundation of the fail-closed mentality).
- **Proof of Logic Examples** — concrete payload examples (e.g., real JSON traces), but *only* when strictly necessary to prove a complex logic.

**Forbidden content:**

- **Implementation details & Plumbing** — exact library functions, raw API calls, or specific file system operations (this is left to the NIB).
- **Implementable Source Code** — strictly avoided, with one major exception: **Typed Sketches and Proofs of Concept**. Typed sketches (like `ts` interfaces, precise paths, or exact Git commands) are permitted as functional-contract notation to express logic clearly. They are non-normative: the NIB schema is authoritative on any divergence.
- **Debates and Rejected Alternatives** — the "why" of rejected paths belongs in Architectural Decision Records (ADRs) extracted during the session, not in the final mature CDD.

### 2.1 Scaling & Factorization (The Extraction Patterns)

Unlike generic engineering advice that suggests splitting documents simply when they become "too long to read," a Cubits Design Doc is factored strictly along architectural boundaries. 

When a conceptual design becomes too massive, or when it begins to leak outside its local scope, it must be split using one of the following **Extraction Patterns**. 

#### Pattern A: Spawning Child CDDs (The Umbrella Patterns)
When local execution logic is too dense, the parent document delegates complexity to its children, ensuring the cognitive load remains manageable without losing strictness.

**Trigger 1: Orchestration Node Split (The DAG Pattern)**
- **When to split:** When a phase or subsystem contains internal steps that act as distinct nodes in an execution graph.
- **How it works:** The parent becomes a **CDD-O (Orchestrator)** that retains the high-level topology, the join rules, and the fail-closed logic. The extracted internal steps become **CDD-N (Node)** documents because they possess their own strict Inputs, generate their own distinct Output Artifacts, and manage their own idempotence checkpoints.

**Trigger 2: Interface vs. Operational Split (The Strategy Pattern)**
- **When to split:** When there are mutually exclusive operational approaches to achieving the same architectural goal.
- **How it works:** The parent becomes a **CDD-I (Interface)**. It defines the common contract: the agnostic goals, the shared Inputs/Outputs, and the immutable invariants. The extracted approaches become **CDD-S (Strategy)** documents that define the specific operational pipeline and map out the approach-specific Failure Modes.

#### Pattern B: Spawning Permanent Standards
When a CDD contains concepts or rules that must outlive its own finite lifespan, these elements must be extracted into a permanent `KnowledgeAsset` (a Convention or a Standard).

**Trigger 3: Global Rule Extraction (The Permanent Standard Pattern)**
- **When to extract:** When a piece of logic, data contract, or domain concept meets **at least one** of the following four criteria:
  1. **Cross-Boundary Usage (Transversalité):** The rule or data payload dictates the behavior or inputs of at least one *other* component or CDD in the system. A CDD cannot legislate for other systems.
  2. **The ADR Trigger (Risque de Refonte):** Modifying this rule in the future would break the global architecture and require an Architecture Decision Record (ADR) to debate. It is a structural contract, not a local implementation detail.
  3. **Cognitive Overload (Encombrement Cognitif):** Explaining the concept (e.g., a hashing mechanism or deep domain vocabulary) takes up too much space and drowns out the core execution pipeline of the CDD.
  4. **Permanent Lifespan (Pérennité):** The concept must survive the death of the CDD (which will eventually be archived) to serve as an immutable law for future agents and development phases.
- **How it works:** The specific logic is completely removed from the CDD and placed into a permanent KnowledgeAsset, labeled either as a **STD** (for strict architectural standards) or a **CNV** (for stylistic/process conventions) (e.g., `STD-WORKFLOW-ARTIFACTS` or `CNV-MARKDOWN-FORMATTING`). The CDD then simply references this new asset.

---

### 2.2 The 4 CDD Typologies

The vertical factorization of architectural logic results in four distinct CDD profiles. Each type serves a mathematically precise role in the execution graph, and its ID must be prefixed accordingly to make factorization mechanically verifiable during audits:

#### 1. CDD-O (Orchestrator)
- **Role:** The conductor of a complex phase. It performs no raw work (no parsing, no API calls, no I/O mutations).
- **Focus:** Its anatomy is strictly focused on the execution graph (the DAG), global fail-closed rules, state management, and work delegation. 
- **Example:** `CDD-O-RUN-INIT`

#### 2. CDD-N (Node)
- **Role:** The functional worker. A pure execution unit.
- **Focus:** It takes strict Inputs, applies a ruthless internal logical Pipeline, and outputs predetermined Artifacts. It does not delegate.
- **Example:** `CDD-N-REPO-CAPTURE`, `CDD-N-DIRTY-STATE-CAPTURE`

#### 3. CDD-I (Interface)
- **Role:** The abstract contract for a capability that possesses (or will possess) multiple mutually exclusive operational approaches.
- **Focus:** It dictates the System Boundaries (I/O) and absolute invariants. It does *not* possess a Pipeline, as the operational pipeline depends entirely on the chosen strategy.
- **Example:** `CDD-I-WORKSPACE-SETUP`

#### 4. CDD-S (Strategy)
- **Role:** The operational approach (Adapter) of a `CDD-I`.
- **Focus:** It inherits its System Boundaries from its parent `CDD-I`, but defines a highly operational, low-level Pipeline. This is where Infrastructure & Environment Assumptions are most prominent.
- **Example:** `CDD-S-WORKSPACE-SETUP-SANDBOX` vs `CDD-S-WORKSPACE-SETUP-WORKTREE`

---

## 3. Consumption

The CDD sits at the very beginning of the Explicit Decision-making pipeline:

1. **Conception:** Brainstormed by the Human Architect (ADRs are extracted from the debate during this session).
2. **Translation:** The final, mature CDD is consumed by the **Agent generating NIBs**, which translates the abstract doctrine into strict, Zod-backed, zero-implicit NIB contracts.
3. **Execution:** The CDD is archived. The Implementing Agent takes over using only the NIBs.

### 3.1 Extraction-readiness

A CDD corpus is **extraction-ready** (`baselined`) when the NIB generator can produce all three NIB types without inventing any behavior, boundary, or constraint. If the NIB generator must guess what "correct" means for any requirement, the CDD is not extraction-ready.

The extraction-readiness criterion decomposes into three properties:

- **Behavioral completeness.** Every requirement provides a derivable oracle — the CDD dictates the expected result, not the agent.
- **Structural completeness.** The corpus is factored correctly (no monolithic CDDs), all system boundaries carry typed functional contracts, and no inter-CDD contradiction exists.
- **Operational completeness.** All production constraints (security, idempotence, cleanup, infrastructure, performance, observability) relevant to each component are explicitly defined.

---

## 4. Metadata standard

Each CDD is an OKF `RuntimeArtifact`. It must carry the mandatory OKF metadata along with its specific lifecycle properties:

```yaml
---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cubits-design-doc"
workspace: "go"
date: "YYYY-MM-DD"
step_id: 0                         # Conception step
id: CDD-I-WORKSPACE-SETUP          # Unique identifier (Must be prefixed by CDD-O, CDD-N, CDD-I, or CDD-S)
version: "1.0.0"                   
scope: workspace-isolation         # System covered
status: draft                      # draft | baselined | extracted-archive | superseded
consumers: [agent-generator]       # Who consumes this document
superseded_by: []                  # Filled on archival (points to NIBs/ADRs)
---
```

Lifecycle (`status`): 
- `draft`: Conception in progress, subject to Hostile Review. The document stays here as long as any ambiguity or open design decision remains.
- `baselined`: The design has passed the audit. It is certified "ready-to-freeze" and becomes the absolute source of truth for NIB generation.
- `extracted-archive`: The design has been fully implemented/extracted. It is not obsolete, but its active lifecycle is over.
- `superseded`: The document was replaced by a new baseline (or completely scrapped) due to an architectural revamp prior to extraction.

*No other status value is allowed.*

---

*Cubits — "Design the physics, extract the code."*
