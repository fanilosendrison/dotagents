---
name: brief-hostile-review
description: Conducts an adversarial, senior-level review of technical specifications, Normative Implementation Briefs (NIBs), and Dependency Contracts (DCs) using verification-driven active simulation, perspective-based auditing, HAZOP guidewords, and domain-derived fault models. Use when asked to audit, check for blind spots, review, or verify a specification document.
---

# Execute Brief Hostile Review

Perform an adversarial, senior-level specification inspection. The review's goal is to prove the documents defective — the burden of proof is on the document, never on the reviewer.

## 0. Gather Inputs

Collect before auditing. Do not improvise a missing referential — record it under **Unverified Areas** instead.

1. **Target document set**: the lot of NIBs/DCs/specs under review.
2. **Author's synthesis** (optional): the claims of work done or corrections applied. Mandatory for `claim-verification` mode.
3. **Authoritative referentials**:
   * Upstream specs / working RFCs the documents derive from.
   * Source code of every pinned dependency described by a DC.
   * Document methodology templates (e.g., the neelopedia NIB and DC definitions).
   * The already-validated corpus (for cross-document coherence).

## 1. Apply Meta-Rules

1. **Do Not Trust Syntheses**: Never trust the author's summary or claims of corrections. Read every target file directly and check line-by-line.
2. **Enforce the Authoritative Hierarchy**: If specifications diverge, declare the authoritative source and direct the correction downstream:
   * Upstream spec/working RFC > NIB-S/NIB-M.
   * Active dependency source code > Dependency Contract (DC).
3. **Declare Unverified Areas**: Explicitly state what you did *not* check (e.g., "Not verified: whether `logger.emit` exists in v0.9.0 — source file missing"). Do not leave silent assumptions. The report template has a dedicated section for this.
4. **Run Dual-Pass Audits**: Perform a **conformity audit** first (is what is written correct?), followed by an **omission sweep** (what is missing/ignored?). The two passes find disjoint defect sets.
5. **Ban Hedging in Specs**: Flag soft phrases, options, and non-decisions in normative sentences (e.g., "or similar", "might be helper or external library"). A construction spec must make the decision.
6. **Distinguish the Verdict**: Clearly separate a clean status from a partial blocker (e.g., "No blocker for the next lot, but document debt remains").
7. **Respect the Cognitive Budget**: Audit one bounded lot at a time (rule of thumb: at most ~5 documents per pass). Detection quality collapses on oversized batches — split and sequence instead.
8. **Apply the Re-Inspection Criterion**: If blocker density is high (rule of thumb: more than 2 🔴 per document on average, or 4+ 🔴 in a single document), recommend that the lot **returns to drafting** rather than incremental patching.
9. **Classify the Injection Phase**: For each defect, state whether it was injected by the audited document or inherited from the upstream spec. Inherited defects must be fixed at the source first, then propagated.

## 2. Identify the Review Mode

Determine the audit mode before starting:

* `initial-audit`: thorough, line-by-line inspection of a new set of NIBs/DCs.
* `claim-verification`: targeted check of specific claims/fixes reported by the author. Every claim gets a verdict in the Claim Verification Table.
* `blind-spot-sweep`: targeted check for omissions, implicit design assumptions, and failure modes.
* `final-global-scan`: final sweep confirming all documents are aligned, hygiene rules hold (no absolute `file://` links, statuses correct), and 0 blockers remain.

**Iteration rule**: after each correction cycle, re-run `claim-verification` on the fixes plus a fresh `blind-spot-sweep`. The correction loop only cycles `mechanical` findings (see §5); `decisional` findings accumulate in the **Decisions Required** table and are batched to the architect. The review terminates only when a `final-global-scan` concludes **zero findings**, where every `decisional` finding is either resolved by an explicit architect decision or explicitly deferred with a "deferred decision" note in the document.

## 3. Run Checklists, Then Probes

1. **Checklists first** (fast baseline on known failure classes): read and execute [known-failure-classes.md](references/known-failure-classes.md).
2. **Generative probes second** (mandatory): read and execute [probes.md](references/probes.md).

**Hierarchy rule**: the probes prime. Checklists are accelerators derived from past audits — they are a floor, not the perimeter. An audit that only ran the checklists is **not complete**.

## 4. Assign Severity

* 🔴 **Blocker**: the defect would produce an incorrect implementation, a contract violation, a schema invention, an unhandled failure path, or an unresolvable ambiguity in normative content.
* 🟡 **Minor**: debt, readability, cosmetic drift, stale citations in non-normative prose, reading-comfort gaps.
* 🟢/✅ **Compliant**: verified and correct.

Severity is assigned per finding against these definitions — a probe or checklist hit is **not** automatically a blocker.

## 5. Assign Resolution Class

Every finding also gets a **resolution class**, orthogonal to severity. Severity says how grave the defect is; the resolution class says **who can correct it**:

* `mechanical`: the fix is fully determined by an authoritative referential — an autonomous corrector can apply it without consulting the architect.
* `decisional`: the fix requires an architectural choice — only the architect can resolve it.

Classify with three cascading tests:

1. **Source-of-truth test**: can the Corrective Action cite an authoritative referential (upstream spec, dependency source code, methodology template — per meta-rule §1.2) that *uniquely* determines the fix? If yes → `mechanical`.
2. **Normative-surface test**: does the fix alter the contract surface (schema, interface, artifact, error semantics) rather than merely restoring the document's conformity to it? If yes → `decisional`.
3. **Two-reviewers test**: would two competent reviewers produce the same Corrective Action verbatim? If not (two or more defensible options with trade-offs) → `decisional`.

**Hedging rule**: a hedge flagged under meta-rule §1.5 ("or similar", "might be") is a decision *not taken* — the hedge is the symptom, the missing decision is the defect. Always classify it `decisional`, never `mechanical`.

**Corrective Action requirement for `decisional` findings**: do not decide. State the enumerated options, their trade-offs, and the reviewer's recommendation — the architect decides.

The two axes combine independently (severity × resolution): a 🔴 `mechanical` is an immediate auto-fix; a 🔴 `decisional` is a blocking decision request; a 🟡 `decisional` is a deferrable decision request.

## 6. Format the Output Report

### Report Template

```markdown
# Hostile Review Report: [Scope/Project Name]
**Mode**: [Review Mode] | **Status**: [Blockers Found / Pending / Zero Findings]

## 1. Compliance Matrices
[Markdown tables tracking section/template compliance per file]

## 2. Claim Verification Table (claim-verification mode only)
[One row per author claim: claim → file/section/line evidence → ✅/🔴]

## 3. Findings & Actionable Corrections
### [File name or Document ID]
- **[Finding ID] [Severity: 🔴/🟡] [Resolution: mechanical/decisional]** *[Section Reference]* *[Injected here / Inherited from upstream]*
  - **Issue**: [Concise explanation of the defect / contradiction]
  - **Citation**: `[Line content or snippet from spec]`
  - **Source of Truth Reference**: `[Source file path/line or upstream spec line]`
  - **Corrective Action**: [mechanical: exactly what needs to be changed/added | decisional: enumerated options + trade-offs + reviewer recommendation, without deciding]

## 4. Decisions Required
[One row per `decisional` finding: question → options → reviewer recommendation → responsible document. Empty table = no architect intervention needed.]

## 5. Cross-Document Coherence
[Table tracking shared types, interfaces, or constants between files and their matching status]

## 6. Unverified Areas
[Explicit list of what was not checked, and why]

## 7. Final Verdict
> [One-sentence readiness verdict, plus re-inspection recommendation if the §1.8 threshold is met.]
```

## 7. Capitalize

After every audit:

1. If a probe discovered a blind-spot **class** not covered by [known-failure-classes.md](references/known-failure-classes.md), append it there in generalized form (universal question + one concrete example marked as an example).
2. Note the injection-phase pattern: if defects consistently originate upstream, report that the upstream spec — not the briefs — needs a hostile review.
