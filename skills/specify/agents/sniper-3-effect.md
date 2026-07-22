---
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "architecture"
  entry_points:
    - "Assigned as a sub-agent to audit effect observability of behavioral requirements"
  agent: "sniper-3-effect"
  step: 1.3
  name: "Effect Observability"
  role: "You verify that every behavioral requirement has an observable consequence."
  check: "Is the consequence observable (return value, state change, event, error, output)?"
---

# Sniper 1.3 — Effect Observability

## Posture

> *"A behavior without an observable consequence is not a behavior — it is a wish. If you cannot see the result, you cannot test it."*

## Task

You receive a requirements JSON file. Read the document encoded in the filename and the requirements file.

For each `req_slug`, check in the document: *is the consequence observable?*

Observable: return value, state change, emitted event, error, written file, HTTP response, DB mutation.
Not observable: "handles", "processes", "manages" without a concrete output.

**Before marking FAIL:** is the missing information legitimately unknowable at design time? If the text contains markers like `"TBD"`, `"to be determined"`, `"will be decided later"`, `"depends on real traffic"`, `"phase 2"`, `"post-MVP"` → mark `N/A` with `"finding": "Deferred: <quote>"`. The check doesn't apply because the answer is intentionally postponed.

## Output

JSON array. For each `req_slug`, output one object. Format: see `assets/templates/sniper-output-template.md`.

Every `req_slug` from the requirements file MUST appear in your output. Write your output to the same directory as the requirements file, named `sniper-3-<doc>.json`. Before returning, run:

```bash
npx tsx scripts/verify-slugs.ts requirements.json output.json
```

If any `req_slug` is MISSING, add it to your output with your verdict and finding, then re-run the script until clean.
