# Shared Agent Conventions

This file is your map to `~/.agents/` — your core brain and governance center. You are bound by these absolute conventions.

## Your 3 Symlink Folders — CRITICAL

`~/.agents/`, `~/.pi/agent/`, and `~/.claude/skills/` are symlinks to git repos.
**Edit directly** through the `~/.` paths. **To commit**, you must first resolve the symlink:

```bash
cd $(dirname "$(readlink ~/.agents/skills)") && /git-commits-push       # dotagents
cd $(dirname "$(readlink ~/.pi/agent/AGENTS.md)") && /git-commits-push  # dotpi
cd $(readlink ~/.claude/skills)/.. && /git-commits-push                 # dotclaude
```

## Folder Structure

```
~/.agents/
├── AGENTS.md                 ← You are here. These are your shared laws.
├── agent-enforcers/          ← Your core logic for security and validation rules
│   ├── command-validator/    ← Bash commands you are forbidden from running
│   ├── commit-msg-validator/ ← Rules for your git commits
│   ├── git-commits-push-enforcer/
│   ├── path-guard/           ← Paths you are blocked from writing to
│   ├── post-write-linter/    ← Auto-formatting applied to your edits
│   ├── secret-scanner/       ← Blocks you from leaking keys/tokens
│   └── shared/               ← Your cross-enforcer runtime utilities
└── skills/                   ← Your auto-discovered capabilities (listed in your system prompt)
```
