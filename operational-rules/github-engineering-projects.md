---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "operational-rule"
domain: "github-work-management"
severity: "strict"
name: "GitHub Engineering Projects operational protocol"
---

# GitHub Engineering Projects operational protocol

Apply this protocol when a repository declares a GitHub Engineering Project as
its durable work tracker and the user mentions an Issue, Project item, backlog
work, or review finding.

## Require a repository profile

Read the repository's `AGENTS.md` and its Engineering Project profile before
acting. The profile must provide the mutable adapter data that this shared
protocol does not own:

- Project owner, title, number, URL, and visibility;
- default repository for unqualified Issue numbers;
- technical authority order;
- exact field names, option spellings, and meanings;
- exact workflow-status mapping;
- current Project views and their intended use;
- repository-specific backlog, review, and validation rules.

Never import field names, status capitalization, views, priorities, or authority
rules from another repository. If the repository has no profile, ask for the
missing routing information or inspect the Project and propose a profile before
mutating it.

## Keep work management separate from technical authority

Use Issues and Project fields as the authority for the existence,
classification, scheduling, and workflow state of tracked work when the local
profile says so.

Do not assume that an Issue, comment, Project field, discussion, or Pull Request
creates technical or product semantics. Apply the repository's declared
authority order. Revalidate every requested outcome against the current source,
tests, specifications, architecture documents, and accepted decisions that own
that domain.

If tracked work conflicts with a controlling source, report the inconsistency.
Do not silently choose the Issue because it is newer, more specific, or higher
priority. Record an accepted technical decision in the repository artifact that
owns that decision, not only in GitHub work-management state.

## Resolve Issue references explicitly

Interpret an unqualified `Issue #N` using the default repository declared by the
local profile. Treat `owner/repository#N` and Issue URLs as explicit overrides.
Never confuse a repository Issue number with an opaque Project item ID.

Before execution, establish these values from the local profile and resolved
Issue reference:

```bash
PROJECT_OWNER="<project-owner>"
PROJECT_NUMBER="<project-number>"
REPOSITORY_OWNER="<repository-owner>"
REPOSITORY_NAME="<repository-name>"
ISSUE_NUMBER="<issue-number>"
```

If the user names another repository, verify whether that repository belongs in
the selected Project. Do not silently fall back to the profile's default
repository.

## Authenticate and discover live state

Use the official authenticated GitHub CLI. Never expose credentials or token
values in commands, files, Issue bodies, comments, logs, or reports.

```bash
gh auth status
gh project view "$PROJECT_NUMBER" \
  --owner "$PROJECT_OWNER" \
  --format json
gh project field-list "$PROJECT_NUMBER" \
  --owner "$PROJECT_OWNER" \
  --format json
gh issue view "$ISSUE_NUMBER" \
  --repo "$REPOSITORY_OWNER/$REPOSITORY_NAME" \
  --comments

PROJECT_ID="$(
  gh project view "$PROJECT_NUMBER" \
    --owner "$PROJECT_OWNER" \
    --format json \
    | jq -er '.id'
)"

gh api graphql \
  -f project_id="$PROJECT_ID" \
  -f query='query($project_id: ID!) {
    node(id: $project_id) {
      ... on ProjectV2 {
        views(first: 100) {
          nodes { name layout filter }
        }
      }
    }
  }'
```

Treat Project fields, views, item classification, and workflow state as mutable
GitHub data. Query machine-readable state and inspect configured views in the
Project UI at the start of work. Treat the local profile as the intended
contract and live GitHub as the current configuration. Report any difference
before mutation.

A private Project requires access to both the Project and repository. If either
lookup fails, stop and report the access failure rather than guessing from a
cached profile.

## Retrieve the exact Project item

Query the Issue-to-Project relationship directly instead of enumerating a
bounded prefix of the whole Project:

```bash
PROJECT_ID="$(
  gh project view "$PROJECT_NUMBER" \
    --owner "$PROJECT_OWNER" \
    --format json \
    | jq -er '.id'
)"

PROJECT_ITEM_QUERY='query(
  $owner: String!
  $repository: String!
  $number: Int!
) {
  repository(owner: $owner, name: $repository) {
    issue(number: $number) {
      projectItems(first: 100) {
        nodes {
          id
          project { id number title url }
          fieldValues(first: 100) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
      }
    }
  }
}'

gh api graphql \
  -f query="$PROJECT_ITEM_QUERY" \
  -f owner="$REPOSITORY_OWNER" \
  -f repository="$REPOSITORY_NAME" \
  -F number="$ISSUE_NUMBER" \
  | jq --arg project_id "$PROJECT_ID" '
      .data.repository.issue.projectItems.nodes[]
      | select(.project.id == $project_id)
      | {
          id,
          project,
          fields: (
            .fieldValues.nodes
            | map(
                select(.field.name != null)
                | {key: .field.name, value: .name}
              )
            | from_entries
          )
        }'
```

If the Issue is not in the declared Project, report the inconsistency. Add it
only when the Issue is valid durable work governed by that Project. If the
Issue is closed or appears already satisfied, revalidate before reopening it or
creating duplicate work.

## Execute tracked work

Follow this sequence:

1. Read the Issue body, comments, state, relationships, dependencies,
   acceptance criteria, validation requirements, and linked changes.
2. Read the live Project fields and the local profile's meaning for them.
3. Read all controlling repository sources required by `AGENTS.md` and the
   Issue.
4. Revalidate the problem against current content. A historical finding may be
   stale, resolved, superseded, or incorrectly scoped.
5. Inspect the worktree and preserve unrelated local or staged changes.
6. Explain the strategy and satisfy the active permission protocol before any
   modification.
7. Enter the profile's active status only when execution actually begins.
8. Implement only the validated scope and satisfy repository-specific tests and
   acceptance criteria.
9. Link the resulting change or Pull Request to the Issue.
10. Enter the profile's review status only when a reviewable result and its
    required evidence exist.
11. Enter the terminal completed status and close the Issue only when its
    completion conditions are satisfied.

A direct user request selects or prioritizes work. It does not ratify proposed
technical semantics, satisfy unresolved dependencies, waive tests, or convert
an unready item into a mechanically executable one.

Use exact status option names from the local profile. Do not assume that two
Projects capitalize or define equivalent workflow states identically.

## Update single-select fields by discovered identity

Never persist opaque Project, item, field, or option IDs in durable
instructions. Discover them for each mutation:

```bash
set_engineering_project_single_select() {
  issue_number="$1"
  field_name="$2"
  option_name="$3"

  project_id="$(
    gh project view "$PROJECT_NUMBER" \
      --owner "$PROJECT_OWNER" \
      --format json \
      | jq -er '.id'
  )" || return
  item_id="$(
    gh api graphql \
      -f owner="$REPOSITORY_OWNER" \
      -f repository="$REPOSITORY_NAME" \
      -F number="$issue_number" \
      -f query='query(
        $owner: String!
        $repository: String!
        $number: Int!
      ) {
        repository(owner: $owner, name: $repository) {
          issue(number: $number) {
            projectItems(first: 100) {
              nodes { id project { id } }
            }
          }
        }
      }' \
      | jq -er --arg project_id "$project_id" '
          .data.repository.issue.projectItems.nodes[]
          | select(.project.id == $project_id)
          | .id'
  )" || return
  fields="$(
    gh project field-list "$PROJECT_NUMBER" \
      --owner "$PROJECT_OWNER" \
      --format json
  )" || return
  field_id="$(
    printf '%s' "$fields" \
      | jq -er --arg field "$field_name" '
          .fields[]
          | select(.name == $field)
          | .id'
  )" || return
  option_id="$(
    printf '%s' "$fields" \
      | jq -er \
          --arg field "$field_name" \
          --arg option "$option_name" '
          .fields[]
          | select(.name == $field)
          | .options[]
          | select(.name == $option)
          | .id'
  )" || return

  gh project item-edit \
    --id "$item_id" \
    --project-id "$project_id" \
    --field-id "$field_id" \
    --single-select-option-id "$option_id"
}
```

Read the item again after every mutation. A zero exit code proves only that the
request succeeded, not that the intended final state is current.

## Create durable Issues and findings

Create an Issue when validated work must persist beyond the current discussion,
be scheduled later, be handed off, or be tracked independently. Do not create
tracker noise for unvalidated observations, duplicates, or an in-scope fix that
should simply be completed now.

Before creation:

1. Search open and closed Issues for the same problem.
2. Revalidate the observation against exact current content.
3. Distinguish facts, controlling technical authority, and proposed changes.
4. Decide whether the work is one independently executable unit. Split separate
   acceptance or scheduling units and connect them with native GitHub
   relationships.
5. Remove credentials, private infrastructure details, and unrelated data.

Use the repository profile's template when it defines one. Otherwise include:

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

Link blocking or parent work with native GitHub relationships where available.

## Acceptance criteria

List mechanically checkable completion conditions.

## Validation

List required tests, checks, reviews, or qualification evidence.

## Authoritative references

Link the repository sources that control the work.
```

Create the Issue from a reviewed body file, add it to the Project, and apply the
profile's required fields:

```bash
ISSUE_URL="$(
  gh issue create \
    --repo "$REPOSITORY_OWNER/$REPOSITORY_NAME" \
    --title "<specific outcome>" \
    --body-file "<reviewed-issue-body.md>"
)"

gh project item-add "$PROJECT_NUMBER" \
  --owner "$PROJECT_OWNER" \
  --url "$ISSUE_URL"

ISSUE_NUMBER="${ISSUE_URL##*/}"

set_engineering_project_single_select \
  "$ISSUE_NUMBER" \
  "<profile-required-field-name>" \
  "<exact-profile-option-name>"
# Repeat the field update for every field required by the local profile.
```

Default a new finding to the profile's unready backlog state unless its scope,
dependencies, authority boundary, acceptance criteria, and validation contract
already make it independently executable.

## Complete and report accurately

Before reporting completion:

- re-read the latest Issue and comments;
- verify every acceptance criterion;
- run all repository-mandated validation;
- confirm unrelated worktree changes remain intact;
- link the implementation or decision artifact;
- record blocked criteria and residual risks;
- verify final Issue, Pull Request, and Project state from GitHub.

Do not close an Issue merely because files were written. Do not leave completed
work active or reviewable work unstarted. Keep repository state and GitHub
work-management state factually aligned.
