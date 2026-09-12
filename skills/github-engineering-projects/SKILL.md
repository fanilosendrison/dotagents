---
name: "github-engineering-projects"
description: "Operates repository-declared GitHub Engineering Projects: inspects tracked Issues and Project items, manages lifecycle and handoffs, and creates or reuses durable Issues. Use when a user requests Issue, Project, backlog, agent-queue, or review-finding work in a repository with an Engineering Project profile."
compatibility: "Requires Node.js 22.19.0 or newer, the official authenticated gh CLI, and the installed github-engineering-projects executable."
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "github-work-management"
---

# GitHub Engineering Projects

Read [`../../operational-rules/github-engineering-projects.md`](../../operational-rules/github-engineering-projects.md) first. Then read the target repository's `AGENTS.md` and Engineering Project profile.

Verify the mechanical adapter before the first GitHub operation:

```bash
"$HOME/.local/bin/github-engineering-projects" doctor
```

Load only the required context:

- For Project or item inspection and every Project field mutation, read
  [`01-inspect-project/CONTEXT.md`](01-inspect-project/CONTEXT.md).
- For pickup, execution, status changes, blocking, partial work, handoff,
  resumption, review, completion, reclassification, or relationship changes,
  also read
  [`02-manage-item-lifecycle/CONTEXT.md`](02-manage-item-lifecycle/CONTEXT.md).
- For creating, reusing, or decomposing durable Issues, also read
  [`03-create-or-reuse-issue/CONTEXT.md`](03-create-or-reuse-issue/CONTEXT.md).

If work enters another branch later, load its context at that point. Keep
workflow decisions in the skill and repository profile; use the CLI only for
mechanical GitHub operations and verified receipts.
