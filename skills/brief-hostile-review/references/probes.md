# 🔍 Execute Generative Probes

Run these 5 generative probes to discover structural defects, logical gaps, and "unknown-unknowns" in specification documents. Derive verification points from first principles.

---

## Sonde 1 — Decision Completeness (Mental Compilation)

Verify that the implementing agent has zero decision-making freedom regarding the logic, data flow, and structure:
1. Assume the role of the implementing developer.
2. Attempt to draft the code step-by-step using **only** the specification.
3. Every time you must make an assumption, pick a default value, decide on an execution order, or choose a data type/structure not specified in the document, **mark it as a Blocker (🔴)**.
4. Tracing an example: Run a concrete test vector through the algorithm manually. Verify that the outputs match the specified values exactly.

---

## Sonde 2 — Boundary & Interface Enumeration

Verify that all boundaries and points of contact between modules, systems, and files are watertight:
1. Identify and list every point of contact:
   * Shared data structures / types
   * Shared files or physical directories
   * Environment variables or configuration options
   * Ports, protocols, or network boundaries
2. Verify each point of contact bidirectionally:
   * Confirm the producer outputs exactly what the consumer expects (types, names, formats, casing).
   * Confirm constants (timeouts, retry limits, patterns) are identically defined.
3. Mark any divergence or missing type definition as a **Blocker (🔴)**.

---

## Sonde 3 — Non-Ambiguity (The Two-Developer Test)

Eliminate hedging, hand-waving, and soft language that leads to divergent implementations:
1. Scan the text for linguistic markers of hesitation or delegation:
   * *"or similar"* / *"etc."* / *"for example"* / *"such as"*
   * *"as needed"* / *"appropriate"* / *"should"* / *"may"*
   * *"internal helper or library function"*
2. For every normative sentence, ask: *"If two developers read this, is there any possibility they would write different logic?"*
3. Mark any hedging, optional logic, or ambiguous requirement as a **Blocker (🔴)**. The specification must make the decision.

---

## Sonde 4 — Testability (The Safety Net Test)

Guarantee that every constraint is observable and verified:
1. For every constraint declared in the specification, locate its verification test in the test specification (NIB-T).
2. Ask: *"If a developer bypasses this constraint in the code, which test vector will fail?"*
3. If a constraint is **invérifiable** (cannot be tested via input/output observations) or **uncovered** (no test checks it), mark it as a **Blocker (🔴)**. 
4. Check that the test suite does not include "always-green" tests (like simple export or type checks) as a substitute for behavioral assertions.

---

## Sonde 5 — Domain Fault Modeling

Inject failure cases custom-tailored to the system's runtime environment:
1. Map the system's inputs, outputs, and side-effects to standard failure domains:
   * **Filesystem**: Path containment checks, symlink traversal, directory creation failure, permission issues, casing mismatches.
   * **Network**: Timeout handling, rate limits (HTTP 429), server crashes (HTTP 5xx), auth token expiration, malformed responses.
   * **Secrets**: Log leakage (PII, tokens, keys), insufficient masking patterns, insecure storage.
   * **Concurrency**: Lock conflicts, race conditions on shared state, recovery on crashed runs, stale check-pointing.
   * **Parsing**: Malformed payloads (broken JSON/YAML), empty payloads, massive payloads (denial of service), unexpected additional fields.
2. Verify that the specification explicitly defines the error path and recovery state for each mapped failure case.
3. Mark any missing error handler or undefined recovery state as a **Blocker (🔴)**.
