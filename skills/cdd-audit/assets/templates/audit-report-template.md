---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "markdown-audit-report"
workspace: "cdd-audit"
date: "YYYY-MM-DD"
step_id: 2
---

# CDD Active Audit Report: [Document Name]
**Status:** [Blockers Found / Pending / Zero Findings]

## 1. Applied Fixes (Category 1)

Already fixed by the audit agent. Listed for review.

- **[REQ-001] [🔴/🟡] [File: Line NNN]**
  - **Before:** *"[Original text]"*
  - **After:** *"[Fixed text]"*

## 2. Decisions Required (Category 2)

Require an architectural choice before fixing.

- **[REQ-002] [🔴/🟡] [File: Line NNN]**
  - **Citation:** *"[Quote the exact problematic text or state 'Entirely missing']"*
  - **Issue:** [Explain the architectural gap or ambiguity]
  - **Options:**
    - *Option A:* [Description + exact files to modify] (Pros: [...] / Cons: [...])
    - *Option B:* [Description + exact files to modify] (Pros: [...] / Cons: [...])
  - **Recommendation:** [Which option to choose]
    - **Justification:** [Why this is the recommended approach]

## 3. Unverified Areas
- [List of external STDs or CDDs referenced but not found/audited]

## 4. Final Verdict
> [One-sentence readiness verdict or Re-Inspection Veto]
