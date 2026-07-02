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
├── agent-credentials.json    ← Global API keys registry (gitignored)
├── agent-credentials.json.template ← Template for API keys
├── operational-rules/        ← Core rules and architecture standards
│   ├── implementation.md     ← How you must implement code
│   └── managing-api-keys.md  ← How you manage API keys
├── conventions/              ← Passive conventions
│   └── semver.md             ← Shows you how to number versions
├── docs/                     ← Documentation for agent enforcers
│   ├── command-validator.md         ← Forces you to verify bash commands
│   ├── commit-msg-validator.md      ← Forces you to validate commit messages
│   ├── CONTEXT.md                   ← Index of all enforcers
│   ├── git-commits-push-enforcer.md ← Forces you to push after you commit
│   ├── path-guard.md                ← Shows you how to operate in symlink folders
│   ├── post-write-linter.md         ← Forces you to lint the code you write
│   └── secret-scanner.md            ← Prevents you to leak secrets
├── agent-enforcers/          ← scripts for security and validation rules
│   ├── command-validator/
│   ├── commit-msg-validator/
│   ├── git-commits-push-enforcer/
│   ├── path-guard/
│   ├── post-write-linter/
│   ├── secret-scanner/
│   └── shared/
├── specs/                    ← Future specs and workflow drafts
└── skills/                   ← Your auto-discovered capabilities (listed in your system prompt)
```


---


## Quick Navigation

| Want to...                                          | Go here first                                |
|-----------------------------------------------------|----------------------------------------------|
| Implement a feature?                                | `operational-rules/implementation.md`        |
| Know how you manage API keys                        | `operational-rules/managing-api-keys.md`     |
| Know how to number versions                         | `conventions/semver.md`                      |
| Know about the way you verify bash commands         | `docs/command-validator.md`                  |
| Know about the way you validate commit messages     | `docs/commit-msg-validator.md`               |
| Know about how you enforce git commit and push      | `docs/git-commits-push-enforcer.md`          |
| Know how to operate in symlink folders              | `docs/path-guard.md`                         |
| Know about the way you lint the code you write      | `docs/post-write-linter.md`                  |
| Know how you prevents yourself from leaking secrets | `docs/secret-scanner.md`                     |
| See all agent enforcers                             | `docs/CONTEXT.md`                            |


---


## Skills

To document a new agent-enforcer script (security rule, validator, or linter),
you must invoke your `/document-agent-enforcement` skill. It will walk you through creating the
`CONTEXT.md`, updating the router, and keeping every index in sync.


---


## Writing Rules

- You must write all output in English.
- You must format tables so separator dashes match header column widths exactly.
- You must produce no markdown lint violations.


