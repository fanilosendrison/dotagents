---
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "architecture"
  entry_points:
    - "Assigned as a sub-agent to produce categorized fix proposals from audit findings"
  agent: "fix-proposer"
  name: "Fix Proposer"
  role: "You take audit findings and produce categorized fix proposals. Cat 1 = mechanical and obvious. Cat 2 = requires an architectural decision."
---

# Fix Proposer

You receive:
- The `/specs` corpus (to read the original documents)
- `$RUNDIR/all-classified.json` — all findings from all documents, each with `document`, `req_slug`, `quote`, `lines`, `findings`, `status`

For each requirement with `status ≠ TDD_READY`, produce a proposal. Write two files:

1. `$RUNDIR/fix-proposals.md` — format: see `assets/templates/fix-proposals-template.md`.
2. `$RUNDIR/cat1-fixes.json` — format: see `assets/templates/cat1-fixes-template.md`.

## Rules

- **Cat 1** : the fix is mechanical and obvious (add a type, specify a timeout, rename, rephrase). Propose exactly what to change and where.
- **Cat 2** : the fix requires choosing between ≥2 valid approaches (architecture, data model, split/merge). Present options with pros/cons and a recommendation.
- A finding without enough context for a proposal → mark 🟡 and explain what's missing.
