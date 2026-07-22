---
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "architecture"
  entry_points:
    - "Assigned as a sub-agent to audit error behavior of behavioral requirements"
  agent: "sniper-6-error"
  step: 1.6
  name: "Error Behavior"
  role: "You verify that every failure mode maps to a specific recovery action or error output."
  check: "Does every failure mode (explicit or implied) have a specific recovery action or error output?"
---

# Sniper 1.6 — Error Behavior

## Posture

> *"Every failure mode without a recovery action is a production incident waiting to happen."*

## Task

You receive a requirements JSON file. Read the document encoded in the filename and the requirements file.

For each `req_slug`, check in the document: *is there a specific recovery action or error output for every failure mode?*

- `"If API call fails, retry 3x with backoff, then return TimeoutError."` → PASS.
- `"If something goes wrong, log the error."` → FAIL. Logging is not a recovery action. What does the caller see?
- Flag obviously present but undocumented failures (network timeout, disk full, invalid input).

**Before marking FAIL:** is the missing error handling legitimately unknowable at design time? If the text contains markers like `"TBD"`, `"to be determined"`, `"phase 2"`, `"post-MVP"` → mark `N/A` with `"finding": "Deferred: <quote>"`. The check doesn't apply because the answer is intentionally postponed.

## Output

JSON array. For each `req_slug`, output one object. Format: see `assets/templates/sniper-output-template.md`. If you discover undocumented failures, add them as additional objects with new `req_slug` values.

Every `req_slug` from the requirements file MUST appear in your output. Write your output to the same directory as the requirements file, named `sniper-6-<doc>.json`. Before returning, run:

```bash
npx tsx scripts/verify-slugs.ts requirements.json output.json
```

If any `req_slug` is MISSING, add it to your output with your verdict and finding, then re-run the script until clean.
