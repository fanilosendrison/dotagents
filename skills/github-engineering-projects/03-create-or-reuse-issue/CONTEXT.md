---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 3
name: "Create or reuse a durable GitHub Issue"
role_description: "Validated Issue ownership, decomposition, and Project classification manager"
---

# Create or reuse a durable GitHub Issue

## Decide whether separate work exists

Create or reuse a separate Issue only when validated work must persist beyond
the current discussion and is independently schedulable, must be handed off,
has a distinct authority or acceptance boundary, is a durable external blocker,
or is an out-of-scope finding requiring tracking.

Split a parent only when resulting units have independently meaningful scope,
dependencies, acceptance, or scheduling.

Keep work in the current Issue when it:

- is required by current acceptance criteria;
- was caused by the current change;
- is a required test or validation repair;
- is ordinary in-scope implementation;
- is review feedback within current scope.

Never create a follow-up merely to declare incomplete work complete. Do not
create tracker noise for unvalidated observations, speculative questions,
cosmetic fragments, or duplicates.

## Revalidate and search

Before creation:

1. Search open and closed Issues for the same problem.
2. Revalidate the observation against exact current content.
3. Distinguish evidence, controlling authority, and proposed change.
4. Confirm one independently executable acceptance and scheduling unit.
5. Select native parent, sub-issue, dependency, and Pull Request relationships.
6. Remove credentials, private infrastructure details, and unrelated data.

Reuse an existing Issue whose current scope already owns the work. If it is
closed or appears satisfied, revalidate before reopening or replacing it.

## Write a complete Issue

Use the repository profile's template when present. Otherwise include:

```markdown
## Problem

State the observable concern and why it matters.

## Evidence and provenance

Record the originating review or investigation, exact revision or worktree
context, affected paths or concepts, and reproducible evidence.

## Current authoritative boundary

State what current technical sources require. Separate existing authority from
proposed behavior.

## Scope

Define included work and exclusions.

## Dependencies

Link blocking or parent work with native GitHub relationships.

## Acceptance criteria

List mechanically checkable completion conditions.

## Validation

List required tests, checks, reviews, or qualification evidence.

## Authoritative references

Link the repository sources that control the work.
```

Create the Issue from a reviewed body file with the official `gh issue create`
command. The mechanical adapter does not decide whether an Issue deserves to
exist.

## Add and classify

After creation or validated reuse:

1. Add the Issue to the declared Project with `item add` from the inspection
   context.
2. Apply every field required by the repository profile using exact names and
   `field set`.
3. Default a new finding to the profile's unready backlog unless scope,
   dependencies, authority, acceptance, and validation make it independently
   executable.
4. Add native relationships after both Issue identities exist.
5. Re-read the Issue, comments, relationships, and Project item.

When the new or reused Issue blocks active work, add the native blocked-by
relationship and synchronize the active item through the lifecycle context.

Report why the work could not remain in the original Issue, the new or reused
Issue's number and classification, and the exact relationship.
