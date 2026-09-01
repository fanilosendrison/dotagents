# Operational Implementation Rules

You are bound by these operational rules for every task. Read them carefully.

## 1. Pre-Implementation Protocol

**Never implement** without explaining your plan first.

Before ANY implementation task:

1. **Summarize your strategy**: explain which files you will create/modify and why.
2. **Define responsibilities and boundaries**: state the primary responsibility of every new or materially changed module, and explain how it fits the existing architecture.
3. **Justify your choices**: explain why you chose this approach rather than another.
4. **Report risks**: point out what could break and the affected dependencies.
5. **Wait for validation**: do not write any code until your strategy is approved.

### Approval Triggers

- If I say "vas-y", "go", or explicitly validate, you have the green light.
- For a trivial task, the strategy may be brief, but explicit approval is still required before implementation.

### Trivial Task Definition

A task is trivial only if it is a localized, mechanically obvious, low-risk change that does **not** alter:

- runtime behavior,
- architecture,
- public interfaces,
- dependencies,
- persistence,
- security,
- concurrency,
- protocol semantics,
- business rules,
- or compliance behavior.

A trivial task is typically small (often fewer than 10 changed lines), but line count alone does not determine triviality.

### Task Complexity Protocols

- **Non-trivial implementation**: You must use the `strategy-evaluator` (you will get a GO / GAP / REJECT opinion; do not code until you get a GO).
- **Complex tasks**: For a multi-step or multi-file plan, you must invoke `TaskCreate`. Update your status as you progress.

---

## 2. Scope Discipline

Discovering a problem does not automatically authorize modifying it.

For any issue found during implementation:

1. Determine whether it was caused by the current change or is required to complete the approved task safely.
2. If yes, fix it within the approved scope.
3. If it is pre-existing, unrelated, or would materially expand the task, report it explicitly.
4. Do not modify unrelated behavior, architecture, tests, or files without approval.

This applies to, among other things:

- pre-existing failing tests,
- dead code,
- duplicated logic,
- architectural problems,
- inconsistencies,
- obsolete comments,
- unrelated refactoring opportunities,
- dependency issues.

---

## 3. Strict Prohibitions (What You Must NEVER Do)

- Never ignore a failing test.
  - If the failure was caused by your changes, fix it before completion.
  - If it is pre-existing and unrelated to the approved task, report it explicitly and do not modify unrelated behavior without approval.
- Never use weak generic types (`any`, `Object`, `interface{}`, `dynamic`) without commenting your justification.
- Never put domain or application business logic in the infrastructure layer.
- Never create files whose names no longer accurately describe their content — split them.
- Never invent behavior not specified in the specs — ask me first.
- Never delete or modify compliance tests without explicit validation.
- Never use `print`/`console.log`/`println` for debugging — use the project's logging system.
- Never leave dead code, commented-out code, or obsolete comments introduced or made obsolete by your changes.
- Never make things configurable if they come from the specs — hardcoded specification values are intentional.
- Never hardcode environment-dependent things — addresses, ports, keys, machine-specific paths → use env vars or config.
- Never put a secret in the code or in a versioned file.
- **Never leak sensitive data**: use generic placeholders (e.g., `<project>`, `<api_key>`) for secrets, credentials, private infrastructure identifiers, user-specific data, and machine-specific configuration in documentation and tracked files.
- Never duplicate executable domain rules, validation rules, protocol semantics, transformations, authoritative constants, or other authoritative production logic across multiple implementations.
- Never bypass established architectural boundaries simply because doing so is faster or requires fewer changes.
- Never split a file cosmetically just to satisfy the 400-line limit. Every extracted module must represent a coherent responsibility, concept, or architectural boundary.
- Never create vague catch-all modules such as `helpers`, `utils`, `misc`, or `common` when a more precise responsibility can be named.
- Never introduce a new architectural pattern silently. Any architectural change must be identified and justified in the pre-implementation strategy.

---

## 4. Mandatory Practices (What You MUST Always Do)

- You must name things explicitly: if a name is too long, so be it.
- You must prefer readable code over clever code. If a trick is necessary, comment why you used it.
- You must report inconsistencies you find (between specs, between specs and existing code).
- You must propose improvements when you see a problem, even if I did not ask.
- Before finalizing an implementation, you must verify that every hand-written source file is within the 400-line limit and that the change did not introduce duplicated authoritative production logic or blurred module responsibilities.
- Domain invariants belong in the domain layer.
- Use-case orchestration belongs in the appropriate application layer according to the project's established architecture.
- Infrastructure must implement technical concerns without becoming the owner of business rules.

### Symlink Gateways & Portability

You must ensure compatibility with the symlinked gateway architecture (`~/.agents/`, `~/.codex/`, `~/.pi/`).

1. Never use machine-specific absolute filesystem paths (e.g., `/Users/...`) in source imports.
2. Use the project's established relative, package, or alias-based import conventions.
3. Always verify that module resolution passes within the gateway context by running checks (e.g., `tsc --noEmit -p ~/.agents/tsconfig.json`) before finalizing your changes.
4. If new dependencies are added or type checking fails at the gateway root, verify that both `package.json` and `node_modules` are symlinked from the physical repo into the gateway.

---

## 5. Architectural Integrity & Modularity

The codebase must remain easy for both humans and coding agents to understand, modify, and verify locally.

**Architectural clarity is a correctness requirement, not merely a style preference.**

### 5.1 File Size

- **No hand-written source code file may exceed 400 physical lines.**
- The limit is measured as physical file lines, equivalent to the result reported by `wc -l`, including blank lines and comments.
- This limit applies to implementation code and hand-written tests.
- Generated files, machine-produced artifacts, snapshots, fixtures, or large declarative datasets may be exempt when they are not meaningfully maintainable as normal source modules and splitting them would provide no architectural benefit.
- Any exemption must be obvious from the file's role or explicitly justified.
- Do not wait until a file exceeds 400 lines to consider decomposition. If a file is approaching the limit and already contains separable responsibilities, split it before adding more behavior.
- The line limit is a guardrail, not the architectural objective. A 200-line file with mixed responsibilities is still badly structured.

### 5.2 Single, Explicit Responsibility

- Every module must have **one explicit primary responsibility**.
- A module must have a clear and coherent reason to change.
- Before adding behavior to an existing module, verify that the behavior belongs to that module's established responsibility.
- If a change would introduce a second substantial responsibility into a module, create or extract the appropriate module instead.
- File and module names must accurately communicate their responsibility.
- Responsibilities must be visible from the architecture itself, not merely inferred from implementation details.

### 5.3 Strong Module Boundaries

- Modules must expose the **smallest practical public interface**.
- Internal implementation details must remain private unless another module genuinely requires them.
- Dependencies between modules must be explicit and must respect established architectural boundaries.
- Do not create hidden coupling through shared mutable state, implicit initialization, side effects, global registries, or unrelated utility modules.
- Prefer dependency directions that keep domain and core logic independent from infrastructure concerns.
- Cross-module access must happen through intentional interfaces, not through knowledge of another module's internals.

### 5.4 Single Source of Truth

- Every executable business rule, domain invariant, validation rule, protocol rule, transformation, and authoritative production constant must have **one canonical implementation or definition**.
- Reuse the authoritative production implementation instead of recreating equivalent production logic elsewhere.
- If two production implementations encode the same project knowledge, consolidate them unless an explicit architectural constraint requires independent implementations.
- When duplicated production knowledge is discovered during a task, report it and include consolidation in the strategy when it is safe, relevant, and within approved scope.

#### Independent Verification Exception

Tests and verification artifacts may intentionally restate expected behavior when independence is necessary to detect implementation errors.

This includes:

- compliance tests,
- specification fixtures,
- golden files,
- expected-value tables,
- independent verification oracles.

Tests must not reuse production logic in a way that makes the test tautological.

The purpose of the single-source-of-truth rule is to avoid duplicated **production authority**, not to prevent independent verification.

### 5.5 Duplication vs Abstraction

- Avoid duplicated **knowledge and behavior**, not merely duplicated syntax.
- Do not introduce abstractions solely because two small pieces of code happen to look similar.
- Superficial duplication is acceptable when removing it would create artificial coupling between conceptually independent responsibilities.
- An abstraction must represent a real shared concept, invariant, behavior, or architectural boundary.
- Prefer two simple independent implementations over one misleading generic abstraction.
- DRY must never be used as justification for coupling unrelated modules.

### 5.6 Cohesion Over Cosmetic Decomposition

Splitting a large module is valid only if the resulting modules have meaningful responsibilities.

Bad decomposition:

```text
foo.ts
foo-helpers.ts
foo-utils.ts
foo-misc.ts
```

when those files still collectively mix unrelated concerns.

Prefer decomposition along real conceptual boundaries, for example:

```text
parser/
resolver/
validator/
persistence/
execution/
```

The objective is not merely to create smaller files. The objective is:

**small units + strong boundaries + explicit responsibilities + a single source of truth.**

### 5.7 Architectural Changes During Implementation

- Do not silently introduce a new architectural pattern.
- If the requested implementation does not fit the current architecture cleanly, report the conflict during the pre-implementation strategy.
- If preserving architectural integrity requires refactoring before implementing the requested behavior, include that refactor in the strategy and explain why it is necessary.
- Refactoring must preserve observable behavior unless a behavior change is explicitly required by the specification.
- Architectural refactors must be backed by appropriate tests and verification.
- Do not perform unrelated architectural refactors opportunistically. Keep the scope connected to the requested task unless broader work is explicitly approved.

### 5.8 Final Architectural Verification

Before declaring an implementation complete, verify all of the following:

1. No hand-written source code file exceeds 400 physical lines.
2. Every created or materially changed module has one identifiable primary responsibility.
3. File names still accurately describe their contents.
4. No authoritative production business or domain logic was duplicated.
5. No new unnecessary coupling or architectural boundary violation was introduced.
6. New abstractions correspond to real shared concepts rather than superficial code similarity.
7. Independent tests remain independent enough to detect incorrect production behavior.
8. All relevant tests, type checks, and project-specific verification commands pass.
9. Any pre-existing unrelated failures discovered during the task are explicitly reported.
10. No unrelated modifications were made outside the approved scope.

If any required check fails because of the current change, the task is not complete.

If a check is blocked by a pre-existing unrelated problem, report that problem explicitly rather than silently expanding the task.

---

## 6. Architectural Trade-offs

When faced with multiple implementation paths:

1. You must choose the approach that best respects the **fundamental properties of the project** (refer to the project's AGENTS.md or CLAUDE.md).
2. You must prefer the approach with the clearest responsibilities and strongest module boundaries.
3. You must prefer a single authoritative production implementation of project knowledge over duplicated production logic.
4. When making technical decisions, do not optimize primarily for short-term implementation cost or development speed. Prefer quality, simplicity, robustness, appropriate scalability, and long-term maintainability.
5. Development cost may be considered as a secondary factor, but it must not justify a materially worse architecture, weaker correctness guarantees, unnecessary technical debt, or reduced maintainability.
6. Do not trade long-term code quality for short-term implementation convenience.
7. Do not over-engineer for hypothetical future requirements. Scalability and extensibility must be proportionate to known or reasonably expected project needs.
8. All else being equal → **you must choose the simplest approach**.
9. Simplicity does not justify violating modularity, architectural boundaries, responsibility separation, correctness guarantees, robustness, or the single-source-of-truth principle.
10. If you are in real doubt → you must present both options to me with their trade-offs.

---

## 7. Environmental Constraints (macOS Monterey 12.7.6)

- **No Homebrew**: Homebrew is no longer supported on this system. You must propose alternatives (direct download, npm/npx, curl binary, build from source).
- **No Docker**: Docker Desktop is no longer supported on this system. You must propose alternatives (uv/curl bootstrap script, venv, native path). You must never recommend `containerization: DOCKER`.

---

## 8. Project Compliance & Tooling

- **Agent Enforcers vs Hook Managers**: Linting, formatting, and commit validation are handled by your agent-enforcers. You must never install Husky, lint-staged, pre-commit, lefthook, etc. If an existing project contains one, do not touch it, but do not add any.
- **Versioning**: For any version number (`package.json`, frontmatter, tags, changelogs), you must read and apply `conventions/semver.md`.
- Use SemVer 2.0.0.
- New WIP projects/packages start at `0.1.0`.
- Existing projects/packages must never reset their version to `0.1.0`; determine the next version from the current version according to `conventions/semver.md`.
