---
name: "cdd-audit"
description: "Executes a strict, adversarial audit of a Cubits Design Doc (CDD) corpus to determine extraction-readiness for NIB generation."
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "architecture"
  entry_points:
    - "User asks to audit, verify, or review a CDD or architecture specification"
    - "User asks whether a corpus is extraction-ready"
---

# CDD Audit (Router)

Audit a CDD corpus through 13 sequential steps (00 → 12) to determine extraction-readiness. Drop into a step folder, read its `CONTEXT.md`, perform the work, then proceed to the next.

## Workflow & Folder Structure

```text
cdd-audit/
├── SKILL.md                         ← You are here (Router).
├── specs/
│   └── new-cdd-audit.md             ← Protocol specification (draft)
├── assets/
│   ├── cdd-structure-reference.md   ← What is mandatory in a CDD
│   └── templates/                   ← Output templates per step
├── agents/                          ← Sub-agent definitions (snipers, lister, fixers, consolidator)
├── scripts/                         ← Classification, merging, slug verification, filtering
├── docs/
│   └── json-schemas.md              ← JSON output schemas
├── 00-index-corpus/                 ← Initialize run directory & index project files
│   └── CONTEXT.md
├── 01-list-requirements/            ← Extract every behavioral requirement per file
│   └── CONTEXT.md
├── 02-sniper-run/                   ← Gate A: 8 parallel snipers on every requirements file
│   └── CONTEXT.md
├── 03-consolidate/                  ← Gate A: consolidate sniper outputs into classified findings
│   └── CONTEXT.md
├── 04-merge-findings/               ← Gate A: merge all classified outputs into one file
│   └── CONTEXT.md
├── 05-propose-fixes/                ← Gate A: generate fix proposals from findings
│   └── CONTEXT.md
├── 06-apply-fixes/                  ← Gate A: apply Category 1 mechanical fixes
│   └── CONTEXT.md
├── 07-filter-report/                ← Gate A: filter applied fixes & assemble behavioral report
│   └── CONTEXT.md
├── 08-structural/                   ← Gate B: factorization, system boundaries, directory structure
│   └── CONTEXT.md
├── 09-coherence/                    ← Gate C: inter-CDD contract matching, vocabulary, STD/CNV compliance
│   └── CONTEXT.md
├── 10-operational/                  ← Gate D: security, idempotence, cleanup, infra, observability, migration
│   └── CONTEXT.md
├── 11-formal/                       ← Formal conformance: OKF frontmatter, typology, structural layout
│   └── CONTEXT.md
└── 12-final-verdict/                ← Synthesize all steps, produce per-CDD & corpus-level verdict
    ├── CONTEXT.md
    └── templates/
        └── verdict-template.md
```

---

## Quick Navigation

| Want to...                                          | Go here first                                |
|-----------------------------------------------------|----------------------------------------------|
| Initialize an audit run & index the project         | `00-index-corpus/CONTEXT.md`                 |
| Extract every behavioral requirement from files     | `01-list-requirements/CONTEXT.md`            |
| Know how the requirement lister sub-agent works     | `agents/requirement-lister.md`               |
| Run the 8 behavioral sniper audits                  | `02-sniper-run/CONTEXT.md`                   |
| Understand a specific sniper's check                | `agents/sniper-N-*.md`                       |
| Consolidate sniper outputs per document             | `03-consolidate/CONTEXT.md`                  |
| Merge all classified outputs into one file          | `04-merge-findings/CONTEXT.md`               |
| Propose fixes for behavioral findings               | `05-propose-fixes/CONTEXT.md`                |
| Apply Category 1 mechanical fixes                   | `06-apply-fixes/CONTEXT.md`                  |
| Filter applied fixes & build the behavioral report  | `07-filter-report/CONTEXT.md`                |
| Know the audit report template                      | `assets/templates/audit-report-template.md`  |
| Audit structural factorization & boundaries         | `08-structural/CONTEXT.md`                   |
| Audit inter-CDD coherence & contracts               | `09-coherence/CONTEXT.md`                    |
| Audit operational constraints (SRE)                 | `10-operational/CONTEXT.md`                  |
| Run formal conformance checks                       | `11-formal/CONTEXT.md`                       |
| Produce the final extraction-readiness verdict      | `12-final-verdict/CONTEXT.md`                |
| Know the verdict output format                      | `12-final-verdict/templates/verdict-template.md` |
| Know the full audit protocol spec (draft)           | `specs/new-cdd-audit.md`                     |
| Know what is mandatory in a CDD                     | `assets/cdd-structure-reference.md`          |
| Know the JSON output schemas                        | `docs/json-schemas.md`                       |
| Verify requirement slugs are valid                  | `scripts/verify-slugs.ts`                    |
| Know how the sniper consolidator works              | `agents/sniper-output-consolidator.md`       |
| Know how the fix proposer works                     | `agents/fix-proposer.md`                     |
| Know how the fixer works                            | `agents/fixer.md`                            |

---

## System Enforcement Rules

- **Strict Isolation:** Execute one step at a time. Never read `CONTEXT.md` files of future steps in advance.
- **Unlock Rule:** A step only executes if the previous step is clean. If blocked, fix and re-run before advancing.
- **Loop-Back Rule:** If a downstream change alters behavior or boundaries, return to the earliest affected step.
- **Read-Only:** You are an auditor, not an editor. Analyze, report, propose. Do not modify CDD files directly.
- **Sub-Agent Discipline:** When a step instructs fan-out, use the sub-agent tool with `context: fresh`. Consolidate outputs before writing to `$RUNDIR/`.
