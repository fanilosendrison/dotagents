---
name: pi-harness-context
description: >-
  Loads the Pi harness directives and architecture
  (~/.pi/agent/ / dotpi). Use ONLY when the request explicitly
  mentions "Pi harness", "pi harness", ~/.pi/agent/, .pi/agent or
  dotpi (the repo).
  Valid triggers: the user cites "Pi harness" by name, cites
  ~/.pi/agent/, .pi/agent or dotpi, asks to modify the Pi harness,
  invokes a harness-related skill (e.g. /document-self-modif), or
  works on extensions/patches/docs under ~/.pi/agent/.
---

# Pi Harness Context

Read `/Users/famillesendrison/.pi/agent/CONTEXT.md`.

Extract from it:
- **Symlink rule** — write through `~/.pi/agent/`, never directly into `dotpi/`
- **Quick Navigation** — find the right doc/extension topic by what the user wants to do
- **Folder structure** — locate extensions, docs, patches, specs
- **Commit command** — the `readlink` + `/git-commits-push` pattern
