# 🔨 Construction Sequence

*VegaCorp — March 2026*

---

## 1. Overview

The Construction Sequence is the workflow that consumes NIBs and Dependency Contracts to produce a tested codebase. It implements a strict TDD cycle: tests first (RED), then implementation (GREEN).

The sequence has exactly two steps. Everything that follows — refactoring, validation, bug fixes, feature additions — is the steady state of the codebase, not part of construction.

---

## 2. Inputs

The Construction Sequence consumes the following documents, produced by the architect during the Conception phase:

- **NIB-T** (TDD Tests Brief) — consumed in Step 1.
- **NIB-S** (System Brief) — consumed in Step 2.
- **NIB-M** (Module Briefs, all) — consumed in Step 2.
- **Dependency Contracts** (if any) — consulted during Step 2 when implementing modules that consume external dependencies.

See the **Normative Implementation Brief (NIB)** document for the definition and content of each NIB type. See the **Dependency Contract** document for the definition and content of dependency contracts.

---

## 3. Step 1 — RED: tests first

**Input:** NIB-T (TDD Tests Brief)

**Action:** The agent implements the acceptance tests (test vectors), property tests (anti-cheat), contract invariants, fixtures, and helpers described in the NIB-T. All tests are failing (RED).

These tests verify the system's **observable behavior** — they do not test internal functions.

**Output:** Executable test suite, 100% fail.

**Instruction to the agent:**

> Implement the tests described in the TDD Tests Brief. Do NOT create any production code. Create the minimal types necessary for the tests to compile (empty interfaces, stub functions that throw). All tests must be RED (failing).
> 

**Verification:** Run the test suite → 100% fail, 0 compilation errors.

---

## 4. Step 2 — GREEN: implementation

**Input:** NIB-S (System Brief) + NIB-M (Module Briefs, all) + Dependency Contracts (if any)

**Action:** The agent implements production code module by module, in pipeline order. After each module, the corresponding tests pass. When a module consumes an external dependency, the agent consults the corresponding Dependency Contract for the interface, error semantics, and integration patterns. The agent may add **unit tests** for internal functions during implementation — these tests are not in the NIB-T because they depend on the internal code structure, which did not exist during RED.

**Output:** Complete production code, all tests pass.

**Instruction to the agent:**

> Implement the system described in the System Brief and Module Briefs. Implement in pipeline order. After each module, run the corresponding tests — they must pass (GREEN). Do NOT modify any existing test (unless there is a bug in the test, with explicit justification). When a module consumes an external dependency that has a Dependency Contract, read the contract before implementing the integration.
> 

**Verification:** Run the test suite → 100% pass after each module.

---

## 5. End of construction

Once all tests pass (GREEN), the NIBs and Dependency Contracts have been fully consumed. The construction sequence is complete.

At this point, the **Transition phase** begins (see NIB methodology §4.3): the architect archives the construction documents, extracts ADRs, and establishes the hierarchy where code and tests become the source of truth.

---

## 6. What happens after construction

Everything after construction — refactoring, validation on real documents, bug fixes, code review, feature additions, performance optimization — operates on code and tests. The construction documents are not consulted.

The only invariant: **tests remain GREEN.** This is not a special rule of the Construction Sequence; it is the permanent invariant of the codebase.

New construction documents are written only when a **major extension** is needed (a new module or a new system). In that case, the Construction Sequence restarts for that scope only.

---

## 7. Relationship to NIB lifecycle

The Construction Sequence is Steps 1–2 of the NIB lifecycle. The full lifecycle is:

```
CONCEPTION → CONSTRUCTION → TRANSITION → EVOLUTION
                  ↑
          Construction Sequence
            (this document)
```

- **Conception:** The architect writes NIBs and Dependency Contracts.
- **Construction:** This document. RED → GREEN.
- **Transition:** Archive documents, extract ADRs, establish code-as-truth.
- **Evolution:** Code and tests are the source of truth. No construction documents needed.

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*