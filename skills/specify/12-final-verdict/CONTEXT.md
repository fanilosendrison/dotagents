---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 12
name: "Final Verdict — Extraction-Readiness"
role_description: "Lead Auditor (Synthesis)"
inputs:
  - path: "$RUNDIR/"
    format: "run-directory"
outputs:
  - path: "$RUNDIR/final-verdict.md"
    format: "markdown-final-verdict"
templates:
  - "templates/verdict-template.md"
---

# Step 12: Final Verdict — Extraction-Readiness

Lis tous les rapports dans `$RUNDIR/` :

## Question

> Is the corpus extraction-ready? Can the NIB generator produce all three NIB types without inventing any behavior, boundary, or constraint?

## Execution

**No sub-agents.** You, the main agent, are the lead auditor. Read all five step reports and synthesize the final verdict.

### 6.1 — Read All Step Reports

Read the output files from previous steps in `$RUNDIR/` :
- `$RUNDIR/behavioral-report.md`
- `$RUNDIR/structural-report.md`
- `$RUNDIR/coherence-report.md`
- `$RUNDIR/operational-report.md`
- `$RUNDIR/formal-report.md`

### 6.2 — Determine Which Steps Executed

Identify which steps were reached and their status:

- Step 02–07 (Behavioral): always executed → CLEAN / BLOCKED
- Step 08 (Structural): executed only if Step 07 CLEAN → CLEAN / BLOCKED / NOT REACHED
- Step 09 (Coherence): executed only if Step 08 CLEAN → CLEAN / BLOCKED / NOT REACHED
- Step 10 (Operational): executed only if Step 09 CLEAN → CLEAN / BLOCKED / NOT REACHED
- Step 11 (Formal): executed only if Step 10 CLEAN → Complete / NOT REACHED

The **first BLOCKED step** is the primary verdict driver.

### 6.3 — Produce the Per-CDD Status

For each CDD, produce a consolidated step-by-step status.

### 6.4 — Produce the Corpus-Level Verdict

Aggregate all blocking issues. List which CDDs are extraction-ready and which are blocked.

### 6.5 — Evaluate the Extraction-Readiness Equation

```text
extraction-ready =
    behavioral-complete(Steps 02–07)
  ∧ structural-complete(Step 08)
  ∧ coherent(Step 09)
  ∧ operational-complete(Step 10)
  ∧ formally-conformant(Step 11)
```

For extraction-readiness: Steps 08–11 must all be CLEAN. Step 11 findings (formal conformance) are 🟡 Minor — they do not block extraction-readiness but block `status: baselined`.

### 6.6 — Apply the Three Personas Verification

| Persona | Step | Question | Status |
|---------|------|----------|--------|
| **QA Tester** | Steps 02–07 | Can I mathematically verify every behavior is correct? | YES / NO / NOT REACHED |
| **Developer** | Step 08 | Do I know exactly what to build without ambiguity? | YES / NO / NOT REACHED |
| **SRE Operator** | Step 10 | Do I know how the system recovers from a crash? | YES / NO / NOT REACHED |

*(Step 09 — Coherence — is the architect's perspective, validated by the audit itself.)*

### 6.7 — Produce the Routing Matrix

For every non-`TDD_READY` requirement and every blocker across all executed steps, produce a routable action:

| CDD | Requirement / Concern | Status | Action | Owner |
|-----|----------------------|--------|--------|-------|
| ... | ... | ... | ... | ... |

Each row routes to exactly one owner and one action. No orphan findings.

### 6.8 — Apply the Status Gate

> As long as a single 🔴 Blocker (Steps 02–10) or any Category 2 / Category 3 Finding remains unresolved, every blocked CDD stays at `status: draft`.
>
> Steps 08–11 CLEAN + Step 11 findings resolved → `status: baselined`.
>
> Steps 08–11 CLEAN + Step 11 findings pending → **extraction-ready** but `status: draft` (formal issues remain).

## Output

Write `final-verdict.md` to `$RUNDIR/`, strictly formatted according to `templates/verdict-template.md`.

## Enforcement

> [!CAUTION]
> **You are an auditor, not an editor.** The final verdict is an audit report, not a prescription. Present the findings, the routing matrix, and the extraction-readiness status. **Do not modify any CDD file.** Wait for human validation.
