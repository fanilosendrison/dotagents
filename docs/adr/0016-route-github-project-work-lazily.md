---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "markdown-adr"
title: "Route GitHub Project work through one lazy-loading skill"
status: accepted
workspace: "dotagents"
date: "2026-09-12"
step_id: 6
supersedes: "None"
author: [VegaCorp]
tags: [github, projects, skills, context, architecture]
---

# Route GitHub Project work through one lazy-loading skill

## Context

The GitHub Engineering Projects operational rule mixes universal safeguards,
Project API recipes, Issue execution lifecycle, partial handoff and resumption,
and Issue creation policy. Every Project-related task is consequently exposed
to instructions for unrelated branches. Existing workspace decisions reserve
skills for active workflows and recommend lazy context loading for branched,
heavy workflows.

The routing design must keep non-negotiable governance visible while avoiding
multiple top-level skills and duplicated lifecycle rules.

## Decision

Integrate the GitHub Engineering Projects operational core directly into the
`github-engineering-projects` workflow-router skill with three conditional contexts
for Project inspection, item lifecycle, and Issue creation or reuse. Update
`~/.agents/AGENTS.md` to route work for a repository-declared GitHub Engineering
Project to that skill.

Keep repository-specific profiles in their repositories. Keep Issue lifecycle,
review, blocked-state, partial handoff, resumption, creation, and communication
policy in exactly one applicable skill context. Load the creation context only
when durable work must be created or reused, and load the lifecycle context only
when execution state is managed.

Keep the operational core in the skill, independent from CLI installation. It owns the
mandatory profile, authority, credential, access, live-identity, and
postcondition safeguards that apply to every workflow branch. Use the dedicated
standalone CLI only for mechanical GitHub operations.

## Alternatives Considered

- **Keep one monolithic operational rule**: Every operation continues to load
  unrelated policy and mechanics.
- **Create one skill per command or status**: This pollutes skill discovery and
  separates states that must be compared to choose a truthful transition.
- **Move all governance into the installed CLI repository**: Agent policy would
  become dependent on runtime installation and could drift from dotagents.
- **Move Issue templates into global conventions**: The fallback template is
  conditional on Engineering Project operation and repository-profile
  overrides, not a universal Markdown convention.
- **Remove the operational core from the skill**: Direct or exceptional GitHub access
  would lose mandatory authority, credential, and postcondition safeguards.

## Consequences

### Pros

- Loads only the instructions required for the current operation.
- Preserves one discoverable skill and the existing global navigation entrypoint.
- Keeps universal governance independent from the installed executable.
- Keeps lifecycle states together and prevents contradictory transition rules.
- Allows dynamic loading of creation policy only when a finding appears.

### Cons

- Adds routing files and link-integrity obligations.
- Requires regression checks to prevent policy duplication or mega-rule
  regrowth.
- Agents must correctly load an additional context when work changes branch.
- CLI and skill compatibility must be checked without duplicating command
  implementation details.

## References

- [ADR-0009: Differentiate Atomic Skills from Workflow Routers](https://github.com/fanilosendrison/dotagents/blob/main/docs/adr/0009-differentiate-atomic-skills-from-workflow-routers.md)
- [ADR-0010: Distinguish Active Skills from Passive Knowledge](https://github.com/fanilosendrison/dotagents/blob/main/docs/adr/0010-distinguish-active-skills-from-passive-knowledge.md)
- [GitHub Engineering Projects skill](https://github.com/fanilosendrison/dotagents/blob/main/skills/github-engineering-projects/SKILL.md)
