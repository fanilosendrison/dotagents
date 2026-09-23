---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 1
name: "Inspect GitHub Engineering Project"
role_description: "Live Project state inspector and mechanical mutation adapter"
---

# Inspect GitHub Engineering Project

## Establish routing

Resolve these values from the repository profile and requested Issue:

```text
project owner
project number
repository owner/name
Issue number or URL
```

Do not guess a missing value or reuse one from another repository.

## Read the Issue

Use the official CLI to read the current Issue body, comments, state,
relationships, dependencies, acceptance criteria, validation obligations, and
linked changes. Confirm that the Issue belongs to the declared Project.

Use the installed adapter for normalized Project state:

```bash
"$HOME/.local/bin/proto-lithify" project inspect \
  --project-owner "<project-owner>" \
  --project-number "<project-number>"

"$HOME/.local/bin/proto-lithify" item inspect \
  --project-owner "<project-owner>" \
  --project-number "<project-number>" \
  --repo "<owner/repository>" \
  --issue "<issue-number>"
```

Compare live fields and views with the repository profile. Report every mismatch
before relying on the affected routing or mutating state.

If the Issue is absent from the Project, report the inconsistency. Add it only
when the applicable creation or lifecycle context establishes that it is valid
durable work for that Project.

## Apply explicit Project mutations

After the selected workflow context determines the exact desired field and
option, invoke:

```bash
"$HOME/.local/bin/proto-lithify" field set \
  --project-owner "<project-owner>" \
  --project-number "<project-number>" \
  --repo "<owner/repository>" \
  --issue "<issue-number>" \
  --field-name "<exact-field-name>" \
  --option-name "<exact-option-name>"
```

To add an already validated Issue to the Project, invoke:

```bash
"$HOME/.local/bin/proto-lithify" item add \
  --project-owner "<project-owner>" \
  --project-number "<project-number>" \
  --repo "<owner/repository>" \
  --issue "<issue-number>" \
  --issue-url "<absolute-issue-url>"
```

Treat `noop` as success only when the receipt proves the requested current
state. For `applied`, require a verified fresh postcondition. Re-read the Issue
and Project item independently before reporting completion.

Never pass a status, phase, kind, priority, field, or option that was not resolved
from the current repository profile and workflow decision.
