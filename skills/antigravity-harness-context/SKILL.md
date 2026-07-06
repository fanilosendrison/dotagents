---
name: antigravity-harness-context
description: >-
  Loads the Antigravity harness directives and architecture
  (~/.gravity/ / dotgravity). Use ONLY when the request explicitly
  mentions Antigravity, ~/.gravity/, .gravity or dotgravity (the repo).
  Valid triggers: the user cites Antigravity by name, cites
  ~/.gravity/, .gravity or dotgravity, reports a path-guard redirect
  specifically to ~/.gravity/, asks to modify the Antigravity harness,
  invokes a harness-related skill (e.g. /document-wrapper), or works on
  extensions/docs under ~/.gravity/.
---

# Antigravity Harness Context

Read `/Users/famillesendrison/.gravity/CONTEXT.md`.

Extract from it:
- **Path-guard rule** — write through `~/.gravity/`, never into `dotgravity/`
- **Commit command** — the `readlink` + `/git-commits-push` pattern
- **Navigation** — links to `docs/`, `wrappers/`, `specs/`, `tests/`
- **Architecture** — hooks → wrappers → enforcers (`~/.agents/`)
