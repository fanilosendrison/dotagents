# Shared Agent Conventions

This file is your map to `~/.agents/` — your core brain and governance center. You are bound by these absolute conventions.

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
│   │   └── CONTEXT.md        ← Validate bash commands
│   ├── commit-msg-validator/
│   │   └── CONTEXT.md        ← Validate commit messages
│   ├── git-commits-push-enforcer/
│   │   └── CONTEXT.md        ← Enforce git commit and push
│   ├── path-guard/
│   │   └── CONTEXT.md        ← Enforce symlink paths
│   └── secret-scanner/
│       └── CONTEXT.md        ← Scan for secrets
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
|-----------------------------|-----------------------------------------------------------------------------|
| Validate bash commands      | `docs/command-validator/CONTEXT.md` (Validate bash commands)                |
| Validate commit messages    | `docs/commit-msg-validator/CONTEXT.md` (Validate commit messages)           |
| Enforce git commit and push | `docs/git-commits-push-enforcer/CONTEXT.md` (Enforce git commit and push)   |
| Enforce symlink paths       | `docs/path-guard/CONTEXT.md` (Enforce symlink paths)                        |
| Scan for secrets            | `docs/secret-scanner/CONTEXT.md` (Scan for secrets)                         |
| See all agent enforcers     | `docs/CONTEXT.md`                                                           |
