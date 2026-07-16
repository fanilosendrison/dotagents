# 📋 Execute Verification Checklists (D1–D7)

Scan the specifications using these 7 checklists to identify common specification defects. Execute these baseline verification checks before running the generative probes.

---

## D1 — Verify Template & Structural Compliance

* **Check NIB-M Structure**: Confirm the presence of the 8 mandatory sections: Purpose, Inputs, Outputs, Algorithm, Examples, Edge cases, Constraints, and Integration.
* **Check DC Structure**: Confirm the presence of sections §0 to §6: Identity, Interface, Behavioral contract, Error semantics, Integration patterns, Consumer constraints, and Known limitations.
* **Verify Frontmatter Metadata**: Ensure `id`, `type`, `version`, `status`, and `referenced_by` or `superseded_by` are present. Flag any non-standard metadata fields.
* **Enforce Language & Naming**: Ensure English is used consistently. Check naming conventions for files and symbols against project casing rules.

---

## D2 — Verify Alignment with Dependency Codebases

* **Verify Source Signatures**: Open the target source code of the dependency. Verify that method signatures, parameter names, and return types match the spec exactly (e.g., check for `Promise<void>` vs `Promise<never>` mismatches).
* **Verify Error Classes**: Check the dependency's actual error class definitions (e.g., `errors/concrete.ts`). Ensure fatal vs retryable behaviors match the runtime logic.
* **Verify Transitive Closure of Types**: Confirm that every type referenced within inputs or outputs is either defined inline or explicitly linked to its source definition.
* **Eliminate Stale Version Citations**: Search the document for occurrences of previous library versions (e.g., verify that no references to `v0.8.0` remain after migrating to `v0.9.0`).
* **Flag Invented APIs**: Identify any variables, environment configurations, or API methods mentioned in the spec that do not exist in the dependency's actual export contract.

---

## D3 — Verify Alignment with Upstream Specifications

* **Perform Schema Comparatives**: Construct a "Spec says / NIB says" table to check for deviations in schemas (e.g., flat objects vs nested maps, required vs optional fields).
* **Verify Command Integrity**: Compare commands (e.g., git commands, CLI tools) line by line. Verify flags, arguments, and quotes (e.g., `diff-index --cached` vs `diff --cached`).
* **Verify Physical Topology**: Match filenames, extensions, and directory structures against the upstream requirements (e.g., `.patch` vs `.diff`, and paths like `startup/dirty-state-capture/evidence/patch.diff` vs root).
* **Check Logical Fidelity**: Detect logic inversions (e.g., check for conditions checked at the wrong stage of a pipeline).
* **Check Internal Constraint Violations**: Verify that the document does not violate its own rules (e.g., a section requiring a wrapper command bypass but another section showing a raw command).

---

## D4 — Verify Cross-Document Coherence

* **Build Contact Points Table**: For multi-document sets, list and verify shared interfaces, types, and files.
* **Align Shared Constants**: Ensure limits, intervals, and timeouts are identical across all specs (e.g., check that a lock refresh is not defined as `2 minutes` in one spec and `20 minutes` in another).
* **Enforce Canonical Vocabulary**: Verify terminology consistency (e.g., check for `artefactRoot` vs `artifacts/`, and ensure hash encoders are uniformly named).
* **Verify Responsibility Boundaries**: Check for overlapping logic or gaps where no document takes ownership of a required operation.

---

## D5 — Verify Links & Examples Hygiene

* **Validate File Links**: Ensure there are no absolute `file://` links referencing local systems. All links must be relative and lead to existing files in the workspace.
* **Execute Examples**: Mentally trace all examples. Verify that hash examples have correct lengths (e.g., exactly 64 characters for SHA-256), JSON payloads are valid and match schemas, and steps match the documented algorithms.

---

## D6 — Check Universal Blind Spots

1. **Verify Cycle of Life (Persistence & Resume)**: Check if memory-allocated structures are saved to disk. Verify behavior during a re-run or failure (idempotence, checkpoints, and retries).
2. **Verify Clock Sources**: Flag usage of ambient non-deterministic calls like `new Date()` or `Date.now()`. Ensure the system uses an injected clock helper where determinism is required.
3. **Verify Variable Scopes**: Check that all parameters utilized in the algorithm are declared in the input block.
4. **Enforce Symlink Containment**: Verify containment checks are safe (e.g., utilize double-resolution canonical paths (`realpath`) to prevent directory traversal exploits).
5. **Verify Option Fallbacks**: Ensure that all optional input fields have explicit default values or fallbacks defined.
6. **Verify Token/Secret Redaction**: Check that secrets and authentication tokens are redacted from logs and errors using thorough prefix/suffix matching.
7. **Ensure Error Path Coverage**: Verify that HTTP failures, parsing crashes, and external timeouts transition the system into a known error state instead of failing silently.

---

## D7 — Enforce Report Quality Standards

* **Check Traceability**: Ensure every finding cites the exact file name, section, line of code, or reference document.
* **Check Actionability**: Avoid vague critiques (e.g., "The algorithm is unclear"). Provide concrete corrective actions.
* **Maintain Severity Separation**: Keep clear boundaries between Blocker (🔴) and Minor (🟡) findings.
