# Your Directives

This file is your map to `~/.agents/` — your core brain and governance center. You are bound by these absolute directives.

## General Guidelines
- When making technical decisions, do not give much weight to development cost. Instead, prefer quality, simplicity, robustness, scalability, and long term mainainability.
- When doing bug fixes, always start with reproducing the bug in an E2E setting as closely aligned with how an end use. This makes sure you find the real problem so your fix will actually solve it.
- Apply high standard to engineering excellence. If you see a test failure or test flakiness, even if it is not caused by what you are working on right now, still get it fixed.


---


## Your 3 Gateway Folders — CRITICAL

`~/.agents/`, `~/.pi/agent/`, and `~/.claude/skills/` act as symlink gateways to their respective git repos.
While `~/.claude/skills/` is a direct symlink, `~/.agents/` and `~/.pi/agent/` are physical folders that *contain* symlinks to the repos.

> ⚠️ **PATH-GUARD WARNING**: You must **NEVER** write directly to the physical git repos (`~/Developper/Projects/dot*`). If you attempt to write there, the `path-guard` enforcer will intentionally intercept your action. Your command will be either **strictly blocked** or **silently redirected** to the `~/.` gateways. **This is normal and expected behavior.** Do not try to bypass or hack around this restriction; simply follow the rules and use the `~/.` gateways.

**You must edit directly** through these `~/.` paths. 
**Before you commit**, you must resolve a symlink to reach the physical git repo:

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
├── agent-enforcers/          ← Core logic of your enforcers
│   ├── command-validator/
│   ├── commit-msg-validator/
│   ├── git-commits-push-enforcer/
│   ├── path-guard/
│   ├── post-write-linter/
│   ├── secret-scanner/
│   └── shared/               ← Hook protocol helpers (stdin JSON parsing, allow/deny responses)
├── specs/                    ← Future specs and workflow drafts
├── archived/                 ← Old skills and retired experiments
└── skills/                   ← Your auto-discovered capabilities (listed in your system prompt)
    ├── antigravity-harness-context/   
    ├── create-symlink-for-dot-folders/
    ├── document-agent-enforcement/
    ├── document-self-modif/
    ├── document-wrapper/
    ├── git-commits-push/
    ├── pi-harness-context/           
    └── skill-creator/
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
| See all agent enforcers                             | `docs/CONTEXT.md`                                     |


---


## Transversal Skills

| Want to...                                          | Use this skill                    |
|-----------------------------------------------------|-----------------------------------|
| Safely create symlinks for dot-folders              | `/create-symlink-for-dot-folders` |
| Document an agent-enforcer script                   | `/document-agent-enforcement`     |
| Document a modification to the Pi harness           | `/document-self-modif`            |
| Know about Antigravity harness context              | `/antigravity-harness-context`    |
| Know about Pi harness context                       | `/pi-harness-context`             |
| Document a wrapper (Antigravity)                    | `/document-wrapper`               |
| Commit changes                                      | `/git-commits-push`               |
| Create or update a new skill                        | `/skill-creator`                  |


---


## Writing Rules

- You must write all output in English.
- You must format tables so separator dashes match header column widths exactly.
- You must produce no markdown lint violations.


