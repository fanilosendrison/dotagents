# Your Directives

This file is your map to `~/.agents/` — your core brain and governance center. You are bound by these absolute directives.

## Your 3 Symlink Folders — CRITICAL

`~/.agents/`, `~/.pi/agent/`, and `~/.claude/skills/` are symlinks to git repos.
**You must edit directly** through the `~/.` paths. 
**Before you commit**, you must first resolve the symlink:

```bash
cd $(dirname "$(readlink ~/.agents/skills)") && /git-commits-push       # dotagents
cd $(dirname "$(readlink ~/.pi/agent/AGENTS.md)") && /git-commits-push  # dotpi
cd $(readlink ~/.claude/skills)/.. && /git-commits-push                 # dotclaude
```

---

## Folder Structure

```
~/.agents/
├── AGENTS.md                 ← You are here.
├── operational-implementation-rules.md ← How you must implement code
├── docs/                     ← Documentation for agent enforcers
│   ├── CONTEXT.md            ← Index of all enforcers
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
├── agent-enforcers/          ← scripts for security and validation rules
│   ├── command-validator/
│   ├── commit-msg-validator/
│   ├── git-commits-push-enforcer/
│   ├── path-guard/
│   ├── post-write-linter/
│   ├── secret-scanner/
│   └── shared/
└── skills/                   ← Your auto-discovered capabilities (listed in your system prompt)
```

---

## Quick Navigation

| Want to... | Go here |
|-----------------------------------------------------|----------------------------------------------|
| Know how you must implement code                    | `operational-implementation-rules.md`        |
| Know about the way you verify bash commands         | `docs/command-validator/CONTEXT.md`          |
| Know about the way you validate commit messages     | `docs/commit-msg-validator/CONTEXT.md`       |
| Know about how you enforce git commit and push      | `docs/git-commits-push-enforcer/CONTEXT.md`  |
| Know how to operate in symlink folders              | `docs/path-guard/CONTEXT.md`                 |
| Know how you prevents yourself from leaking secrets | `docs/secret-scanner/CONTEXT.md`             |
| See all agent enforcers                             | `docs/CONTEXT.md`                            |

---

## Skills

To document a new agent-enforcer script (security rule, validator, or linter),
you must invoke your `/document-agent-enforcement` skill. It will walk you through creating the
`CONTEXT.md`, updating the router, and keeping every index in sync.

## Writing Rules

- You must write all output in English.
- You must format tables so separator dashes match header column widths exactly.
- You must produce no markdown lint violations.
- **Prevent Data Leaks:** You must always use generic placeholders (e.g., `<project>`, `<api_key>`) in documentation and tracked files. You must keep real project names, configurations, and secrets strictly in `.gitignored` files.

