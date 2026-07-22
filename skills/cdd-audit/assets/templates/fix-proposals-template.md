---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "markdown-fix-proposals"
workspace: "cdd-audit"
date: "YYYY-MM-DD"
step_id: 2
---

# Fix Proposals Template

Written by `fix-proposer.md` to `fix-proposals.md`.

```markdown
## 1. Findings & Trivial Proposals (Category 1)

- **[REQ-001] [🔴/🟡] [File: Line NNN]**
  - **Citation:** *"[Quote the exact problematic text]"*
  - **Issue:** [Explain exactly why this is a problem]
  - **Correction:** [Explain exactly what to modify in which file(s)]

## 2. Decisions Required (Category 2)

- **[REQ-002] [🔴/🟡] [File: Line NNN]**
  - **Citation:** *"[Quote the exact problematic text or state 'Entirely missing']"*
  - **Issue:** [Explain the architectural gap or ambiguity]
  - **Options:**
    - *Option A:* [Description + exact files to modify] (Pros: [...] / Cons: [...])
    - *Option B:* [Description + exact files to modify] (Pros: [...] / Cons: [...])
  - **Recommendation:** [Which option to choose]
    - **Justification:** [Why this is the recommended approach]
```
