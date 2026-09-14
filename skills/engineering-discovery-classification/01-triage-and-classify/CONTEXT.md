---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 1
name: "Triage and classify a material engineering discovery"
role_description: "Authority-aware discovery triage and classification"
inputs:
  - path: "current-session"
    format: "engineering-discovery-context"
outputs:
  - path: "current-session"
    format: "engineering-discovery-assessment"
---

# Triage and classify a material engineering discovery

## Establish materiality

Treat a discovery as material when accepting it could change or contradict an
authoritative contract, decision, externally observable obligation,
architecture commitment, verification or qualification claim, conformance
boundary, or repository-governance rule.

Do not create classification ceremony for an observation that is both local and
fully determined by current authority. Route a routine defect through the
applicable bug or implementation workflow. Re-enter this protocol if the defect
exposes ambiguity, conflicting authority, a broader claim, or pressure to change
the accepted behavior.

## State one claim

Write a falsifiable statement describing the discovery without embedding its
preferred resolution. Separate:

- observed evidence;
- interpretation of that evidence;
- proposed product or technical change;
- downstream consequences.

Create linked records when those statements have different dispositions or
layers. A product ambiguity, a provider limitation, an implementation
mechanism, and a formal abstraction are separate records even when one caused
the next.

## Read current authority

Read the nearest applicable repository directives, the declared discovery
profile when one exists, and the exact sources governing the statement. Do not
classify from summaries, generated projections, Issues, historical reports, or
tool output when the repository assigns authority elsewhere.

Record both supporting and conflicting authority. Use
`authority-conflict-or-uncertain` when the applicable authority is missing,
inconsistent, stale, or dependent on an unstated assumption.

## Assign the semantic disposition

Choose exactly one using this precedence:

- `authority-conflict-or-uncertain`: classification cannot be completed without
  resolving authority, provenance, contradiction, or an unstated premise;
- `decision-required`: the statement would create or select product semantics
  while multiple behaviors remain compatible with current authority;
- `derived-from-existing-authority`: the statement is a normative product
  obligation necessarily entailed by cited accepted authority and introduces no
  new choice;
- `no-normative-impact`: the statement creates no normative product obligation,
  even when non-product authority requires the procedural, analytical,
  evidentiary, implementation, integration, or documentation work.

Classification describes the atomic statement, not the source tool. A model
checker can expose any disposition; an implementation observation can expose a
new semantic decision.

## Mark every affected layer

Select all applicable layers from the skill contract. Use
`architecture-or-implementation` only for replaceable realization choices or
internal structure. Route an externally observable product choice to
`normative-contract` and load the normative-impact context.

Distinguish a formal representation from evidence produced by checking that
representation. Distinguish repository procedure or documentation from product
semantics.

## Produce the working record

Use this concise form in working notes:

```markdown
## Discovery

### Statement
<one atomic claim>

### Source and evidence
<origin, exact evidence, revision or state when relevant>

### Existing authority
<current controlling sources and conflicts>

### Semantic disposition
<one disposition>

### Affected layers
<one or more layers>

### Related discoveries or consequences
<linked records or none>

### Required authority
<authority needed for the next action or none>

### Next action
<next module, correction, decision, stop, or routing action>
```

Load every applicable context identified by the disposition, layers, evidence,
and next action. Stop any semantic promotion while the disposition remains
`authority-conflict-or-uncertain`.
