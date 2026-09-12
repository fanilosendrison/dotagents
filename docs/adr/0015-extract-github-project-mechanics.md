---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "markdown-adr"
title: "Extract GitHub Project mechanics into a dedicated standalone CLI"
status: accepted
workspace: "dotagents"
date: "2026-09-12"
step_id: 6
supersedes: "None"
author: [VegaCorp]
tags: [github, projects, cli, architecture]
---

# Extract GitHub Project mechanics into a dedicated standalone CLI

## Context

The shared GitHub Engineering Projects rule embeds long Bash and GraphQL recipes
for authenticated discovery, exact Project-item lookup, field-option identity
resolution, mutation, and verification. The rule exceeds 500 lines and makes
agents repeatedly load executable mechanics that should instead be tested. The
capability must serve multiple repositories and harnesses without making
runtime execution depend on a mutable source checkout.

GitHub remains the durable workflow-state owner, repository profiles remain the
local mapping and technical-authority owner, and dotagents remains the
agent-policy owner. Any extracted program must therefore remain a mechanical
adapter rather than a competing workflow authority.

## Decision

Create the public MIT-licensed repository
`fanilosendrison/github-engineering-projects` with its checkout at
`~/Developper/Projects/github-engineering-projects`. Implement a Node.js,
TypeScript, and pnpm CLI named `github-engineering-projects` for authenticated
Project inspection, exact item lookup, adding an existing Issue to a Project,
exact single-select field mutation, native blocked-by relationships,
postcondition verification, and versioned JSON receipts.

Install immutable content-addressed releases below the user data directory and
expose the selected release through
`~/.local/bin/github-engineering-projects`. The installed runtime must not
consult or import from the source checkout.

Keep the initial runtime stateless and execute the official `gh` client without
a shell. Discover opaque GitHub identities live, paginate complete collections,
reject missing or ambiguous identities, sanitize diagnostics, and re-read every
mutation before reporting success.

Do not expose commands that choose lifecycle state, priority, classification,
Issue readiness, work selection, or finding creation. Do not parse repository
Markdown profiles. The invoking agent resolves local policy and passes explicit
values to the CLI.

## Alternatives Considered

- **Keep mechanics in Markdown**: This preserves prompt bloat, untested GraphQL,
  copy-paste mutation logic, and truncated `first: 100` lookups.
- **Create standalone shell scripts**: Shell retains weak JSON handling, quoting
  risk, implicit `jq` coupling, and poor testability while conflicting with the
  accepted Node/TypeScript platform.
- **Invoke the source checkout directly**: This couples production use to mutable
  developer state and prevents stable rollback.
- **Copy git-commits-push orchestration**: Turnlock, SQLite, a daemon, an LLM, and
  enforcement are not justified for stateless Project API operations.
- **Parse repository Markdown profiles**: This would turn prose into an implicit
  machine contract and duplicate profile authority.

## Consequences

### Pros

- Removes reusable GitHub mechanics from agent prompt context.
- Centralizes pagination, ambiguity handling, output redaction, and
  postcondition verification.
- Provides a tested reusable adapter across repositories and harnesses.
- Preserves official GitHub primitives and the authority of live Project state.
- Enables immutable installation and rollback without checkout dependency.

### Cons

- Introduces another repository, release process, installer, and compatibility
  surface.
- Requires maintaining GitHub GraphQL response validation and pagination.
- Requires coordinating CLI receipt compatibility with dotagents integration.
- Multi-mutation workflows remain non-atomic and must expose partial success.
- A public repository requires ongoing dependency and security maintenance.

## References

- [GitHub CLI manual](https://cli.github.com/manual/)
- [GitHub Projects GraphQL API](https://docs.github.com/en/graphql/reference/objects#projectv2)
- [Semantic Versioning 2.0.0](https://semver.org/)
- [ADR-0014: Adopt Node.js and pnpm for active harness surfaces](https://github.com/fanilosendrison/dotagents/blob/main/docs/adr/0014-adopt-node-pnpm-platform.md)
