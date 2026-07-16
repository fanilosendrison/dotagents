---
name: brief-hostile-review
description: Conducts an adversarial, senior-level review of technical specifications, Normative Implementation Briefs (NIBs), and Dependency Contracts (DCs) using verification-driven active simulation, perspective-based auditing, and domain-derived fault models. Use when asked to audit, check for blind spots, review, or verify a specification document.
---

# 🔴 Execute Brief Hostile Review

Perform an adversarial, senior-level specification inspection using perspective-based reading, active design simulation, and FMEA (Failure Mode and Effects Analysis).

## 1. Apply Meta-Rules

1. **Do Not Trust Syntheses**: Never trust the author's summary or claims of corrections. Read every target file directly and check line-by-line.
2. **Enforce the Authoritative Hierarchy**: If specifications diverge, declare the authoritative source and correct the downstream document:
   * Upstream spec/working RFC > NIB-S/NIB-M.
   * Active Dependency source code > Dependency Contract (DC).
3. **Declare Unverified Areas**: Explicitly state what you did *not* check (e.g., "Not verified: whether `logger.emit` exists in v0.9.0—source file missing"). Do not leave silent assumptions.
4. **Run Dual-Pass Audits**: Perform a **conformity audit** first (is what is written correct?), followed by an **omission sweep** (what is missing/ignored?).
5. **Ban Hedging in Specs**: Flag soft phrases, options, and non-decisions (e.g., "or similar", "e.g.", "might be helper or external library") as blockers. Require fully decisive specifications.
6. **Distinguish the Verdict**: Clearly separate a clean status from a partial blocker (e.g., "No blocker for phase 2, but major document debt remains").

## 2. Identify the Review Mode

Determine the audit mode before starting:
* `initial-audit`: Thorough, line-by-line inspection of a new set of NIBs/DCs.
* `claim-verification`: Target check of specific claims/fixes reported by the author.
* `blind-spot-sweep`: Target check for omissions, implicit design assumptions, and failure modes.
* `final-global-scan`: Quick final sweep confirming all documents are aligned, have no absolute `file://` links, and have 0 blockers.

## 3. Run Probes & Checklists

1. Run the **5 Generative Probes** to discover unknown-unknowns and test logic: Read and execute [probes.md](references/probes.md).
2. Run the **7 Verification Checklists** to scan for known error classes: Read and execute [known-failure-classes.md](references/known-failure-classes.md).

## 4. Format the Output Report

Generate the review report using this exact template and severity schema:
* 🔴 **Blocker**: Structural defects, schema inventions, contract violations, or missing error paths.
* 🟡 **Minor**: Debt, readability issues, outdated version citations, or minor formatting issues.
* 🟢/✅ **Compliant**: Valid design elements matching the rules.

### Report Template

```markdown
# Hostile Review Report: [Scope/Project Name]
**Mode**: [Review Mode] | **Status**: [Blockers Found / Pending / Zero Blockers]

## 1. Compliance Matrices
[Insert markdown tables tracking section compliance and files matching templates]

## 2. Findings & Actionable Corrections
### [File name or Document ID]
- **[Finding ID] [Severity: 🔴/🟡]** *[Section Reference]*
  - **Issue**: [Concise explanation of the defect / contradiction]
  - **Citation**: `[Line content or snippet from spec]`
  - **Source of Truth Reference**: `[Source file path/line or upstream spec line]`
  - **Corrective Action**: [Exactly what needs to be changed/added]

## 3. Cross-Document Coherence
[Table tracking shared types, interfaces, or constants between files and their matching status]

## 4. Final Verdict
> [One-sentence summary defining the readiness of the audited files for the construction phase.]
```
