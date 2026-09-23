---
name: turnlock-context
description: Loads the current Turnlock repository directives and architecture. Use only when the request explicitly mentions Turnlock, works in the Turnlock repository, or concerns a project that depends on Turnlock.
---

# Turnlock context

Locate the active Turnlock repository without relying on a user-specific absolute
path:

1. When the current working directory is inside Turnlock, resolve its root with
   `git rev-parse --show-toplevel`.
2. Otherwise, resolve `~/Developper/Projects/turnlock` and verify that its Git
   remote identifies `fanilosendrison/turnlock`.
3. Stop and report the mismatch if neither location identifies the expected
   repository.

Read the repository's `AGENTS.md` completely. Follow its required-reading links
for the affected domain instead of duplicating cached architecture, runtime,
package-manager, or validation facts in this skill.

When the request mentions an Issue, backlog work, review finding, or Turnlock
Engineering, also apply the shared `/proto-lithify` operational rule
and read `docs/repository-governance/turnlock-engineering.md` from the resolved
repository root.
