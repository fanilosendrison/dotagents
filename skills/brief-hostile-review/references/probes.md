# Execute Generative Probes

Run these 7 generative probes to discover structural defects, logical gaps, and unknown-unknowns in specification documents. They derive verification points from first principles and do not depend on any past project's failure history.

For every hit, record a finding and classify its severity per SKILL.md §4 — a probe hit is not automatically a blocker.

---

## Probe 1 — Decision Completeness (Mental Compilation)

Verify that the implementing agent has zero decision-making freedom regarding logic, data flow, and structure:

1. Assume the role of the implementing developer.
2. Attempt to draft the code step-by-step using **only the audited document set** (a NIB-M may legitimately delegate a decision to the NIB-S or a DC by explicit reference — follow the reference).
3. Every time you must make an assumption, pick a default value, decide on an execution order, or choose a data type/structure not dictated anywhere in the set, record a finding.
4. Trace the coverage both ways:
   * Every value used in the Algorithm must be traceable to the declared Inputs.
   * Every field of the declared Outputs must be produced somewhere in the Algorithm.

---

## Probe 2 — Boundary & Interface Enumeration

Verify that all boundaries and points of contact between modules, systems, and files are watertight:

1. Identify and list every point of contact:
   * Shared data structures / types.
   * Shared files or physical directories.
   * Environment variables or configuration options.
   * Ports, protocols, or network boundaries.
2. Verify each point of contact bidirectionally:
   * Confirm the producer outputs exactly what the consumer expects (types, names, formats, casing).
   * Confirm constants (timeouts, retry limits, patterns) are identically defined everywhere.
   * Confirm every referenced type is defined by exactly one owner, and flag types defined but never consumed.
3. Record any divergence or missing definition as a finding.

---

## Probe 3 — Non-Ambiguity (The Two-Developer Test)

Eliminate hedging, hand-waving, and soft language that leads to divergent implementations:

1. Scan normative sentences for linguistic markers of hesitation or delegation:
   * "or similar" / "etc." / "for example" / "such as"
   * "as needed" / "appropriate" / "if necessary"
   * "internal helper or library function"
   * Unqualified "should" / "may" — **exception**: documents that declare RFC 2119 keyword semantics, where SHOULD/MAY are legitimate normative keywords.
2. For every normative sentence, ask: *"If two developers read this, is there any possibility they would write different logic?"*
3. Record hedging, optional logic, or ambiguous requirements as findings. Hedging on a determinant decision is a blocker; hedging in illustrative prose is minor.

---

## Probe 4 — Testability (The Safety Net Test)

Guarantee that every constraint is observable and verified:

1. For every constraint declared in the specification, locate its verification test in the test specification (NIB-T).
2. Ask: *"If a developer bypasses this constraint in the code, which test vector will fail?"*
3. If a constraint is **unverifiable** (cannot be tested via input/output observation) or **uncovered** (no test checks it), record a finding.
4. Check that the test suite does not include always-green tests (export checks, constant checks, fixture-shape tests) as substitutes for behavioral assertions.

---

## Probe 5 — Domain Fault Modeling

Derive a fault model tailored to the audited system — do not reuse a fixed list. Map the system's inputs, outputs, and side effects to failure domains. Starter domains (extend per project):

* **Filesystem**: path containment, symlink traversal, directory creation failure, permissions, casing, paths with spaces, encoding.
* **Network**: timeouts, rate limits (HTTP 429), server errors (5xx), auth expiration, malformed responses.
* **Secrets**: log leakage (PII, tokens, keys), incomplete masking patterns, insecure storage.
* **Concurrency**: lock conflicts, races on shared state, crash recovery, stale checkpoints, re-entrance.
* **Parsing**: malformed payloads, empty payloads, oversized payloads, unexpected extra fields.
* **Ambient non-determinism**: direct `new Date()` / `Date.now()`, random generators, direct `process.env` reads where the system provides injected abstractions.

For each mapped failure case, verify that the specification explicitly defines the error path and recovery state. Record every missing handler or undefined recovery state as a finding.

---

## Probe 6 — HAZOP Guidewords

Mechanically generate adverse questions by applying each guideword to every algorithm step, data flow, and side effect of the spec:

* **NO** — the step does not happen at all. What detects it? What state remains?
* **MORE / LESS** — too much / too little (retries, payload size, frequency, permissions).
* **REVERSE** — steps happen in inverted order.
* **OTHER THAN** — something else happens instead (wrong file, wrong branch, wrong host).
* **EARLY / LATE** — timing shifts (written before validated; crash between two writes).
* **PART OF** — the step happens partially (truncated write, partial batch, interrupted loop).

For each generated question the spec cannot answer, record a finding. This probe is the primary weapon against unknown-unknowns: it generates failure classes instead of recalling them.

---

## Probe 7 — Persona Rotation

Re-read the document set once per persona. Each perspective detects a largely disjoint defect set:

1. **Implementer** — covered by Probe 1 (mental compilation).
2. **Tester** — covered by Probe 4 (safety net).
3. **Maintainer / Operator** — read as the person who runs, debugs, and resumes the system:
   * Can a crashed run be diagnosed from the persisted artifacts and logs alone?
   * Is every resume/recovery path specified (what is re-read, what is re-executed, what is adopted)?
   * Are observability obligations (events, logs, statuses) specified per step, and do they leak secrets?
   * What does an upgrade (dependency bump, schema evolution) do to persisted state?

Record every question a persona cannot answer from the documents as a finding.
