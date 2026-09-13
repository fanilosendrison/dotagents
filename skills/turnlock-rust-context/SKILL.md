---
name: turnlock-rust-context
description: Loads the current Turnlock-Rust repository directives, specification authority, formal-verification boundaries, and Engineering Project routing. Use only when the request explicitly mentions Turnlock-Rust or turnlock-rust, works in its repository, or concerns work governed by that repository.
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "turnlock-rust"
  entry_points:
    - "Turnlock-Rust repository work"
    - "Turnlock-Rust specification or formal-verification work"
    - "Turnlock-Rust Engineering Project work"
---

# Turnlock-Rust context

Locate the active Turnlock-Rust repository without relying on a user-specific
absolute path:

1. When the current working directory is inside Turnlock-Rust, resolve its root
   with `git rev-parse --show-toplevel`.
2. Otherwise, resolve `~/Developper/Projects/turnlock-rust` and verify that its
   Git remote identifies `fanilosendrison/turnlock-rust`.
3. Stop and report the mismatch if neither location identifies the expected
   repository.

Read the repository's `AGENTS.md` completely. Follow its required-reading links
for the affected domain instead of duplicating cached specification,
architecture, formal-verification, implementation, or validation facts in this
skill.

Do not infer a Rust crate, Cargo workflow, executable TLA+ model, TLC checks, or
implementation mechanism from the repository name. Accept those boundaries only
from current repository authority.

When the request mentions an Issue, Project work, backlog work, or a review
finding, also apply the shared GitHub Engineering Projects operational protocol
and read
`docs/repository-governance/turnlock-rust-engineering.md` from the resolved
repository root.
