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

---

## Operational Implementation Rules

**You must never implement** without explaining first. Before ANY implementation task:

1. **Summarize your strategy**: explain which files you will create/modify and why.
2. **Justify your choices**: explain why you chose this approach rather than another.
3. **Report risks**: point out what could break and the affected dependencies.
4. **Wait for validation**: do not write any code until your strategy is approved.

- If I say "vas-y", "go", or explicitly validate = you have the green light.
- For a trivial task (< 10 lines, typo fix) = a short explanation from you is enough.

**Before any non-trivial implementation** → You must use the `strategy-evaluator` (you will get a GO / GAP / REJECT opinion, do not code until you get a GO).

**Todo list for complex tasks**: For a non-trivial task (multi-step, multi-file, plan) → you must invoke `TaskCreate`. Update your status as you progress.

**No Homebrew**: The system is macOS Monterey 12.7.6 → Homebrew is no longer supported. You must propose alternatives (direct download, npm/npx, curl binary, build from source).

**No Docker**: The system is macOS Monterey 12.7.6 → Docker Desktop is no longer supported. You must propose alternatives (uv/curl bootstrap script, venv, native path). You must never recommend `containerization: DOCKER`.

**Agent enforcers, no hook manager**: Lint, format, and commit validation are handled by your agent-enforcers. You must never install Husky, lint-staged, pre-commit, lefthook, etc. If an existing project contains one, do not touch it, but do not add any.

**For any version number** (package.json, frontmatter, tags, changelogs) → you must invoke your `semver-convention` skill. Use SemVer 2.0.0, and start at `0.1.0` for WIP.

## Trade-offs

1. You must choose the approach that best respects the **fundamental properties of the project** (refer to the project's CLAUDE.md).
2. All else being equal → **you must choose the simplest approach**.
3. If you are in real doubt → you must present both options to me with their trade-offs.

## What You Must NEVER Do

- You must never ignore a failing test — fix it or report it.
- You must never use weak generic types (`any`, `Object`, `interface{}`, `dynamic`) without commenting your justification.
- You must never put business logic in the infrastructure layer — your logic belongs in `domain/`.
- You must never create files whose names no longer accurately describe their content — split them.
- You must never invent behavior not specified in the specs — ask me first.
- You must never delete or modify compliance tests without explicit validation.
- You must never use `print`/`console.log`/`println` for debugging — use the project's logging system.
- You must never leave dead code, commented code, or obsolete comments — delete them.
- You must never make things configurable if they come from the specs — hardcoded values are intentional.
- You must never hardcode environment-dependent things — addresses, ports, keys, paths → use env vars or config.
- You must never put a secret in the code or in a versioned file.

## What You MUST Always Do

- You must name things explicitly: if a name is too long, so be it.
- You must prefer readable code over clever code. If a trick is necessary, comment why you used it.
- You must report inconsistencies you find (between specs, between specs and existing code).
- You must propose improvements when you see a problem, even if I did not ask.
