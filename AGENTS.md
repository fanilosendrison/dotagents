# Your Directives

This file is your map to `~/.agents/` — your core brain and governance center. You are bound by these absolute directives.

## Your 3 Symlink Folders — CRITICAL

`~/.agents/`, `~/.pi/agent/`, and `~/.claude/skills/` are symlinks to git repos.
**Edit directly** through the `~/.` paths. 
**To commit**, you must first resolve the symlink:

```bash
cd $(dirname "$(readlink ~/.agents/skills)") && /git-commits-push       # dotagents
cd $(dirname "$(readlink ~/.pi/agent/AGENTS.md)") && /git-commits-push  # dotpi
cd $(readlink ~/.claude/skills)/.. && /git-commits-push                 # dotclaude
```

## Folder Structure

```
~/.agents/
├── AGENTS.md                 ← You are here.
├── docs/                     ← Documentation for agent enforcers and shared logic
│   ├── CONTEXT.md            ← Index
│   ├── command-validator/
│   │   └── CONTEXT.md        ← Forces you to verify bash commands
│   ├── commit-msg-validator/
│   │   └── CONTEXT.md        ← Forces you to validate commit messages
│   ├── git-commits-push-enforcer/
│   │   └── CONTEXT.md        ← Forces you to push after you commit
│   ├── path-guard/
│   │   └── CONTEXT.md        ← Shows you how to operate in symlink folders
│   └── secret-scanner/
│       └── CONTEXT.md        ← Prevents you to leak secrets
├── agent-enforcers/          ← Your core logic for security and validation rules
│   ├── command-validator/
│   ├── commit-msg-validator/
│   ├── git-commits-push-enforcer/
│   ├── path-guard/
│   ├── post-write-linter/
│   ├── secret-scanner/
│   └── shared/
└── skills/                   ← Your auto-discovered capabilities (listed in your system prompt)
```

## Quick Navigation

| Want to... | Go here |
|---------------------------------------------|-------------------------------------------------------------------------------------------|
| Forces you to verify bash commands          | `docs/command-validator/CONTEXT.md` (Forces you to verify bash commands)                  |
| Forces you to validate commit messages      | `docs/commit-msg-validator/CONTEXT.md` (Forces you to validate commit messages)           |
| Forces you to push after you commit         | `docs/git-commits-push-enforcer/CONTEXT.md` (Forces you to push after you commit)         |
| Shows you how to operate in symlink folders | `docs/path-guard/CONTEXT.md` (Shows you how to operate in symlink folders)                |
| Prevents you to leak secrets                | `docs/secret-scanner/CONTEXT.md` (Prevents you to leak secrets)                           |
| See all agent enforcers                     | `docs/CONTEXT.md`                                                                         |
