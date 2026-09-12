---
name: "github-engineering-projects"
description: "Operates repository-declared GitHub Engineering Projects: inspects tracked Issues and Project items, manages lifecycle and handoffs, and creates or reuses durable Issues. Use when a user requests Issue, Project, backlog, agent-queue, or review-finding work in a repository with an Engineering Project profile."
compatibility: "Requires Node.js 22.19.0 or newer, the official authenticated gh CLI, and the installed github-engineering-projects executable."
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "github-work-management"
---

# GitHub Engineering Projects

Apply this skill when a repository declares a GitHub Engineering Project and the user mentions an Issue, Project item, backlog item, or review finding.

## Require a repository profile

Read the target repository's `AGENTS.md` and Engineering Project profile before acting.

Require the profile to provide:
- Project owner, title, number, URL, and visibility;
- default repository for unqualified Issue numbers;
- technical authority order;
- exact field names, option spellings, and meanings;
- exact workflow-status mapping and any blocked-state override;
- current Project views and their intended use;
- repository-specific backlog, review, and validation rules.

Never import field names, statuses, views, priorities, or authority rules from another repository.
If a profile is absent or incomplete, ask for the missing routing information or propose a profile before mutation.

## Preserve technical authority

Use Issues and Project fields only as the authority for tracked-work existence, classification, scheduling, and workflow state when the profile says so.
Never treat an Issue, comment, field, discussion, or Pull Request as technical or product authority.

Apply the repository's declared authority order.
Revalidate requested outcomes against the current source, tests, specifications, architecture, and accepted decisions.
Report conflicts and record accepted technical decisions in the repository artifact that owns them.

A direct user request selects work. It does not ratify proposed semantics, satisfy unresolved dependencies, waive tests, or make an unready item executable.

## Resolve exact identities

Resolve an unqualified `Issue #N` through the profile's default repository.
Treat `owner/repository#N` and Issue URLs as explicit overrides.
Never confuse an Issue number with a Project item ID.

Use the official authenticated GitHub CLI.
Require access to both the repository and Project.
Stop on access failure instead of guessing from cached state.

Treat Project fields, views, item classification, and workflow state as mutable live data.
Discover Project, item, field, option, and Issue IDs for each operation.
Never persist opaque IDs in instructions, profiles, or scripts.

Never expose credentials, tokens, authorization headers, credential-bearing URLs, or private infrastructure data in commands, files, Issue bodies, comments, receipts, logs, or reports.

## Verify every mutation

Use the installed mechanical adapter:

```bash
"$HOME/.local/bin/github-engineering-projects"
```

The adapter performs explicit GitHub operations; it does not decide desired workflow state, priority, classification, dependencies, or Issue creation.
Resolve those decisions from this skill, the selected workflow context, and the repository profile.

Re-read the affected Issue, relationship, Project item, and field after every mutation.
Treat a zero exit code as request acceptance only; require the fresh observed postcondition before reporting success.

Keep GitHub state and repository state factually aligned.
Preserve unrelated worktree and staged changes.
Satisfy the active permission protocol before modification.
Run every repository-mandated validation before completion.

## Verify the mechanical adapter

Before the first GitHub operation:

```bash
"$HOME/.local/bin/github-engineering-projects" doctor
```

## Load only the required workflow context

Load only the context required for the current operation:

- For Project or item inspection and every Project field mutation, read [`01-inspect-project/CONTEXT.md`](01-inspect-project/CONTEXT.md).
- For pickup, execution, status changes, blocking, partial work, handoff, resumption, review, completion, reclassification, or relationship changes, also read [`02-manage-item-lifecycle/CONTEXT.md`](02-manage-item-lifecycle/CONTEXT.md).
- For creating, reusing, or decomposing durable Issues, also read [`03-create-or-reuse-issue/CONTEXT.md`](03-create-or-reuse-issue/CONTEXT.md).

If work enters another branch later, load its context at that point.
Keep workflow decisions in the skill and repository profile; use the CLI only for mechanical GitHub operations and verified receipts.
