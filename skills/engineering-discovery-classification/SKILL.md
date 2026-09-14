---
name: "engineering-discovery-classification"
description: "Classifies material engineering discoveries without turning evidence, implementation pressure, or tool output into unauthorized product semantics. Use when review, testing, formal analysis, implementation, integration, or governance work exposes a finding that could affect an authoritative contract, decision, verification or qualification claim, architecture commitment, conformance boundary, or repository-governance rule."
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "engineering-governance"
  entry_points:
    - "Material engineering discovery"
    - "Potential normative or architectural finding"
    - "Verification, qualification, implementation, or conformance finding"
---

# Engineering discovery classification

Apply this skill only to material discoveries. Do not invoke it for a routine
local defect when current authority already defines the expected behavior and no
contract, decision, evidence claim, architecture commitment, conformance
boundary, or governance rule is in question.

## Preserve authority

Treat evidence, analysis, tool output, implementation convenience, and
integration capability as inputs to reasoning, never as decision authority.
Classification does not grant permission to edit and does not replace the
repository's decision, amendment, synchronization, review, traceability, or
validation requirements.

Read the nearest applicable `AGENTS.md` files and any repository-declared
discovery-classification profile before classifying. Repository sources own:

- authority order and decision rights;
- local vocabulary and stable identifiers;
- layer-to-artifact mappings;
- promotion and synchronization rules;
- durable record destinations and validation.

Stop normative promotion when the repository does not identify sufficient
authority or when authoritative sources conflict.

## Keep each record atomic

State one independently classifiable claim per discovery record. Split a source
question from downstream modeling, realization, or conformance consequences and
link the records instead of blurring their classifications.

Every material discovery record must identify:

```text
Statement
Source and evidence
Existing authority
Semantic disposition
Affected layers
Related discoveries or consequences
Required authority
Next action
```

Use exactly one mutually exclusive semantic disposition:

- `authority-conflict-or-uncertain` when missing, conflicting, stale, or
  insufficient authority prevents a sound disposition;
- `decision-required` when the atomic claim would create or select product
  semantics not uniquely determined by current authority;
- `derived-from-existing-authority` when the atomic claim is a normative product
  obligation necessarily entailed by cited current authority;
- `no-normative-impact` when the atomic claim creates no normative product
  obligation, including when non-product authority requires the procedural,
  analytical, evidentiary, implementation, integration, or documentation work.

Select every affected layer that applies:

- `normative-contract`;
- `decision-history`;
- `formal-model-or-analysis`;
- `verification-or-qualification-evidence`;
- `architecture-or-implementation`;
- `integration-or-conformance`;
- `repository-governance-or-documentation`.

Do not resolve a `decision-required` discovery unless the repository's declared
decision authority permits the current actor and process to do so. Task
selection, file-modification permission, an Issue, a modeling assumption, or a
preferred implementation does not by itself accept a semantic decision. Keep
the record locked until the repository-authoritative process accepts the
decision.

Prefer an existing requirement only when cited current authority unambiguously
entails the discovery. An authority conflict or unstated assumption invalidates
that derivation and stops promotion.

## Load only applicable action contexts

Always load
[`01-triage-and-classify/CONTEXT.md`](01-triage-and-classify/CONTEXT.md) for a
material discovery. Then load every additional context whose predicate applies:

- Load
  [`02-assess-normative-impact/CONTEXT.md`](02-assess-normative-impact/CONTEXT.md)
  for normative-contract or decision-history effects, derived or
  decision-required dispositions, authority conflicts, or proposed
  requirements, contracts, invariants, or decision records.
- Load
  [`03-interpret-verification-evidence/CONTEXT.md`](03-interpret-verification-evidence/CONTEXT.md)
  for model checking, formal proof, test or static-analysis claims,
  qualification evidence, abstractions, properties, or evidence scope.
- Load
  [`04-handle-realization-or-conformance-pressure/CONTEXT.md`](04-handle-realization-or-conformance-pressure/CONTEXT.md)
  for architecture or implementation mechanisms, dependencies, adapters,
  providers, harnesses, environments, capabilities, or conformance limits.
- Load
  [`05-record-and-route/CONTEXT.md`](05-record-and-route/CONTEXT.md) when the
  reasoning must survive the session, causes a durable change, requires
  adjudication, handoff, or deferral, or must be routed to an Issue, decision
  record, review record, or another repository artifact.

Contexts compose. A verification counterexample that exposes an undecided
contract question requires contexts 01, 02, and 03; an implementation limitation
that proposes weaker semantics requires contexts 01, 02, and 04.
