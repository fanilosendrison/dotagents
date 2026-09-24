---
name: git-commits-push
description: Discover dirty repos, validate (tests + secret scan), generate Conventional Commits via LLM, commit with file-level splitting, auto-push with retry loop. Use when the user says "commit", wants to publish changes, or asks about commit messages.
---

# Git Commits Push

When this skill is activated or referenced, immediately invoke the installed
executable. Never emit `/git-commits-push` as a Bash command; slash-form skill
references are interactive harness input, not shell executables.

For global discovery, run:

```bash
"$HOME/.local/bin/git-commits-push"
```

When the caller supplies an exact targeted repository, remote, and ref, pass all
three values as one atomic argument group:

```bash
"$HOME/.local/bin/git-commits-push" \
  --repository "/absolute/path/to/worktree" \
  --push-remote origin \
  --push-ref refs/heads/main
```

Use literal, shell-quoted values. Do not replace a missing targeted value with a
shell variable, command substitution, inferred repository, remote, or ref.

**Do not set an external timeout.** The executable manages its own deadlines.
