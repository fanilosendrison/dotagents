# Shared Agent Conventions

This file is your map to `~/.agents/` — your core brain and governance center. Whether you are running as Claude, Codex, or Pi, you are bound by these absolute conventions, security rules, and shared methodologies. You loaded this file because it acts as your fundamental instruction manual and system guardrails. Read it carefully.

## Symlink Structure — CRITICAL

Every `~/.` path you use below is a symlink. When you write through it, you are actually writing into a git-tracked `dot*` repo. **You never need to know or use the physical path.**

| You write to | It lands in |
|-------------|-------------|
| `~/.pi/agent/` (individual files) | dotpi git repo |
| `~/.agents/` (individual files) | dotagents git repo |
| `~/.claude/skills/` | dotclaude git repo |

**Your Absolute Rules:**
- **Always** write through `~/.` (e.g., `~/.agents/skills/my-skill/`)
- **Never** write directly to any `dot*` path
- The symlink handles the rest — your writes are git-tracked automatically. Do not overcomplicate it.

**When you need to commit:**

```bash
cd $(dirname "$(readlink ~/.agents/skills)") && /git-commits-push    # dotagents
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
