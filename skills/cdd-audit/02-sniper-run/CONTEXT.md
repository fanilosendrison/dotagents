---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 2
name: "Gate 2a — Sniper Run"
role_description: "Runs the 8 parallel sniper audits on every requirements file."
inputs:
  - path: "$RUNDIR/requirements-*.json"
    format: "requirements-json"
outputs:
  - path: "$RUNDIR/sniper-*.json"
    format: "sniper-json"
---

# Step 2: Sniper Run

For each `$RUNDIR/requirements-*.json`, launch the 8 sub-agents in parallel with `context: fresh`:

| # | Agent | Check |
|---|-------|-------|
| 1 | `agents/sniper-1-oracle.md` | Oracle derivability |
| 2 | `agents/sniper-2-precondition.md` | Precondition controllability |
| 3 | `agents/sniper-3-effect.md` | Effect observability |
| 4 | `agents/sniper-4-invariant.md` | Invariant precision |
| 5 | `agents/sniper-5-edge-case.md` | Edge case coverage |
| 6 | `agents/sniper-6-error.md` | Error behavior |
| 7 | `agents/sniper-7-magic.md` | Non-deterministic AI assumptions |
| 8 | `agents/sniper-8-contradictions.md` | Intra-document contradictions |

If 0 FAIL across all documents → skip steps 03–07 and load `08-structural/CONTEXT.md`.

Otherwise, proceed to step 03.
