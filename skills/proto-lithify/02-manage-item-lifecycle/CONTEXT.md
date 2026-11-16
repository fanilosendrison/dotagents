---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 2
name: "Manage GitHub Engineering Project item lifecycle"
role_description: "Truthful lifecycle, handoff, resumption, and completion manager"
inputs: []
outputs: []
---

# Manage GitHub Engineering Project item lifecycle

## Contents

- [Revalidate before execution](#revalidate-before-execution)
- [Handle changes to governing sources and inputs](#handle-changes-to-governing-sources-and-inputs)
- [Reuse interpretation-sensitive material](#reuse-interpretation-sensitive-material)
- [Keep status truthful](#keep-status-truthful)
- [Record blocking precisely](#record-blocking-precisely)
- [Preserve partial work](#preserve-partial-work)
- [Resume from live evidence](#resume-from-live-evidence)
- [Keep classifications and relationships accurate](#keep-classifications-and-relationships-accurate)
- [Communicate material transitions](#communicate-material-transitions)
- [Complete accurately](#complete-accurately)

## Revalidate before execution

1. Read the Issue, comments, relationships, dependencies, acceptance criteria,
   validation obligations, and linked changes.
2. Read live Project fields and their profile-defined meanings.
3. Read every controlling repository source required by `AGENTS.md` and the
   Issue.
4. For pickup and resumption, apply the
   [executable mandate completeness criterion](../03-create-or-reuse-issue/CONTEXT.md#executable-mandate-completeness).
   Consult that criterion only; this does not select the Issue-creation workflow.
5. Revalidate the problem against current content and apply the
   [source-change procedure](#handle-changes-to-governing-sources-and-inputs).
6. Inspect the worktree and preserve unrelated local or staged changes.
7. Explain the strategy and satisfy the active permission protocol.
8. Enter the profile's active role only when execution actually begins.
9. Re-read the item and report the transition.

## Handle changes to governing sources and inputs

Apply this procedure when a source consumed by a mandate changes, is renamed,
replaced, withdrawn or becomes inaccessible. Revalidate applicability at pickup,
resumption and before completion, including changes since the mandate's baseline
or last validated handoff. Cover every relevant input, not only plans or product
contracts.

1. Establish the source's responsibility, applicable revision and scope through
   the repository's authority and adoption/change rules. Identify the accepted
   decision when replacement or withdrawal requires one. A new file, unchanged
   path, newer version or descriptive status label does not establish authority
   or supersession. Do not invent a missing transition rule.
2. Distinguish the mandate's historical baseline from currently applicable
   instructions. An older source may remain explicitly incorporated; a pinned
   reference alone does not waive current authority. A reference must identify
   which use is intended.
3. Compare the relevant old and new requirements, definitions, assumptions,
   dependencies and validation obligations. Identify affected mandates and
   downstream consumers of their results, including work already in progress.
   Use Git and native work relationships; neither a text search nor matching
   identifiers proves semantic coverage or absence of impact.
4. Record the impact assessment in the Issue owning the change, or in the current
   Issue when assessing an external change, with exact references, affected
   scope, required decisions and reasons for preserving or revising mandates.
   Link the assessment from affected work when needed for independent pickup or
   handoff; do not maintain another work registry.
5. Preserve an unaffected mandate's baseline when its applicability is justified.
   For affected work, update the body, necessary references and acceptance only
   within accepted authority, then revalidate readiness and completion claims.
   Never bulk-repin, clone the hierarchy or reopen completed work merely because
   a source changed. An Issue edit cannot accept a technical decision that
   belongs in another artifact.
6. Treat undetermined impact as unresolved, not as absence of impact. Do not
   present an affected mandate as executable during an incompatible transition
   or continue the action whose authority or inputs cannot be established.
   Apply the profile's unready/blocked conditions without blocking independent
   work or relabeling an ordinary in-scope repair. Coordinate with an active
   executor; do not take over its work or treat a field edit as proof it stopped.
7. Preserve historical results with their original subjects and assumptions.
   Distinguish an invalid original conclusion from a valid conclusion that no
   longer applies to a new subject. Reassess the former resolution when evidence
   invalidates it; justify transfer separately for the latter. Record an accepted
   withdrawal or supersession of a mandate without claiming its original
   objective was achieved; report a missing lifecycle disposition rather than
   inventing one.

These are agent workflow obligations, not an automatic semantic checker or an
atomic transaction across Git and GitHub. A successful check or field mutation
establishes only its verified scope, not the legitimacy of an adoption or the
absence of every contradiction.

## Reuse interpretation-sensitive material

Before using a definition, conclusion, review or handoff as a premise, identify
its owning source, relevant scope and exact revision when meaning depends on
it. Follow the repository's terminology and reproduction policy. Where that
policy requires reference-only use, link directly to the owning passage instead
of copying, paraphrasing or generating another definition. Do not turn an index,
a summary or an Issue into the owner of meaning.

Reference a shared source context once where it makes a document or mandate
independently usable; identify material departures explicitly. Do not require a
universal header on ordinary comments. A durable result, review or handoff must
identify the exact artifact and scope it concerns, directly or through an
explicit, retrievable revision-bound reference.

Do not assign an old message the context of its parent's current mutable body,
the latest glossary or the message date. Recover the source actually identified
for that use. If its interpretation cannot be established, preserve the gap;
do not reuse the claim as established. Continue independent or explicitly
conditional analysis only within its declared scope.

Keep distinct meanings, model-local definitions and competing proposals
separate. Matching words or identifiers do not establish semantic identity.
Apply the [source-change procedure](#handle-changes-to-governing-sources-and-inputs)
when a required source changes; preserve old result contexts without silently
repointing them or retroactively rewriting discussions. A verified link or
publication establishes neither interpretation completeness nor claim truth.

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

Re-read the latest Issue and comments, apply the
[source-change procedure](#handle-changes-to-governing-sources-and-inputs), verify
every criterion, run all mandated validation, preserve unrelated changes, link
the implementation or decision artifact, record residual risks, and verify final
Issue, Pull Request, and Project state.

Do not close an Issue merely because files were written. Do not leave completed
work active or reviewable work unstarted.
