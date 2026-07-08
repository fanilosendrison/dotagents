---
name: codex-harness-context
description: >-
  Loads the Codex harness directives and architecture
  (~/.codex/ / dotcodex). Use ONLY when the request explicitly
  mentions "Codex harness", "codex harness", ~/.codex/, .codex or
  dotcodex (the repo).
  Valid triggers: the user cites "Codex harness" by name, cites
  ~/.codex/, .codex or dotcodex, reports a path-guard redirect
  specifically to ~/.codex/, asks to modify the Codex harness,
  invokes a harness-related skill, or
  works on hooks/docs under ~/.codex/.
---

# Codex Harness Context

Read `/Users/famillesendrison/.codex/CONTEXT.md`.

Extract from it:
- **Symlink rule** — write through `~/.codex/`, never directly into `dotcodex/`
- **Quick Navigation** — find the right doc/hook topic by what the user wants to do
- **Folder structure** — locate hooks, docs, data, and skills
- **Commit command** — the `readlink` + `/git-commits-push` pattern
