# Deciding Whether You Must Plan a TDD Implementation from a Prompt or Specs Corpus

## Your Directives

Check all documents present in the `/specs` directory (or your equivalent requirements corpus) and any other provided inputs.

Based on these documents, you must determine whether it is appropriate to plan a Test-Driven Development (TDD) implementation.

You must answer this core question:

> Based on the information in the specs, can you derive reliable tests before implementation, without inventing the expected behavior yourself?

You must make this decision for each behavior or requirement, not necessarily for the whole project at once.

---

# 1. Core Principle

Plan a TDD implementation only if you are able to derive, before any implementation, a test oracle that is:
- independent of the implementation;
- dictated by the specs;
- traceable to a normative source;
- precise enough to distinguish a correct implementation from an incorrect one;
- observable and controllable in a test environment.

Therefore, the central question you must ask yourself is:

> Can I write a test right now that would fail for an incorrect implementation, where the expected result is dictated by the specs and not invented by me?

If the answer is yes, TDD is likely appropriate.

If the answer is no, writing tests immediately will mainly encode your own assumptions.

---

# 2. Decision Criteria

Do not base your decision on:
- the amount of code to write;
- the time needed to write tests;
- the difficulty of maintaining the suite;
- the immediate cost / future benefit ratio.

Instead, your decision must focus exclusively on:
- Do you truly know what needs to be tested?
- Does the spec clearly dictate the expected result?
- Would the test have an independent oracle?
- Are the necessary data controllable?
- Are the relevant effects observable?
- Are the requirements consistent with each other?
- Do the tests risk locking in an architecture that you invented?

Your main risk is producing a massive amount of tests that are:
- tautological;
- redundant;
- derived from the implementation;
- coupled to internal details;
- based on a misinterpretation of the specs;
- unable to detect degenerate implementations;
- or verifying a contract that nobody actually requested.

---

# 3. Formal Decision

For a requirement `R`, represent the decision as follows:

```text
TDD(R) =
    normative(R)
    ∧ authoritative(R)
    ∧ unambiguous(R)
    ∧ consistent(R)
    ∧ oracle_derivable(R)
    ∧ controllable(R)
    ∧ observable(R)
    ∧ incrementally_sliceable(R)
```

In other words, the requirement must be:
1. normative;
2. sourced from an authority;
3. unambiguous;
4. consistent with the rest of the corpus;
5. capable of producing an oracle;
6. controllable in a test environment;
7. observable;
8. sliceable into small increments.

Treat these criteria as strict blocking gates.

For example:
- a requirement might be highly important but ambiguous;
- a requirement might be clear but lack an oracle;
- a result might be precise but impossible to observe;
- a behavior might be testable but contradict another priority spec.

In each of these cases, do not start planning TDD until you have resolved the corresponding problem.

---

# 4. First Step: Extract Normative Obligations

Before deciding how to implement, you must transform the corpus into atomic behavioral obligations.

For each requirement, you must extract at least:

```text
Identifier:
Source:
Version:
Authority Level:
Actor or component concerned:
Trigger:
Preconditions:
Inputs:
Initial state:
Requested behavior:
Observable result:
Side effects:
Expected errors:
Invariants:
Temporal constraints:
Edge cases:
Criticality:
Dependencies:
Open questions:
```

## Testable Example

```text
REQ-27
Source: payments.md §4.2

Given an already paid order,
when a second payment request uses the same idempotency key,
no new charge must be created
and the initial response must be returned.
```

This requirement provides you with:
- an initial state;
- an action;
- an input;
- an expected result;
- an invariant;
- a forbidden effect;
- a success criterion;
- a failure criterion.

Proceed immediately with a TDD strategy for this requirement.

## Untestable Example

```text
The payment must be robust.
```

This sentence does not specify what "robust" means.

It could mean:
- idempotent;
- resilient to timeouts;
- capable of retrying;
- transactional;
- secure;
- highly available;
- capable of resuming after a crash;
- resistant to double submissions.

Do not arbitrarily choose one of these interpretations and turn it into a test.

Instead, set the status to:

```text
SPEC_GAP
```

or:

```text
SPEC_AMBIGUITY
```

---

# 5. The Eight Decision Gates

## Gate 1 — Is the requirement normative?

You must distinguish between:
- obligations;
- recommendations;
- examples;
- comments;
- justifications;
- assumptions;
- suggestions;
- architectural decisions;
- historical information.

Examples of generally normative phrasing:

```text
The system must...
The API returns...
The user cannot...
The request is rejected if...
The transition is only allowed when...
```

Examples of non-necessarily normative phrasing:

```text
For example...
We could...
Ideally...
One possibility would be...
Typically...
```

### Risk

A sentence like:

```text
For example, administrators can export users.
```

does not necessarily allow you to conclude that:
- only administrators can export;
- all users must be included;
- the format must be CSV;
- the export must be synchronous;
- the order of users must be deterministic.

### Rule

Link every test assertion to an identifiable normative clause.

If no clause makes an expectation mandatory, do not turn that expectation into a binding test.

### Decision

```text
Identifiable normative clause
→ continue analysis

Context, example, or suggestion only
→ CONTEXT_ONLY or SPEC_GAP
```

---

## Gate 2 — What source holds authority?

In a real corpus, documents may diverge.

Examples of possible sources:
- PRD;
- ticket;
- ADR;
- OpenAPI;
- JSON schema;
- diagram;
- business specification;
- technical specification;
- user documentation;
- README;
- existing tests;
- existing code;
- comments;
- older versions of documents.

Example of a conflict:

```text
PRD:
The account can be deleted immediately.

API Specification:
DELETE /account triggers a 30-day retention period.
```

Do not silently choose a side.

You must know or construct a documentary hierarchy.

Example:

```text
1. External regulation or contract
2. Approved business specification
3. Versioned API schema
4. Active ADR
5. Current PRD
6. Implementation ticket
7. Historical documentation
8. Existing code
9. Comments
```

This hierarchy depends on the project and should ideally be explicitly provided.

### Decision

```text
Clear priority source
→ continue

Unresolved conflict between sources of equal authority
→ SPEC_CONFLICT
```

Do not start TDD on this requirement until the contradiction is resolved.

---

## Gate 3 — Does the behavior have an independent oracle?

This is the main gate.

An oracle answers the question:

> For this input and this initial state, how do we know the result is correct?

You must derive the oracle from a source independent of the implementation you are going to produce.

## Types of Oracles

### Exact Oracle

```text
Input: 100 EUR with a 20% discount
Expected output: 80 EUR
```

The expected result is explicitly calculable.

### Property Oracle

```text
decode(encode(x)) = x
final_balance >= 0
sort(sort(x)) = sort(x)
a repeated idempotent operation does not mutate state further
```

The spec does not necessarily impose an exact output, but imposes a general property.

### State Oracle

```text
DRAFT → SUBMITTED is allowed
SUBMITTED → DRAFT is forbidden
CANCELLED is terminal
```

The behavior is defined by a state machine.

### Contract Oracle

```text
HTTP 409 if the resource already exists
the response complies with the provided JSON schema
the event contains the mandatory fields
```

The external contract directly provides the oracle.

### Reference Oracle

```text
The result must match RFC X.
The calculation must match the provided accounting model.
The result must be identical to the reference implementation.
```

### Metamorphic Oracle

When the exact result is difficult to calculate, the spec may impose a relationship between multiple executions.

Examples:

```text
Doubling all quantities must double the total.
Swapping elements must not alter an order-independent result.
Adding and then removing the same permission restores the initial state.
```

### Statistical Oracle

```text
On dataset D:
- accuracy ≥ 92%
- hallucination rate ≤ 1%
- JSON compliance ≥ 99.5%
- no critical violations of policy P
```

### Structured Human Oracle

```text
A response is valid if at least 4 out of 5 evaluators
give it a score ≥ 4 according to the provided rubric.
```

## Invalid Oracles

### Oracle Derived from Implementation

```python
expected = implementation.compute(input)
assert implementation.compute(input) == expected
```

This test possesses zero independence.

### Oracle Invented by You

Spec:

```text
The system must send a notification.
```

Invented test:

```text
The system must call EmailService.send()
exactly once with an HTML template.
```

The spec might not have required an email, an HTML template, or a single call.

### Oracle Originating from Accidental Behavior

A characterization test can capture the current behavior of a legacy system, but that does not mean this behavior constitutes the desired behavior.

You must distinguish between:

```text
observed existing behavior
```

and:

```text
expected normative behavior
```

### Decision

```text
Derivable independent oracle
→ TDD possible

Oracle derived from the implementation
→ invalid

Oracle requiring a business assumption
→ SPEC_GAP

Oracle requiring technical discovery
→ SPIKE_THEN_TEST
```

---

## Gate 4 — Are preconditions and inputs controllable?

You must be able to place the system in the state required by the test.

This may require you to control:
- inputs;
- the database;
- the clock;
- randomness;
- identifiers;
- the filesystem;
- network responses;
- timeouts;
- retries;
- the order of events;
- concurrency;
- external errors;
- business states;
- model versions;
- seeds;
- message queues.

Example:

```text
When the payment provider responds 503 three times,
then 200 on the fourth attempt...
```

To test this behavior, you must be able to trigger exactly this sequence.

### Three Possible Cases

#### Directly Controllable

```text
→ TDD
```

#### Controllable after Architectural Adaptation

Examples:
- injecting a clock;
- providing a port for the external provider;
- faking a repository;
- adding a virtualization layer for the filesystem;
- using an explicit seed;
- using a controllable scheduler.

```text
→ DESIGN_FOR_TESTABILITY
```

You must then plan for testability before or alongside the implementation.

#### Unreproducible with Available Means

```text
→ SIMULATION
→ LAB_TEST
→ MANUAL_VALIDATION
→ or SPEC_GAP
```

Even if development cost is negligible, the technical ability to control the scenario remains mandatory.

---

## Gate 5 — Are the relevant effects observable?

A test must be able to observe the consequences of the behavior.

Examples of observable effects:
- returned value;
- state change;
- persistent record;
- published event;
- sent message;
- produced file;
- HTTP code;
- structured error;
- metric;
- trace;
- latency;
- absence of a forbidden effect;
- business transition;
- model output;
- artifact modification.

Insufficient example:

```text
The component must process the message correctly.
```

Observable example:

```text
After processing:
- the status is COMPLETED;
- exactly one InvoiceCompleted event is published;
- no additional retry is scheduled;
- the message is marked as consumed.
```

### Decision

```text
Observable effects specified
→ continue

Effect only described by a vague intention
→ SPEC_GAP

Real effect unobservable
→ DESIGN_FOR_OBSERVABILITY
```

Designing for observability can include:
- exposing a state;
- events;
- structured logs;
- metrics;
- traces;
- test hooks;
- audit logs;
- explicit results.

---

## Gate 6 — Is the result deterministic or measurable?

Your strategy depends on the nature of the result.

## Exact and Deterministic Result

```text
For X, the output must be Y.
```

Strategy:

```text
Classic TDD
```

## Result Defined by Invariants

```text
The total can never be negative.
A reservation cannot exceed available stock.
Encoding then decoding restores the initial value.
```

Strategy:

```text
Property-based TDD
```

## Result Defined by States and Transitions

```text
A PAID order can become SHIPPED.
A CANCELLED order can no longer change state.
```

Strategy:

```text
Model-based TDD
```

## Probabilistic but Measurable Result

```text
On a dataset D:
- precision ≥ 95%
- recall ≥ 90%
- critical hallucinations = 0
```

Strategy:

```text
Eval-driven development
```

Your cycle becomes:

```text
1. Build the eval
2. Observe failure
3. Implement
4. Measure
5. Adjust
6. Prevent regression
```

## Subjective Result with Explicit Protocol

```text
The response must be evaluated according to a rubric:
- relevance
- clarity
- accuracy
- tone
- completeness
```

Strategy:

```text
Human-eval-driven
```

or:

```text
LLM-as-judge with human calibration
```

## Subjective Result without Protocol

Examples:

```text
The response must be natural.
The interface must be elegant.
The summary must be excellent.
```

Strategy:

```text
SPEC_GAP
```

You must define:
- a rubric;
- examples;
- counter-examples;
- a judge;
- a dataset;
- a population;
- thresholds;
- a human protocol.

## Decision Table

| Nature of the Result | Strategy |
|---|---|
| Exact and deterministic | Classic TDD |
| Invariants | Property-based TDD |
| States and transitions | Model-based TDD |
| Interface contract | Contract-first TDD |
| Statistical with dataset, metric, and threshold | Eval-driven development |
| Subjective with explicit rubric | Human-eval-driven |
| Subjective without protocol | Insufficient spec |

---

## Gate 7 — Can the behavior be sliced into testable increments?

TDD is not:

```text
write all the tests
then write all the implementation
```

You must be able to identify a succession of small behaviors.

Monolithic example:

```text
Fully implement subscription management.
```

Possible slicing:

```text
1. Create a monthly subscription.
2. Reject a non-existent offer.
3. Calculate the first period.
4. Cancel at the end of the period.
5. Prevent double billing.
6. Resume after a payment failure.
7. Handle an offer change.
8. Handle prorated billing.
```

A good increment has:
- a trigger;
- an observable result;
- a limited surface area;
- an oracle;
- few dependencies;
- a clear behavior change.

### Recommended Slicing Order

```text
1. Minimal nominal case
2. First error
3. First variant
4. Edge case
5. Side effect
6. Concurrency
7. Performance
8. Resilience
```

### Decision

```text
Small identifiable increments
→ Incremental TDD

Monolithic but decomposable feature
→ decompose before planning

Feature requiring prior discovery
→ SPIKE_THEN_TEST
```

---

## Gate 8 — Does the test describe the requested behavior or an invented implementation?

You must avoid turning your own design choices into requirements.

Spec:

```text
When an order is validated,
a notification is sent.
```

Behavior-centric test:

```text
A compliant notification is observable
for the expected recipient.
```

Potentially overspecified test:

```text
NotificationService.sendEmail() is called exactly once
after OrderRepository.save()
and before EventBus.publish().
```

This second test is only legitimate if the spec mandates:
- the use of `NotificationService`;
- the email channel;
- the order of operations;
- the uniqueness of the call;
- the precise sequencing.

Otherwise, the test artificially reduces the space of valid implementations.

### Rule

Your initial tests must prioritize:
- inputs;
- outputs;
- state;
- business events;
- properties;
- contracts;
- external effects.

You must avoid locking in:
- class names;
- the number of layers;
- the order of internal calls;
- collaboration details;
- private structures;
- mocks of every internal class.

Architectural constraints explicitly requested must be tested separately as architecture tests.

### Decision

```text
Assertion derived from observable behavior
→ valid

Assertion derived from a design imagined by you
→ do not include

Normative architectural constraint
→ separate architecture test
```

---

# 6. Classification of Requirements

You must assign an explicit status to each requirement.

| Status | Meaning | Strategy |
|---|---|---|
| `TDD_EXAMPLE` | Precise inputs and outputs | Example-based testing |
| `TDD_PROPERTY` | Expressible invariants | Property-based testing |
| `TDD_MODEL` | Defined states and transitions | Model-based testing |
| `TDD_CONTRACT` | Normative protocol or interface | Contract-first |
| `TDD_ACCEPTANCE` | Complete external scenario | Outside-in |
| `EVAL_DRIVEN` | Measurable probabilistic result | Dataset + scorer + threshold |
| `HUMAN_VALIDATION` | Structured human judgment | Rubric + evaluators |
| `CHARACTERIZATION` | Legacy without complete spec | Capture current behavior |
| `SPIKE_THEN_TEST` | Unknown feasibility or mechanism | Exploration then tests |
| `DESIGN_FOR_TESTABILITY` | Uncontrollable preconditions | Adapt the architecture |
| `DESIGN_FOR_OBSERVABILITY` | Unobservable effects | Add signals |
| `SPEC_GAP` | Expected result is missing | Complete the spec |
| `SPEC_AMBIGUITY` | Multiple plausible interpretations | Resolve the ambiguity |
| `SPEC_CONFLICT` | Incompatible normative sources | Resolve the priority |
| `CONTEXT_ONLY` | Non-normative information | Do not produce a test |

The global decision is almost never:

```text
TDD = true
```

It is more likely to look like this:

```text
Feature A : TDD_ACCEPTANCE
Business Core : TDD_PROPERTY
Workflow : TDD_MODEL
Provider Integration : SPIKE_THEN_TEST
Quality of AI Outputs : EVAL_DRIVEN
Ergonomics : HUMAN_VALIDATION
```

---

# 7. Project-Level Decision

## Dominant TDD Plan

Choose a dominant TDD plan when:
1. critical requirements are normative;
2. priority sources are identified;
3. conflicts are resolved;
4. important ambiguities are resolved;
5. oracles are derivable;
6. preconditions are controllable;
7. effects are observable;
8. behaviors are sliceable;
9. tests can be written without inventing the architecture.

## Hybrid Plan

This is the standard situation.

Example:

```text
- pricing rules: property-based TDD
- public API: contract-first TDD
- orchestration: acceptance TDD
- state machine: model-based TDD
- LLM engine: eval-driven development
- new third-party API: spike then contract tests
- user experience: prototype and human validation
```

## Not Yet Behavioral Implementation

When critical requirements are:
- contradictory;
- unverifiable;
- lacking an oracle;
- purely subjective;
- dependent on missing information;
- impossible to control;
- impossible to observe;

Your next step must not be:

```text
code without TDD
```

It must be:

```text
SPEC_REPAIR
ORACLE_DESIGN
DESIGN_FOR_TESTABILITY
DESIGN_FOR_OBSERVABILITY
PROTOCOL_DISCOVERY
SPIKE
```

---

# 8. Decision Algorithm

```text
1. Inventory the documents in the corpus.
2. Identify their version and level of authority.
3. Extract all normative clauses.
4. Transform each clause into an atomic obligation.
5. Assign an identifier and a source to each obligation.
6. Detect contradictions.
7. Detect ambiguities.
8. For each obligation:
   a. identify preconditions;
   b. identify inputs;
   c. identify the action;
   d. identify observable effects;
   e. search for an independent oracle;
   f. determine the nature of the oracle;
   g. verify controllability;
   h. verify observability;
   i. verify that the test does not impose an invented architecture;
   j. determine the smallest testable increment.
9. Classify each obligation.
10. Produce the requirements → verification matrix.
11. Choose a TDD, hybrid, eval-driven, or exploratory plan.
12. Generate tests before detailed design for TDD-ready requirements.
13. Map each assertion to a requirement.
14. Implement in short cycles.
15. Add integration, mutation, adversarial, and regression tests.
```

---

# 9. Pseudo-code

```python
def choose_development_mode(requirement):
    if not requirement.is_normative:
        return "CONTEXT_ONLY"

    if requirement.has_unresolved_conflict:
        return "SPEC_CONFLICT"

    if requirement.has_multiple_plausible_meanings:
        return "SPEC_AMBIGUITY"

    oracle = derive_independent_oracle(requirement)

    if oracle is None:
        if requirement.requires_discovery:
            return "SPIKE_THEN_TEST"
        return "SPEC_GAP"

    if not requirement.preconditions_are_controllable:
        return "DESIGN_FOR_TESTABILITY"

    if not requirement.effects_are_observable:
        return "DESIGN_FOR_OBSERVABILITY"

    if oracle.is_exact:
        return "TDD_EXAMPLE"

    if oracle.is_property:
        return "TDD_PROPERTY"

    if oracle.is_state_model:
        return "TDD_MODEL"

    if oracle.is_external_contract:
        return "TDD_CONTRACT"

    if oracle.is_acceptance_scenario:
        return "TDD_ACCEPTANCE"

    if oracle.is_statistical:
        if (
            oracle.has_dataset
            and oracle.has_metric
            and oracle.has_threshold
        ):
            return "EVAL_DRIVEN"

        return "EVAL_SPEC_GAP"

    if oracle.requires_human_judgment:
        if oracle.has_explicit_rubric:
            return "HUMAN_VALIDATION"

        return "SPEC_GAP"

    return "SPEC_GAP"
```

---

# 10. Pre-implementation Traceability Matrix

Before producing a technical plan, generate a matrix of this type:

| Requirement | Source | Normative | Oracle | Controllable | Observable | Mode | Questions |
|---|---|---:|---|---:|---:|---|---|
| REQ-01 | API §2.1 | Yes | HTTP 201 + schema | Yes | Yes | `TDD_CONTRACT` | None |
| REQ-02 | Domain §4 | Yes | total ≥ 0 | Yes | Yes | `TDD_PROPERTY` | None |
| REQ-03 | PRD §7 | Yes | "relevant response" | Yes | Yes | `SPEC_GAP` | Missing metric |
| REQ-04 | ADR-3 | Yes | PostgreSQL mandatory | Yes | Yes | architecture test | None |
| REQ-05 | Provider §8 | Yes | unknown timeout | No | Yes | `SPIKE_THEN_TEST` | Missing retry policy |

Then a summary:

```text
Global Decision: HYBRID

TDD-ready:
- REQ-01
- REQ-02
- REQ-04

Not TDD-ready:
- REQ-03: define a dataset, a scorer, and a threshold
- REQ-05: discover the actual behavior of the provider
```

---

# 11. Generation of Tests from Specs

Once a requirement is declared TDD-ready, each test must contain an explicit traceability.

Example:

```python
def test_duplicate_payment_key_does_not_create_new_charge():
    """
    Requirement: REQ-27
    Source: payments.md §4.2
    Oracle:
      - no additional charge is created
      - initial response is returned
    """
```

You must classify each assertion as:
- directly mandated by the spec;
- logically derived from an invariant;
- derived from an external contract;
- derived from a normative example;
- derived from a general property;
- or a test assumption.

Do not transform a test assumption into a product constraint.

---

# 12. Inside-out or Outside-in Choice after the TDD Decision

Once TDD is selected, you must still choose the direction of implementation.

## Outside-in

Choose outside-in when:
- the external scenario is clear;
- the visible contract is the main anchor point;
- the main difficulty is orchestration;
- multiple components or services must collaborate;
- the main risk is building correct components separately but an overall incorrect feature;
- the system is centered on a workflow, an API, or a user journey.

Examples:
- APIs;
- application services;
- workflows;
- event-driven systems;
- orchestration;
- coordination between services;
- use cases.

### Typical Form

```text
Given an initial state,
when the actor executes the action,
then the expected external effects are observable.
```

### Risk

The outside-in test can overspecify internal interactions.

Warning signal:

```text
A refactoring without behavior change
breaks many tests.
```

---

## Inside-out

Choose inside-out when:
- the complexity is primarily business or algorithmic;
- invariants are central;
- the core can function without I/O;
- state transformations are more important than orchestration;
- results can be verified by values, state, or properties;
- the domain constitutes the long-lasting part of the system.

Examples:
- rule engines;
- parsers;
- compilers;
- state machines;
- calculators;
- business models;
- data structures;
- validators;
- algorithms.

### Typical Form

```text
Given a valid business object,
when an operation is applied,
then its invariants are preserved
and its new state is correct.
```

### Risk

The system may become locally elegant but misaligned with the external need.

---

## Hybrid Recommendation

For the majority of backends and business systems:

```text
1. Outer test to frame the feature
2. Inside-out to build the business core
3. Outside-in for orchestration
4. Contract tests at the boundaries
5. Minimal end-to-end test
```

Synthetic formula:

> Outside-in at the feature level, inside-out in the core, mocks only at true boundaries.

---

# 13. Test Strategies by Requirement Type

## Example-based TDD

To be used when the specs provide:
- inputs;
- outputs;
- errors;
- edge cases;
- scenarios.

## Property-based TDD

To be used when the specs provide:
- invariants;
- symmetries;
- laws;
- relations;
- universal properties.

## Model-based TDD

To be used when the specs define:
- states;
- transitions;
- guards;
- actions;
- terminal states;
- forbidden sequences.

## Contract-first TDD

To be used when the specs contain:
- OpenAPI;
- JSON Schema;
- protobuf;
- GraphQL schema;
- event formats;
- external contracts;
- RFCs;
- protocols.

## Eval-driven development

To be used for:
- LLMs;
- probabilistic classification;
- ranking;
- search;
- recommendation;
- non-deterministic extraction;
- generation;
- agents.

You must then have:
- dataset;
- scorer;
- metrics;
- thresholds;
- repetition protocol;
- version control;
- variance analysis;
- regression policy.

## Human-eval-driven

To be used when:
- human judgment remains necessary;
- a rubric is available;
- evaluators are defined;
- the protocol is reproducible.

## Characterization testing

To be used for a legacy system when:
- the existing behavior is poorly documented;
- a refactoring needs to be secured;
- current compatibility is important.

Warning:

```text
a characterization test describes what exists,
not necessarily what should exist.
```

## Spike then tests

To be used when uncertainty concerns:
- feasibility;
- an external API;
- an unknown library;
- performance;
- a protocol;
- a model;
- an experimental architecture.

You must use the spike to discover the contract.

After discovery:

```text
1. formalize the behavior
2. create tests
3. reimplement or clean up under the control of the tests
```

---

# 14. Quality Control of Tests Generated by You

Do not measure test quality by volume.

Bad primary metrics:
- number of tests;
- number of assertions;
- line coverage alone;
- branch coverage alone;
- amount of mocks;
- size of the test suite.

More useful metrics:
- killed mutation rate;
- requirement coverage;
- state coverage;
- transition coverage;
- property coverage;
- scenario diversity;
- oracle independence;
- ability to detect degenerate implementations;
- stability under valid refactoring;
- ability to detect historical regressions;
- assertion traceability;
- coverage of errors and edge cases.

## Mutation Testing

Mutation testing verifies if the tests fail when a plausible fault is introduced.

Example:

```python
if amount > balance:
```

Mutation:

```python
if amount >= balance:
```

If no test breaks, your suite probably has a behavioral gap.

## Adversarial Tests

You must look for:
- extreme inputs;
- null values;
- unexpected types;
- rare sequences;
- concurrency;
- repetitions;
- replays;
- timeouts;
- partial failures;
- contradictory data;
- malicious inputs;
- minimal implementations that naively satisfy the tests.

## Degenerate Implementations

You must verify that the suite cannot be satisfied by an absurd implementation.

Examples:

```text
always return the same value
ignore inputs
only process one specific example
hardcode the cases from the dataset
produce no side effects
```

---

# 15. Blocking Criteria

You must not plan a classic TDD implementation when:
- the expected behavior is undefined;
- multiple major interpretations are possible;
- normative documents contradict each other;
- no independent oracle exists;
- the oracle depends on future code;
- preconditions cannot be controlled;
- effects cannot be observed;
- the result is subjective without a protocol;
- the behavior must first be discovered;
- the test would force an architecture absent from the specs.

In these cases, you must explicitly produce a prior action.

Examples:

```text
SPEC_REPAIR
SPEC_CONFLICT_RESOLUTION
ORACLE_DESIGN
DATASET_CREATION
RUBRIC_DEFINITION
DESIGN_FOR_TESTABILITY
DESIGN_FOR_OBSERVABILITY
SPIKE
```

---

# 16. Compact Decision Policy

For each requirement, you must apply this sequence:

```text
1. Is it normative?
2. Is the source authoritative?
3. Is it unambiguous?
4. Is it consistent with the rest of the corpus?
5. Can you derive an independent oracle?
6. Are preconditions controllable?
7. Are effects observable?
8. Is the result exact, property-based, model-based,
   contract-based, statistical, or based on human judgment?
9. Can you slice the behavior into small increments?
10. Does the test verify the behavior rather than an invented design?
```

Then:

```text
Yes to all necessary gates
→ plan TDD

Property oracle
→ property-based TDD

State machine oracle
→ model-based TDD

External contract
→ contract-first TDD

Statistical result
→ eval-driven development

Structured subjective result
→ human-eval-driven

Unknown behavior
→ spike then tests

Ambiguous, contradictory, or incomplete spec
→ repair the spec
```

---

# 17. Your Operational Prompt

```text
Analyze the spec corpus before proposing an implementation plan.

For each requirement:

1. Identify the normative clause and its source.
2. Determine its authority level.
3. Detect contradictions and ambiguities.
4. Extract:
   - preconditions
   - inputs
   - action
   - outputs
   - state changes
   - side effects
   - errors
   - invariants
   - temporal constraints
5. Determine if an independent oracle can be derived.
6. Verify if preconditions are controllable.
7. Verify if effects are observable.
8. Classify the requirement among:
   - TDD_EXAMPLE
   - TDD_PROPERTY
   - TDD_MODEL
   - TDD_CONTRACT
   - TDD_ACCEPTANCE
   - EVAL_DRIVEN
   - HUMAN_VALIDATION
   - CHARACTERIZATION
   - SPIKE_THEN_TEST
   - DESIGN_FOR_TESTABILITY
   - DESIGN_FOR_OBSERVABILITY
   - SPEC_GAP
   - SPEC_AMBIGUITY
   - SPEC_CONFLICT
   - CONTEXT_ONLY
9. Do not transform any invented implementation decision into a requirement.
10. Do not generate any test whose oracle is derived from the implementation.
11. Produce a traceability matrix (requirements → verification).
12. Then propose a plan:
   - dominant TDD
   - hybrid
   - eval-driven
   - spike then tests
   - spec repair
13. For TDD-ready requirements, choose:
   - outside-in if the main difficulty is external behavior
     or orchestration;
   - inside-out if the main difficulty is the domain,
     invariants, or algorithms;
   - hybrid in other cases.
```

---

# 18. Final Summary

Your main rule is:

> Plan TDD only when the specs allow you to write, before the code, a test capable of rejecting an incorrect implementation without relying on an internal structure that you invented.

When this condition is not satisfied:
- do not arbitrarily code without TDD;
- identify exactly why TDD is not possible;
- repair the spec;
- define the oracle;
- build an eval;
- make the system controllable or observable;
- or perform a discovery spike.

The correct decision is generally not:

```text
TDD or no TDD for the entire project
```

but:

```text
which verification method for each obligation?
```

Within this framework, TDD becomes a consequence of the testability of requirements, and not an abstract methodological preference.
