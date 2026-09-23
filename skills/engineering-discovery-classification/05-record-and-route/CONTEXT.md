---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 5
name: "Record and route a durable engineering discovery"
role_description: "Provenance-preserving discovery record and handoff router"
inputs:
  - path: "current-session"
    format: "engineering-discovery-assessment"
outputs:
  - path: "repository-approved-destination"
    format: "durable-engineering-discovery-record"
---

# Record and route a durable engineering discovery

## Decide whether durability is required

Preserve a discovery beyond working notes when it:

- causes or justifies a durable repository change;
- requires an authoritative decision or conflict resolution;
- must be deferred, scheduled, handed off, or independently reviewed;
- changes a verification, qualification, architecture, or conformance claim;
- must remain traceable for a later executor.

Keep transient, trivial, duplicate, disproven, or fully resolved observations in
working notes unless the repository profile requires a durable record.

## Preserve the complete record

Use the repository's declared template when one exists. Otherwise retain:

```markdown
## Discovery

### Statement
<one atomic claim>

### Source and evidence
<origin, exact evidence, revision, configuration, and provenance>

### Existing authority
<controlling sources, derivation anchors, and conflicts>

### Semantic disposition
<one disposition>

### Affected layers
<one or more layers>

### Related discoveries or consequences
<identifiers and exact relationships, or none>

### Required authority
<decision or acceptance boundary, or none>

### Impacts
<normative, decision, analysis, evidence, implementation, conformance, and governance impacts>

### Next action
<owner, destination, objective action, and preconditions>
```

Do not merge records with different authority, disposition, acceptance, or
scheduling boundaries merely because they came from the same investigation.

## Route to the owning artifact

Use the repository profile to select the durable destination:

- accepted product meaning belongs in the normative contract;
- new semantic choices belong in the declared decision mechanism before
  normative promotion;
- analysis and formal representation belong in their model or design artifacts;
- verification and qualification claims belong in scope-bound evidence records;
- realization choices belong in architecture or implementation artifacts;
- environment limitations belong in conformance artifacts;
- procedural rules belong in repository governance.

An Issue, review note, commit message, or handoff may preserve provenance and
work state, but it does not become product or verification authority unless the
repository explicitly assigns that role.

When durable work must be created, reused, classified, or handed off through a
repository-declared GitHub Engineering Project, load the
`proto-lithify` skill and its repository profile. Do not duplicate
its Issue or Project mechanics here.

Re-read the destination after writing, preserve unrelated worktree state, and
run every repository-mandated validation. Classification and routing never grant
file-modification permission.
