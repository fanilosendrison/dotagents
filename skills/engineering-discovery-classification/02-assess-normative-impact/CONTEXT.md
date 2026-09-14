---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 2
name: "Assess normative impact"
role_description: "Derivation, semantic-decision, and authority-conflict gate"
inputs:
  - path: "current-session"
    format: "engineering-discovery-assessment"
outputs:
  - path: "current-session"
    format: "engineering-discovery-assessment"
---

# Assess normative impact

## Test a claimed derivation

Classify a statement as `derived-from-existing-authority` only when its
conclusion follows necessarily from cited current authority.

Record:

```text
Discovery
Derived from
Derivation steps
Why no new choice is introduced
Failure if omitted
```

Reject the derivation when it depends on an unstated assumption, selects one of
multiple permitted behaviors, imports common industry practice, or relies on a
specific implementation or analysis representation.

Check that:

1. the cited authority owns the relevant meaning;
2. violating the statement contradicts accepted behavior;
3. independent conforming realizations would still owe the obligation;
4. the statement is no stronger than necessary;
5. any existing requirement that already entails the statement remains the
   preferred owner for its clarification, mapping, formalization, or coverage;
6. the statement is not a modeling, evidence, implementation, integration, or
   governance concern expressed as product semantics.

## Reuse existing normative identities

When cited authority already entails the discovery, prefer correcting or
extending the existing requirement's mapping, formalization, clarification, or
test coverage over creating another normative identity. Mint a new identity
only when the repository's admission and amendment rules establish a genuinely
distinct obligation.

Do not edit an immutable record or broaden an accepted requirement merely to
avoid a new decision. Follow the repository profile's amendment and promotion
rules.

## Keep new decisions locked

Use `decision-required` when accepted authority does not uniquely determine the
behavior. Record the open question, viable alternatives, observable
consequences, compatibility implications, and required decision authority.

Do not select an alternative because it is cleaner, conventional, easier to
model, easier to implement, supported by a preferred provider, or likely to make
a check pass.

Keep the discovery unresolved until the repository-authoritative process accepts
the decision. Explicit task selection, permission to modify files, an Issue, a
review suggestion, a model assumption, or an agent recommendation does not
constitute semantic acceptance unless the repository's authority contract says
that it does.

Until acceptance, make downstream work do one of the following:

- preserve or abstract over the viable alternatives;
- exclude the undecided behavior explicitly from the current scope;
- state a non-normative assumption without presenting it as product meaning;
- stop when safe progress depends on the decision.

## Preserve authority conflicts

Use `authority-conflict-or-uncertain` when controlling sources disagree or a
derivation cannot establish its premises. Report every side and the exact
resolution mechanism declared by the repository. Do not silently choose by
recency, convenience, perceived quality, or implementation feasibility.

## State the minimum accepted obligation

When a derived requirement or accepted decision permits normative wording,
state the weakest observable obligation sufficient to protect the accepted
intent. Keep algorithms, storage choices, identifiers, APIs, libraries, and
environment-specific mechanisms replaceable unless accepted product authority
requires them.

Classification never bypasses the repository's permission, decision,
amendment, synchronization, traceability, review, or validation gates.
