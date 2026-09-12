---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "operational-rule"
domain: "github-work-management"
severity: "strict"
name: "GitHub Engineering Projects operational core"
---

# GitHub Engineering Projects operational core

Apply this core when a repository declares a GitHub Engineering Project and the
user mentions an Issue, Project item, backlog item, or review finding. Load the
`github-engineering-projects` skill for operation-specific instructions.

## Require a repository profile

Read the repository's `AGENTS.md` and Engineering Project profile before acting.
The profile must provide:

- Project owner, title, number, URL, and visibility;
- default repository for unqualified Issue numbers;
- technical authority order;
- exact field names, option spellings, and meanings;
- exact workflow-status mapping and any blocked-state override;
- current Project views and their intended use;
- repository-specific backlog, review, and validation rules.

Never import field names, statuses, views, priorities, or authority rules from
another repository. If a profile is absent or incomplete, ask for the missing
routing information or propose a profile before mutation.

## Preserve technical authority

Use Issues and Project fields only as the authority for tracked-work existence,
classification, scheduling, and workflow state when the profile says so. Never
treat an Issue, comment, field, discussion, or Pull Request as technical or
product authority.

Apply the repository's declared authority order. Revalidate requested outcomes
against the current source, tests, specifications, architecture, and accepted
decisions. Report conflicts and record accepted technical decisions in the
repository artifact that owns them.

A direct user request selects work. It does not ratify proposed semantics,
satisfy unresolved dependencies, waive tests, or make an unready item
executable.

## Resolve exact identities

Resolve an unqualified `Issue #N` through the profile's default repository.
Treat `owner/repository#N` and Issue URLs as explicit overrides. Never confuse an
Issue number with a Project item ID.

Use the official authenticated GitHub CLI. Require access to both the repository
and Project. Stop on access failure instead of guessing from cached state.

Treat Project fields, views, item classification, and workflow state as mutable
live data. Discover Project, item, field, option, and Issue IDs for each
operation. Never persist opaque IDs in instructions, profiles, or scripts.

Never expose credentials, tokens, authorization headers, credential-bearing
URLs, or private infrastructure data in commands, files, Issue bodies,
comments, receipts, logs, or reports.

## Verify every mutation

Use the installed mechanical adapter at:

```bash
"$HOME/.local/bin/github-engineering-projects"
```

The adapter performs explicit GitHub operations; it does not decide desired
workflow state, priority, classification, dependencies, or Issue creation.
Resolve those decisions from this core, the selected skill context, and the
repository profile.

Re-read the affected Issue, relationship, Project item, and field after every
mutation. Treat a zero exit code as request acceptance only; require the fresh
observed postcondition before reporting success.

Keep GitHub state and repository state factually aligned. Preserve unrelated
worktree and staged changes, satisfy the active permission protocol before
modification, and run every repository-mandated validation before completion.

## Load only the required workflow context

Use the skill router as follows:

- Load Project inspection for membership, fields, views, and any Project
  mutation.
- Load item lifecycle for pickup, active execution, blocking, partial handoff,
  resumption, review, completion, reclassification, and relationship changes.
- Load Issue creation or reuse only when durable work may need a new or existing
  Issue owner.

Load another context only when the work actually enters that branch. Do not load
all workflow branches preemptively.
