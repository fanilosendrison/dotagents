---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 8
name: "Gate B — Structural Completeness"
role_description: "Structural Auditor"
inputs:
  - path: ".cdd-audit/LATEST.txt"
    format: "pointer-to-run-dir"
outputs:
  - path: "$RUNDIR/"
    format: "markdown-structural-report"
dependencies:
  - "~/.agents/conventions/cubits-design-doc.md"
  - "assets/cdd-structure-reference.md"
unlock_condition: "Step 02 is CLEAN (every requirement classified)"
---

# Step 3: Structural Completeness

Lis `$RUNDIR/behavioral-report.md` pour connaître l'état du step 2.

## Question

> Is the corpus factored correctly, and are all system boundaries explicit enough for the NIB generator to produce exact type contracts?

## Persona

**DEVELOPER** — *"Do I know exactly what to build without ambiguity?"*

## Unlock Condition

This step only executes if **Step 02 (Behavioral) is CLEAN**. If Step 02 is blocked, do not execute. Report: *"Structural audit blocked: Step 02 (Behavioral) is not clean."*

## Execution

This step uses sub-agents. You, the main agent, act as orchestrator: spawn the sub-agents below, collect their findings, consolidate into the output report.

### Sub-Agent 1: Factorization (entire corpus)

**Context:** Fresh. Provide the entire `/specs` corpus.

**Task:**
Apply the three split heuristics to every CDD in the corpus. If any condition is met, flag it:

**1. DAG Split.** If a CDD describes multiple sequential or parallel steps with distinct I/O boundaries, it must be split into a CDD-O (Orchestrator) and one or more CDD-N (Node) documents. A monolithic CDD that orchestrates AND executes is a 🔴 Blocker.

**2. Strategy Split.** If a CDD dictates a specific technological approach where viable alternatives exist, the interface must be extracted into a CDD-I (Interface) and the technology-specific part moved to a CDD-S (Strategy). Hard-coding a strategy without an abstraction layer is a 🔴 Blocker.

**3. Global Rule Extraction.** If a CDD defines a format, naming convention, vocabulary, or invariant consumed by other components, it must be extracted into a permanent **STD** or **CNV**. A CDD must not legislate for external systems. Local definition of a cross-cutting rule is a 🔴 Blocker.

**Posture:** *"The burden of proof is on the document. If a split condition is met, the CDD is not correctly factored — period."*

### Sub-Agent 2..N: Boundaries (fan-out per CDD)

**Context:** Fresh. Provide only the assigned CDD.

**Task for each CDD:**
For the assigned CDD, verify all five boundary types:

1. **Input contracts.** Exact data types consumed by the component. The NIB generator must be able to produce Zod schemas directly. Prose descriptions = 🔴 Blocker.

2. **Output contracts.** Exact data types produced. Same standard as inputs.

3. **Upstream/downstream identification.** The CDD must explicitly name its upstream providers and downstream consumers. Reference without a named owner = 🔴 Blocker.

4. **Event contracts.** If the component publishes or subscribes to events, schema and semantics must be explicit. Implicit event contracts = 🔴 Blocker.

5. **Error contracts.** Error types returned or propagated at each boundary must be defined. Undefined error surfaces = 🔴 Blocker.

**Posture:** *"If a boundary is described in prose without exact types, it does not exist. The NIB generator cannot compile prose."*

### Sub-Agent: Directory Structure

**Context:** Fresh. Provide the `/specs` directory tree.

**Task:**
Assess the physical folder hierarchy of `/specs`:

- Are documents logically grouped by domain (e.g., `/orchestrator/`, `/auth/`) or lifecycle (e.g., `/working/`, `/archive/`)?
- Is the directory a flat landfill?
- If unorganized, propose an optimal directory tree refactoring.

Emit as 🟡 Minor (Category 1). If already well-structured, report PASS.

## Post-Sub-Agent Consolidation

After all sub-agents complete, consolidate:

- Merge all factorization findings.
- Merge all boundary findings per CDD.
- Merge directory structure findings.
- **Detect loop-back need:** if factorization proposes a split (CDD → CDD-O + CDD-N), flag it: *"DAG split proposed. After applying the split, loop back to Step 01 (Behavioral) on the new CDDs."*

## Clean Criterion

The corpus is correctly factored (no monolithic CDDs), all five boundary types are defined for every CDD, and the directory structure is coherent (or an explicit refactoring plan exists).

## Output

Write `structural-report.md` to `$RUNDIR/`.

```markdown
# Step 2 — Structural Report

## Per-CDD Status

| CDD | Factorization | Input | Output | Up/Down | Events | Errors | Verdict |
|-----|--------------|-------|--------|---------|--------|--------|---------|
| CDD-[TYPE]-[NAME] | PASS / BLOCKED | PASS / BLOCKED | ... | | | | PASS / BLOCKED |

## Factorization Findings
### 🔴 Blockers
- **[CDD]:** DAG Split required — [details] — Category [1/2]
- **[CDD]:** Strategy Split required — [details] — Category 2

## Boundary Findings
### 🔴 Blockers
- **[CDD]:** Input contract undefined — [details] — Category 1

## Directory Structure
### 🟡 Minor
- **Flat landfill.** Proposed tree: [proposal]

## Loop-Back Alerts
- ⚠️ **DAG split on CDD-CHECKOUT** → after applying split, re-run Step 01 (Behavioral) on new CDD-O and CDD-N documents.

## Step 2 Verdict: CLEAN / BLOCKED

- CLEAN: correctly factored, all boundaries typed → proceed to Step 4.
- BLOCKED: monolithic CDD or undefined boundary → fix before advancing.
```
