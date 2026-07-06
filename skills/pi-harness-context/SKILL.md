---
name: pi-harness-context
description: >-
  Loads the Pi harness configuration from ~/.pi/agent/CONTEXT.md.
  Use when the user asks about modifying the Pi harness, invokes a
  harness-related skill (e.g. /document-self-modif), or works on
  extensions/patches/docs under ~/.pi/agent/.
---

# Pi Harness Context

Read `/Users/famillesendrison/.pi/agent/CONTEXT.md`.

Extract from it:
- **Symlink rule** — write through `~/.pi/agent/`, never directly into `dotpi/`
- **Quick Navigation** — find the right doc/extension topic by what the user wants to do
- **Folder structure** — locate extensions, docs, patches, specs
- **Commit command** — the `readlink` + `/git-commits-push` pattern
