# Execute Verification Checklists (D1–D8)

Baseline scan over **known** specification defect classes.

> **Scope warning**: this list is non-exhaustive by construction — it is derived from past audit sessions and grows via the capitalization step (SKILL.md §6). It is a floor, not the perimeter: the generative probes ([probes.md](probes.md)) prime, and an audit that only ran these checklists is not complete. Concrete items marked "e.g." are illustrations from past sessions, not the rule itself.

---

## D1 — Verify Template & Structural Compliance

* **Check NIB-M Structure**: Confirm the presence of the 8 mandatory sections: Purpose, Inputs, Outputs, Algorithm, Examples, Edge cases, Constraints, and Integration.
* **Check DC Structure**: Confirm the presence of sections §0 to §6: Identity, Interface, Behavioral contract, Error semantics, Integration patterns, Consumer constraints, and Known limitations.
* **Check NIB-T Structure**: Confirm the presence of the 5 mandatory sections: Fixture organization, Test vectors, Anti-cheat, Contract invariants, and Helpers.
* **Verify Frontmatter Metadata**: Ensure `id`, `type`, `version`, `scope`, `status`, `consumers`, and `superseded_by` are present; for DCs also `dependency_version` and `referenced_by`. Flag any non-standard metadata fields.
* **Enforce Language & Naming**: Ensure the mandated language is used consistently. Check naming conventions for files and symbols against project casing rules.

---

## D2 — Verify Alignment with Dependency Codebases

* **Verify Source Signatures**: Open the target source code of the dependency. Verify that method signatures, parameter names, and return types match the spec exactly (e.g., a spec saying `Promise<never>` where the source says `Promise<void>`).
* **Verify Error Classes**: Check the dependency's actual error class definitions. Ensure fatal vs retryable behaviors match the runtime logic at the exact source location that decides them.
* **Verify Transitive Closure of Types**: Confirm that every type referenced within inputs or outputs is either defined inline or explicitly linked to its source definition.
* **Eliminate Stale Version Citations**: Grep the document for occurrences of previous library versions and removed APIs after a migration (e.g., surviving `v0.8.0` mentions after a `v0.9.0` bump — including prose, subtitles, and examples).
* **Flag Invented APIs**: Identify any variables, environment configurations, or API methods mentioned in the spec that do not exist in the dependency's actual export contract. Project-level overlays must be documented as such.

---

## D3 — Verify Alignment with Upstream Specifications

* **Perform Schema Comparatives**: Construct a "Spec says / NIB says" table, field by field (name, type, required/optional, structure). Never validate a schema as "globally similar" (e.g., a flat single-provider object reinvented as a nested multi-provider map).
* **Verify Command Integrity**: Compare commands (CLI tools, flags, arguments, quoting) character by character (e.g., `diff-index --cached` vs `diff --cached`). "Functionally equivalent" is not sufficient for a normative document.
* **Verify Physical Topology**: Match filenames, extensions, and directory structures against upstream requirements (e.g., `evidence/patch.diff` under a task subfolder vs `patch.patch` at the root).
* **Check Logical Fidelity**: Detect logic inversions — same vocabulary, different behavior (e.g., a filter applied during an ascent loop instead of after its failure).
* **Flag Unauthorized Permissiveness or Restriction**: Detect tolerances or restrictions the upstream spec does not grant (e.g., a conditional "adopt" path where the spec mandates `errored`). A deliberate deviation requires fixing the upstream spec first, not diverging silently.
* **Check Internal Constraint Violations**: Verify that the document does not violate its own rules (e.g., a Constraints section mandating a hooks bypass that the Algorithm section omits).

---

## D4 — Verify Cross-Document Coherence

* **Build Contact Points Table**: For multi-document sets, list and verify every shared interface, type, file, and protocol — coherence is never assessed "by eye".
* **Close References Bidirectionally**: Every field/type used by one document and owned by another must exist there (used-but-undefined), and defined elements never consumed anywhere should be flagged (defined-but-unconsumed).
* **Align Shared Constants**: Ensure limits, intervals, and timeouts are identical across all specs (e.g., a lock refresh defined as `2 minutes` in one document and `20-25 minutes` in another).
* **Enforce Canonical Vocabulary**: Verify terminology and spelling consistency for shared concepts (e.g., `artefactRoot` vs `artifacts/`; an encoding name applied to the wrong format).
* **Verify Status-Code Assertions Against Producing Module**: Every task-status assertion in the NIB-T must match the exact status code (`passed` / `failed` / `errored` / `cancelled`) produced by the referenced NIB-M's algorithm for that specific failure condition — a status value from the system-wide enum that the specific NIB-M never produces for that path is a coherence defect.
* **Verify Responsibility Boundaries**: Check for gaps where no document owns a required operation, and overlaps where two documents own it (they will diverge).
* **Verify Declared Extension/Inheritance**: When a document extends or refines another (a DC extending a base DC, a NIB-M refining a contract), the relationship must be declared and the perimeter split explicit.

---

## D5 — Verify Links & Examples Hygiene

* **Validate File Links**: Ensure there are no absolute `file://` links referencing local systems. All links must be relative and resolve to existing files in the workspace.
* **Execute Examples**: Mentally execute all examples — an unexecuted example is an unverified assertion. Verify that hashes have correct lengths and are not recognizable placeholders (e.g., 63 hex chars, or the SHA-256 of the empty string presented as a real digest), JSON payloads validate against their schemas with no non-standard fields, and step numbering is coherent.

---

## D6 — Check Universal Blind Spots

1. **Verify Output Coverage**: Every field of the declared output type must be produced somewhere in the algorithm (e.g., output fields present in the type but never populated).
2. **Verify Input Coverage**: Every parameter used in the algorithm must be declared in the input block (e.g., a `clock` or root path used but absent from the input type).
3. **Verify Constraints as Enforcement Steps**: Every declared constraint must appear as a concrete step in the algorithm (e.g., a "non-empty required field" that no step validates).
4. **Verify Cross-Cutting Obligations**: Every global invariant or policy declared at the system level (NIB-S) must be honored in **each** module brief, not just one (e.g., mandatory checkpoint timestamps that no task actually writes).
5. **Verify Life Cycle (Persistence & Resume)**: Check that memory-built structures are actually persisted, and that re-run behavior (idempotence, checkpoints, retries, adoption) is specified.
6. **Verify Ambient Non-Determinism**: Flag direct `new Date()` / `Date.now()`, random generators, and direct environment reads wherever the system provides injected abstractions (clock, ID derivation, config).
7. **Verify Option Fallbacks**: Ensure that all optional input fields have explicit default values or fallbacks defined.
8. **Enforce Path Safety**: Verify containment checks use canonical resolution on both sides (e.g., double `realpath` before prefix comparison) and that raw-vs-resolved path storage is explicit.
9. **Verify Secret Redaction**: Check that secrets and tokens are redacted from logs and errors using complete pattern sets (e.g., all known token prefixes, not just one).
10. **Ensure Error Path Coverage**: Verify that external call failures, parsing crashes, and timeouts transition the system into a specified error state instead of being silently ignored.

---

## D7 — Verify NIB-T RED Discipline & Test-Brief Quality

Applies when the audited lot contains a TDD Tests Brief (NIB-T).

* **Flag Always-Green Tests**: Every prescribed test must genuinely fail before any production runtime code exists (RED). Flag surface/export checks, constant checks (`X === literal`), hardcoded-fixture shape tests, error-class instantiation checks, and test-harness self-tests — these belong to a GREEN Layer 1 companion list, not the NIB-T. Guiding question: does the test pass trivially once `tsc --noEmit` succeeds?
* **Flag Prescribed Unit Tests**: The NIB-T must not prescribe tests for internal functions or non-observable behavior — those depend on a code structure that does not exist yet and emerge during GREEN.
* **Verify Contract Invariants Are Post-Conditions**: A genuine contract invariant rides parasitically on the outputs of acceptance tests (e.g., "no output of ANY fixture modifies a protected zone"). Flag standalone assertions dressed up as invariants — they are surface checks.
* **Verify Test-Vector Translatability**: Every test vector must specify concrete input, expected output, and the property being verified — directly translatable into assertions with zero additional decisions (no "appropriate output", no unspecified fixture content).
* **Verify Edge-Case Coverage (NIB-M → NIB-T)**: Every edge case listed in a NIB-M must have a corresponding test vector in the NIB-T, unless explicitly deferred with a "v2" / "known limitation" note. Build the mapping table — never assess coverage "by eye".
* **Verify Anti-Cheat Presence**: The NIB-T must include property tests that hold across inputs (e.g., idempotence, EOL robustness, rejection of out-of-bounds edits) — acceptance vectors alone invite hardcoding and overfitting.
* **Verify Fixture Determinism**: Fixtures and helpers must not depend on ambient state (clock, randomness, filesystem layout, environment) unless the injection mechanism is explicitly specified.

---

## D8 — Enforce Report Quality Standards

* **Check Traceability**: Ensure every finding cites the exact file name, section, line or snippet, and the authoritative reference it diverges from.
* **Check Actionability**: Avoid vague critiques (e.g., "the algorithm is unclear"). Provide concrete corrective actions.
* **Maintain Severity Separation**: Keep clear boundaries between Blocker (🔴) and Minor (🟡) findings per the SKILL.md §4 definitions; never let a probe or checklist hit auto-escalate to blocker.
