---
name: git-commits-push
description: Validate, secret-scan, plan Conventional Commits, commit exact file groups, and publish the current worktree or an explicitly authorized target. Use when asked to commit, push, publish changes, or use the commit publisher.
metadata:
  okf_version: "1.0"
  kind: "AgentSkill"
  domain: "git-publication"
  version: "1.0.0"
  entry_points:
    - "Commit or publish authorized repository changes"
---

# Git Commits Push

Invoke only the canonical installed executable for authorized publication. Never emit `/git-commits-push` as a Bash command; slash-form skill references are interactive harness input. Reading this manifest for maintenance does not itself request publication.

## Ordinary invocation

Process only the exact current worktree, never global discovery or sibling repositories:

```bash
"$HOME/.local/bin/git-commits-push"
```

Require an attached branch. Use explicit targeted publication for detached task worktrees.

## Existing targeted destination

Pass all three literal authorized values as one atomic group. This mode requires a destination branch that already exists:

```bash
"$HOME/.local/bin/git-commits-push" --repository "/absolute/exact/task-worktree" --push-remote "origin" --push-ref "refs/heads/feat/example"
```

## Conditional creation of a new task destination

First verify the actual installed immutable release supports conditional creation (git-commits-push 0.10.0 or a later compatible release). Source version alone is not installation evidence. Do not send unsupported flags or bootstrap a branch implicitly.

When the mandate and repository policy authorize the exact new task branch and base, pass the complete six-option group:

```bash
"$HOME/.local/bin/git-commits-push" --repository "/absolute/exact/task-worktree" --push-remote "origin" --push-ref "refs/heads/feat/example" --create-if-absent --base-ref "refs/heads/main" --base-sha "<full-authorized-base-OID>"
```

Resolve and replace every example value with an observed, authorized literal. Do not invent the remote, destination or base. Do not infer authority from the current branch, absence, ambient configuration or names such as `main` and `master`.

Treat `--create-if-absent` as a presence-only boolean. Require `--base-ref` and `--base-sha` together with it and the full targeted group. The base must be a full local commit OID anchored in the observable source branch at the effective push endpoint; the runtime never fetches or converges history. It validates all outgoing history after that base and conditionally publishes directly at the final validated SHA.

A fresh creation request refuses an existing destination even at the desired SHA. Use the existing-target mode for subsequent updates, never creation as an implicit update. Rights or observation failures remain legitimate stops; expected task-branch absence does not require a separate manual bootstrap when explicit creation is authorized and compatible support is installed.

## Resume and shell boundary

Resume an existing invocation only with its persisted authority. Never combine `--resume` with targeted or creation flags, recapture a destination as a new baseline, or recreate a deleted ref from an already successful run. Preserve interrupted commits; stop when the runtime cannot prove safe resumption.

Execute the canonical command on one line with static shell-quoted arguments. Do not use environment prefixes, variables in arguments, substitutions, wrappers, redirects, chains or an external timeout. The executable owns deadlines and bounded retry. Neither this skill nor the runtime grants general permission to create or recreate protected or authoritative refs.
