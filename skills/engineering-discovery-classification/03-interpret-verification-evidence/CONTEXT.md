---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 3
name: "Interpret verification and qualification evidence"
role_description: "Evidence-scope and authority-boundary analyst"
inputs:
  - path: "current-session"
    format: "engineering-discovery-assessment"
outputs:
  - path: "current-session"
    format: "engineering-discovery-assessment"
---

# Interpret verification and qualification evidence

## Treat evidence as evidence

A counterexample, proof result, test result, static-analysis finding,
qualification artifact, benchmark, or passing check establishes only what its
subject, configuration, assumptions, tool, revision, and bounds support. It does
not independently create product semantics or accept a decision.

Before changing an authoritative artifact, determine which case applies:

1. current normative authority already forbids the observed behavior;
2. the model, implementation, property, or test omits an accepted constraint;
3. the evidence exposes an ambiguity or missing product decision;
4. the result is an artifact of abstraction, bounds, fixtures, or environment;
5. the checked property or expected result is wrong;
6. the evidence is invalid, stale, incomplete, or not reproducible;
7. the observed behavior is valid under current authority.

Cases 1 and 2 may support `derived-from-existing-authority` when a complete
derivation exists. Case 3 is `decision-required`. Cases 4 through 6 normally
remain non-normative corrections in the owning analysis or evidence layer. Case
7 requires correcting the property, model, test, or claim rather than
strengthening the product contract.

## Separate representation from obligation

Initially treat structures introduced to express, compute, bound, or check a
property as `no-normative-impact` in `formal-model-or-analysis`. A useful model
identifier, state variable, fairness device, test fixture, sampling bound, or
qualification representation is not an implementation obligation.

Load the normative-impact context only when an independent derivation or an open
semantic choice exists. Never infer:

```text
the checker needs X
therefore every conforming product or implementation requires X
```

## Preserve evidence scope

For a durable verification or qualification claim, record at least the subject
revision, configuration, tool and version, assumptions, finite bounds when
applicable, checked properties, related normative authority, outcome, and
artifact provenance required by the repository profile.

A passing bounded check does not prove an unbounded claim. A focused scenario
does not replace integrated coverage. Planned mappings, generated reports, and
successful command exits are not evidence beyond the authority and scope the
repository assigns them.

## Respond to failing evidence

Preserve the failing evidence before modifying its subject. Map the failed
property or expectation to its intended authority, classify the atomic
discovery, and then correct the owning layer. Do not strengthen a model,
property, test, or product requirement merely to obtain a passing result.

A passing model or test is not a goal when it checks behavior the product never
accepted.
