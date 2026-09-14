---
okf_version: "1.0"
kind: "AgentWorkflowStep"
step_id: 4
name: "Handle realization and conformance pressure"
role_description: "Semantics-preserving implementation and integration analyst"
inputs:
  - path: "current-session"
    format: "engineering-discovery-assessment"
outputs:
  - path: "current-session"
    format: "engineering-discovery-assessment"
---

# Handle realization and conformance pressure

## Separate obligations from mechanisms

Identify the accepted observable obligation before evaluating architecture or
implementation. Treat replaceable algorithms, data structures, storage,
protocols, libraries, process boundaries, APIs, identifiers, and concurrency
mechanisms as `no-normative-impact` in `architecture-or-implementation` unless
repository authority requires that exact mechanism.

Do not classify an externally observable product choice as an internal
architecture mechanism. Split it into a linked normative record and load the
normative-impact context.

## Preserve semantics under implementation pressure

When an implementation mechanism is difficult, expensive, or incompatible with
an accepted obligation, record:

```text
Accepted obligation
Observed implementation pressure
Why the current mechanism conflicts
Semantics-preserving alternatives
Capability or dependency gap
Related decision proposal, if any
```

Prefer a different mechanism over weakening the accepted contract. When no
preserving mechanism is currently known, report the capability gap or blocked
implementation honestly.

If changing observable behavior is proposed, create a separate
`decision-required` discovery. Do not let the implementation record resolve or
hide that decision.

## Keep integration limits in the conformance layer

Treat adapter, provider, harness, operating environment, and external-system
capabilities as `integration-or-conformance` facts. A weaker integration does
not redefine the product contract.

When an environment cannot satisfy accepted semantics, use the outcomes allowed
by the repository profile, such as:

- unsupported capability;
- explicit reduced support tier;
- conformance failure;
- blocked integration pending a named capability.

Do not present emulation, reconstruction, approximation, or a different resource
as equivalent unless the accepted conformance contract permits that equivalence.

## Keep downstream records distinct

A source semantic question, accepted product decision, conformance assessment,
implementation mechanism, and analysis representation are separate records.
Link their causal or dependency relationships while keeping each statement,
disposition, authority, layer, and next action independently reviewable.
