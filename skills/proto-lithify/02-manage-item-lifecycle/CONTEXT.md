---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 2
name: "Manage GitHub Engineering Project item lifecycle"
role_description: "Truthful lifecycle, handoff, resumption, and completion manager"
---

# Manage GitHub Engineering Project item lifecycle

## Revalidate before execution

1. Read the Issue, comments, relationships, dependencies, acceptance criteria,
   validation obligations, and linked changes.
2. Read live Project fields and their profile-defined meanings.
3. Read every controlling repository source required by `AGENTS.md` and the
   Issue.
4. Revalidate the problem against current content.
5. Inspect the worktree and preserve unrelated local or staged changes.
6. Explain the strategy and satisfy the active permission protocol.
7. Enter the profile's active role only when execution actually begins.
8. Re-read the item and report the transition.

## Keep status truthful

Treat workflow state as a factual projection, not ceremony:

- Leave the item unstarted during discovery, authority checks, dependency checks,
  and strategy preparation.
- Keep it active while work progresses or the current executor retains ownership
  through a short interruption.
- Enter review only when the whole Issue execution is complete and the only
  remaining condition is an explicit external review, approval, acceptance, or
  merge gate.
- Enter blocked only when selected or active work cannot make further safe
  in-scope progress because of a named external prerequisite.
- Enter completed only after all acceptance, validation, publication, approval,
  and repository-specific completion conditions are satisfied.

Derive a review gate only from Issue acceptance criteria, repository governance,
required Pull Request approval or merge, required ADR or policy acceptance,
mandated independent validation, or a direct user request. Do not infer review
from change size, complexity, perceived risk, self-review, or the mere existence
of a Pull Request. Move directly from active to completed when no review gate
remains.

When review requests changes, move to ready if the work is independently
resumable but not active, or move to active when execution actually resumes.

## Record blocking precisely

A blocked state requires:

- exact blocker and evidence;
- external owner, decision, capability, or work item when identifiable;
- objective resumption condition;
- native blocked-by relationship for durable tracked work.

Do not use blocked for normal difficulty, an in-scope defect, a repairable test
failure, a running command, an active delegated task, a short retryable outage,
or pending review. A pre-existing or external validation failure is a blocker
only when no safe in-scope resolution remains and an objective resumption
condition is known.

Use the profile's blocked mapping or fallback. Otherwise retain active for a
brief same-owner interruption and move durable non-executable work to the
profile's unready role. Record the blocker and resumption condition. If no
truthful role exists, report the profile gap before status mutation.

Add an explicit same-repository blocker with:

```bash
"$HOME/.local/bin/proto-lithify" dependency add-blocker \
  --repo "<owner/repository>" \
  --issue "<blocked-issue-number>" \
  --blocker "<blocking-issue-number>"
```

## Preserve partial work

Do not use `Partial` as a generic status:

- Keep active when the executor retains ownership.
- Release to ready only when state is durable, accessible, and independently
  resumable without reopening design or authority.
- Enter blocked for a named external prerequisite.
- Never enter review for an incomplete Issue. Track an independently reviewable
  intermediate deliverable separately when it has its own acceptance boundary.

Before release or handoff, record:

- completed and remaining work;
- exact durable artifacts, commits, branches, or Pull Requests;
- validation executed and results;
- known failures, risks, and blockers;
- worktree or staged-state constraints;
- next safe action and its preconditions.

Do not claim resumability when essential state exists only in an inaccessible
worktree, process, session, or private summary.

## Resume from live evidence

Before resumption, re-read the Issue, comments, relationships, Project fields,
controlling sources, durable artifacts, validations, and worktree. Verify that
no other executor owns the work and that prior assumptions remain current.

Apply transitions through the exact profile mapping:

- ready to active when execution resumes;
- blocked to ready when the blocker is resolved but execution has not resumed;
- blocked to active when it resumes immediately;
- review to ready when requested changes are resumable but not active;
- review to active when requested changes begin.

Do not manufacture a transition solely for elapsed time.

## Keep classifications and relationships accurate

Treat the profile's workflow-status field as workflow state. Treat phase, kind,
priority, and similar fields as classifications. Change classifications only
when current facts or an explicit profile rule require it. Explain material
reclassification and verify the final value.

Use native parent, sub-issue, blocked-by, and linked-change relationships only
when independently true. Do not encode topical similarity or execution
preference as dependency.

## Communicate material transitions

- At start, report the Issue, validated scope, dependencies, strategy, planned
  validation, and active transition.
- During execution, report material scope changes, blockers, durable handoffs,
  failed required validation, and status transitions without narrating every
  command.
- At partial stop, report the reason, completed and remaining work, durable
  artifacts, validation state, resumption condition, and final status.
- At resumption, report what was revalidated, whether the handoff remains exact,
  the new status, and next action.
- At review, identify the explicit outstanding gate and review evidence.
- At completion, report criteria, validation, linked change, final GitHub state,
  and residual risks.

Write an Issue comment only for a durable handoff, blocker, decision, or
validation record needed by future executors.

## Complete accurately

Re-read the latest Issue and comments, verify every criterion, run all mandated
validation, preserve unrelated changes, link the implementation or decision
artifact, record residual risks, and verify final Issue, Pull Request, and
Project state.

Do not close an Issue merely because files were written. Do not leave completed
work active or reviewable work unstarted.
