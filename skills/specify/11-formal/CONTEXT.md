---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 11
name: "Formal Conformance Pass"
role_description: "Schema & Formatting Validator"
inputs:
  - path: "/specs/"
    format: "markdown-cdd-corpus"
  - path: "$RUNDIR/"
    format: "run-directory"
outputs:
  - path: "$RUNDIR/formal-report.md"
    format: "markdown-formal-report"
dependencies:
  - "~/.agents/conventions/cubits-design-doc.md"
  - "assets/cdd-structure-reference.md"
unlock_condition: "Step 10 is CLEAN (all operational constraints defined)"
---

# Step 11: Formal Conformance Pass

Lis `$RUNDIR/operational-report.md` pour connaître l'état du step 10.

## Question

> Is the document formally well-formed? Are its metadata, typology, and layout correct?

This is the **final pass**, not a blocking gate. Formal conformance issues (frontmatter, headers, typology labels) do not prevent NIB generation — the architectural content is already validated by Steps 02–10. However, they **must be resolved before the CDD can be baselined**.

## Unlock Condition

This step only executes if **Step 10 (Operational) is CLEAN**. If Step 10 is blocked, do not execute. Report: *"Formal pass blocked: Step 10 (Operational) is not clean."*

## Execution

**No sub-agents.** This pass is fast enough to run directly. Read every CDD in the corpus and validate the three checks below.

### Check 5.1 — OKF YAML Frontmatter

Verify the YAML frontmatter of every CDD against the reference in `assets/cdd-structure-reference.md` and the doctrine:

- `format` must be exactly `"cubits-design-doc"`. Flag any invalid or missing value.
- `status` must be one of: `draft`, `baselined`, `extracted-archive`, `superseded`. No other value is allowed.
- Permanent documents (prefixed `STD-` or `CNV-`) must use `kind: "KnowledgeAsset"` and bypass the CDD lifecycle.

Flag as 🟡 Minor (Category 1: Mechanical — propose the exact correction). A frontmatter issue is never a 🔴 Blocker at this stage; the architectural content is already validated.

### Check 5.2 — Typology

Verify that every CDD strictly obeys **exactly one** of the four typological profiles:

| Profile | Role | Rules |
|---------|------|-------|
| **CDD-O** (Orchestrator) | Delegates work to nodes | Possesses a DAG. Does NOT perform low-level operations. |
| **CDD-N** (Node) | The worker | Possesses a strict pipeline. Does NOT delegate. |
| **CDD-I** (Interface) | The abstract contract | Defines I/O contracts. **Omits the Pipeline section.** |
| **CDD-S** (Strategy) | The operational approach | Inherits I/O from a CDD-I. Detailed operational pipeline. |

Flag profile violations:
- Unambiguous fix → 🟡 Minor, Category 1 (Mechanical).
- Multiple valid profiles → 🟡 Minor, Category 2 (Design Decision — present alternatives).

Typology issues flagged here are formatting/labeling concerns. If the CDD genuinely acts as multiple profiles (a monolithic orchestrator-executor), that should have been caught at Step 08 (Structural). If it was missed, escalate to 🔴 Blocker and loop back.

### Check 5.3 — Structural Layout

Verify the Markdown layout against the 11 mandatory headers defined in `assets/cdd-structure-reference.md`.

- If architectural **content** is present but headers are missing or malformed → emit a **single 🟡 Minor (Category 3):** *"Document requires structural crystallization."*
- If a subject is entirely **absent** and was missed by Steps 1–4 → this is a genuine gap. Escalate to 🔴 Blocker and loop back to the relevant step (02–10).

## Pass Complete

This pass always completes — it never blocks progression to the Final Verdict. Its findings are injected into the verdict as 🟡 Minor issues that must be resolved before `status: baselined`.

## Output

Write `formal-report.md` to `$RUNDIR/`.

```markdown
# Step 5 — Formal Conformance Report

## Per-CDD Status

| CDD | Frontmatter | Typology Label | Layout | Notes |
|-----|------------|---------------|--------|-------|
| CDD-O-NAME | PASS / MINOR | PASS / MINOR | PASS / CAT3 | [details] |

## Findings

### 🟡 Minor (Category 1 — Mechanical)
- **[CDD]:** Frontmatter — `status` is "wip", must be "draft" — propose: change to `status: draft`

### 🟡 Minor (Category 2 — Design Decision)
- **[CDD]:** Typology — declared CDD-O but id uses CDD-N prefix. Two valid fixes: rename id to CDD-O-* or change typology to CDD-N. Architect must decide.

### 🟡 Minor (Category 3 — Structural Formatting)
- **[CDD]:** Document requires structural crystallization. Content present but headers do not follow the 11-header layout.

### 🔴 Blocker (Missed by earlier steps — loop back)
- **[CDD]:** Anti-goals section missing AND no anti-goal content found. This should have been caught at Step 02. Loop back to Step 02 (Sniper Run) for this CDD.

## Step 11 Pass Complete

All findings are non-blocking for extraction-readiness. Resolve before baselining.

→ Proceed to Step 12 (Final Verdict).
```
