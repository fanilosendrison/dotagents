---
name: cdd-audit
description: Executes a strict, adversarial Hostile Review of a Cubits Design Doc (CDD) draft. Use this skill whenever you are asked to audit, verify, or review an architecture specification or CDD.
---

# Execute Active Audit Protocol: Cubits Design Docs (CDD)

Execute a strict, adversarial Hostile Review of the provided architecture specifications. Do not act as a syntax checker. Act as an architectural enforcer. **The burden of proof is on the document, never on the reviewer.** If a capability or constraint is not explicitly and mechanically provable in the text, assume it does not exist. Your goal is to hunt blind spots, destroy implicit dependencies, and brutally force the factorization of monolithic documents.

> **MANDATORY PREREQUISITE:** You MUST read the root doctrine at `~/neelopedia/engineering/cubits-design-doc.md` before executing this audit.

> [!CAUTION]
> **READ-ONLY ENFORCEMENT: YOU ARE AN AUDITOR, NOT AN EDITOR**
> You must analyze, report, and propose. **DO NOT modify any file yourself.** Generate the audit report and wait for human validation.

## 0. Gather the Corpus (Your Workspace)

Scan and read the entirety of the `/specs` directory (or the user-provided target directory). Do not tunnel-vision on a single file. You must audit the entire corpus (drafts, existing CDDs, STDs, and CNVs) as a coherent whole. 

---

## PART A: Heuristics & Behavior

### 1. Execute the Factorization Engine (The Split)

Apply the split heuristics ruthlessly. If any condition is met, **REJECT the design** and propose an extraction in your report.

1. **Evaluate DAG Split:** If the document describes multiple steps (sequential or parallel) with distinct I/O boundaries, propose the extraction of a **CDD-O (Orchestrator)** and **CDD-N (Node)** documents.
2. **Evaluate Strategy Split:** If the document dictates a specific technological approach where alternatives exist, propose the extraction of a **CDD-I (Interface)** and move the technology to a **CDD-S (Strategy)**.
3. **Evaluate Global Split:** If the document defines a format, naming convention, or invariant consumed by external systems, **REJECT** the local definition. Propose its extraction into a permanent **STD (Standard)** or **CNV (Convention)**.

### 2. Execute Intra-Doc Hostile Review

Torture the internal logic of the isolated component. Destroy the "Happy Path".

1. **Hunt Deferred Decisions:** Flag deferred architectural choices. If the text says "the agent will determine dynamically" or "adapt based on context" without a strict fallback, flag it as an **Absolute Blocker**. Architecture is decided at design time, not implementation time.
2. **Hunt the Unverifiable:** Flag subjective goals. Every Invariant, Goal, and pipeline step MUST be **mechanically verifiable** via scripts (bash, eBPF), strong typing, or logic assertions. If it says "must be fast" instead of "< 200ms", flag it as an **Absolute Blocker**.
3. **Hunt the Magic:** Flag non-deterministic AI assumptions (e.g., "The AI will read and understand"). Require deterministic boundaries.
4. **Hunt Missing Architectural Subjects:** A CDD must explicitly address the following subjects in its text. If the author forgot to define them, flag it as a 🔴 Blocker:
   - *I/O Boundaries:* Exact data contracts (e.g., JSON schema) must be defined.
   - *Anti-Goals:* What the component explicitly will *not* do.
   - *Failure Modes:* Every failure must be mapped to a specific recovery action.
   - *Idempotence & State:* Retry management and state idempotence keys must be defined.
   - *Cleanup:* Exact resource teardown must be dictated.
   - *Security:* Access constraints and trust boundaries must be defined.
   - *Environment:* OS targets, binary dependencies, and network constraints must be defined.
   - *Dependencies:* Upstream and downstream components must be explicitly listed.
5. **Hunt Intra-CDD Contradictions:** Flag Pipeline steps that violate the stated Invariants. Flag internal operations that betray the Non-Goals.

### 3. Execute Global Coherence (Inter-Doc) & Personas Test

Evaluate the document against the entire corpus. A CDD never lives in a vacuum. Verify absolute absence of contradictions:

> **Declare Unverified Areas:** If the document references a `STD`, `CNV`, or upstream `CDD` that you cannot find or read, explicitly declare it as "Unverified" in your report. Do not leave silent assumptions.

1. **Hunt Inter-CDD Contradictions:** Verify that Upstream Outputs perfectly match Downstream Inputs. Flag any mismatch. Flag Upstream `Cleanup` logic that destroys physical/logical resources required by Downstream nodes.
2. **Hunt Corpus Contradictions:** Flag assumptions that violate an existing permanent `STD`. Flag business vocabulary that contradicts a `CNV`. Block the audit if any divergence exists.
3. **Hunt Suboptimal Directory Structure:** The `/specs` directory must not become a flat landfill. Assess the physical folder hierarchy. If documents are not logically grouped by domain (e.g., `/orchestrator/`, `/auth/`) or lifecycle (e.g., `/working/`, `/archive/`), propose an optimal directory tree refactoring.
4. **Execute the 3 Personas Test:** To baseline the CDD, verify it passes 3 perspectives:
   - *Developer:* Do I know exactly what to build without ambiguity?
   - *QA Tester:* Can I mathematically verify it is correct?
   - *SRE Operator:* Do I know how the system recovers from a crash?

### 4. Format the Output Report (Findings)

Generate a structured report listing your **Findings**. Do not silently correct deep issues. 

#### Step 4.1: Assign Severity
Every finding must be assigned a severity rating:
- 🔴 **Blocker:** The defect would produce an incorrect implementation, a contract violation, an unhandled failure path, a subjective unverifiable goal, or an unresolvable ambiguity.
- 🟡 **Minor:** Formatting debt, readability issues, cosmetic drift, missing but deductible metadata.

#### Step 4.2: Assign Resolution Class
Every finding must also be assigned a resolution class (who can fix it). Severity and Resolution Class are orthogonal (e.g., you can have a 🔴 Blocker that is a mechanical Category 1 fix).

**Category 1: Mechanical Resolutions (Trivial Proposals)**
Classify as Category 1 if the resolution is unambiguous or only one viable path exists in the system.
*Action:* Propose the exact correction in the report. **DO NOT modify the file yourself.** The human will validate the application.
*Examples:* YAML schema errors (🟡 Minor), mathematically obvious Failure Mode fixes (🔴 Blocker).

**Category 2: Design Decisions (User Resolution Required)**
Classify as Category 2 if the problem requires architectural arbitration because **multiple trade-offs/paths are viable**. 
*Action:* List the finding, expose the alternatives, and wait for the human to arbitrate. Do not invent the solution.
*Examples:* Factorization arbitration ("Should we extract CDD-I/S?"), Deferred Decisions with multiple viable fallbacks, ambiguous blind spots. (Almost always 🔴 Blocker).

**Category 3: Structural Formatting (Draft Crystallization)**
Classify as Category 3 **strictly for formatting issues** (i.e., the document is a raw conceptual draft lacking the 11 mandatory headers, but the *architectural answers* are present in the text).
> 🛑 **WARNING:** If a subject is entirely missing from the draft (e.g., the author never defined Idempotence or Failure Modes), this is **NOT** a formatting issue. It is a missing architectural decision and must be flagged as a 🔴 Blocker (Category 1 or 2).
*Action:* For purely structural gaps, do not pollute the report by listing 11 separate missing sections. Emit a single 🟡 Minor Category 3 finding: *"Document requires structural crystallization."* Wait for the human to resolve all Category 2 blockers and grant `/go` before mapping the concepts into the Part B layout.

> **Status Gate:** As long as a single 🔴 Blocker or any Category 2 / Category 3 Finding remains, block the document at `status: draft`.

#### Step 4.3: The Re-Inspection Criterion (The Veto)
If the blocker density is too high (e.g., 4+ 🔴 Blockers in a single document), **ABORT** the incremental review. Do not list micro-corrections. Recommend that the document **returns to drafting** (Return to drafting veto).

#### Step 4.4: Strict Output Template
Your final output MUST strictly follow the exact Markdown layout provided in the following asset file. Do not generate conversational filler.

Load and use this template:
[assets/audit-report-template.md](assets/audit-report-template.md)

---

## PART B: The Reference Schema

Validate against this exact structure for every new Cubits Design Doc. Use this strictly as your reading checklist to report deviations.

Load and read this structural reference:
[assets/cdd-structure-reference.md](assets/cdd-structure-reference.md)

### 1. Validate OKF YAML Metadata
Verify the exact `format: "cubits-design-doc"` YAML frontmatter against the reference. Flag invalid schemas in your report.

**Authorized Statuses:**
- `draft`: Subject to Hostile Review. Remains draft if any ambiguity exists.
- `baselined`: Certified "Ready to Freeze". Absolute source of truth.
- `extracted-archive`: Validated and extracted (e.g., NIBs generated).
- `superseded`: Obsolete, replaced by a revamp before extraction.

*(Permanent documents use `kind: "KnowledgeAsset"`, are prefixed **STD-** or **CNV-**, and bypass this lifecycle).*

### 2. Validate Typology
Verify that the CDD strictly obeys one of the 4 profiles. Flag deviations in your report:
- **CDD-O (Orchestrator):** Delegates work. Possesses a DAG, no low-level operations.
- **CDD-N (Node):** The worker. Possesses a strict pipeline, does not delegate.
- **CDD-I (Interface):** The abstract contract. Defines I/O, **omits the Pipeline section**.
- **CDD-S (Strategy):** The operational approach. Inherits I/O, possesses a highly detailed operational pipeline.

### 3. Validate Exact Structural Layout (The Form)
Verify the Markdown layout against the reference. If the conceptual content is validated (Part A) but headers are missing, emit a 🟡 Minor (Category 3) formatting issue in your report. 
