# Shared Agent Conventions

This file is your map to `~/.agents/` — your core brain and governance center. You are bound by these absolute conventions.

## How to Edit and Commit (Symlink Rules) — CRITICAL

You must know that **these 3 specific folders are symlinks** pointing to git-tracked repositories (`dot*` repos).

| Your Working Path (Symlink) | Underlying Git Repo |
|-----------------------------|---------------------|
| `~/.pi/agent/` | `dotpi` |
| `~/.agents/` | `dotagents` |
| `~/.claude/skills/` | `dotclaude` |

**Your Edit Rule:**
- **Always** write directly to the `~/.` path (e.g., `~/.agents/skills/my-skill/`). 
- **Never** try to resolve or write directly to the underlying `dot*` repo. The symlink handles it perfectly.

**Your Commit Rule:**
When you are done editing and need to commit your changes, you cannot run `git status` inside the symlink. You must resolve the symlink to `cd` into the actual git repository first:

```bash
# If you modified files in ~/.agents/
cd $(dirname "$(readlink ~/.agents/skills)") && /git-commits-push

# If you modified files in ~/.pi/agent/
cd $(dirname "$(readlink ~/.pi/agent/AGENTS.md)") && /git-commits-push

# If you modified files in ~/.claude/skills/
cd $(readlink ~/.claude/skills)/.. && /git-commits-push
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
