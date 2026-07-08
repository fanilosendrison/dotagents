---
name: turnlock-context
description: >-
  Loads the turnlock project directives and architecture. Use ONLY when the
  request explicitly mentions "turnlock" or relates to the turnlock project.
  Valid triggers: the user explicitly talks about "turnlock", the user cites
  turnlock by name, works on files under
  /Users/famillesendrison/Developper/Projects/VegaCorp/turnlock/, or works
  on a project that has turnlock as a dependency.
---

# Turnlock Context

Read `/Users/famillesendrison/Developper/Projects/VegaCorp/turnlock/AGENTS.md`.

Extract from it:
- **Core properties** — Snapshot-authoritative, Fail-closed, JSON-only, Minimal runtime dependencies, Mechanical determinism
- **Project Structure** — strict separation between pure logic (`src/types`, `src/errors`) and I/O (`src/services`)
- **Normative Interface Briefs (NIBs)** — the project is entirely spec-driven, NIBs are read-only during implementation
- **Specific Rules** — `stdout` is exclusively for protocol blocks, atomic filesystem writes, no implicit singletons
- **Verification Commands** — tests (`bun test`), linting (`biome`), type-checking (`tsc`)
