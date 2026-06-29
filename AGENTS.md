# Shared Agent Conventions

## Symlink Structure — CRITICAL

Every `~/.` path you use below is a symlink. When you write through it, you are
writing into a git-tracked `dot*` repo. You never need to know the physical path.

| You write to | It lands in |
|-------------|-------------|
| `~/.pi/agent/` (individual files) | dotpi git repo |
| `~/.agents/` (individual files) | dotagents git repo |
| `~/.claude/skills/` | dotclaude git repo |

**Absolute rule:**
- Always write through `~/.` (e.g., `~/.agents/skills/my-skill/`)
- Never write directly to any `dot*` path
- The symlink handles the rest — your writes are git-tracked automatically

**When you need to commit:**

```bash
cd $(dirname "$(readlink ~/.agents/skills)") && /git-commits-push    # dotagents
cd $(dirname "$(readlink ~/.pi/agent/AGENTS.md)") && /git-commits-push  # dotpi
cd $(readlink ~/.claude/skills)/.. && /git-commits-push                 # dotclaude
```

## Skills

Skills live in `~/.agents/skills/`. To create or modify a skill, always invoke
[`skill-creator`](skills/skill-creator/SKILL.md) (`/skill:skill-creator`). It will guide
you through the full process: design, creation, validation, and commit.

### Versioning

When you need to generate, update, or validate a version number — in `package.json`,
YAML frontmatter, pipeline configs, git tags, changelogs, or anywhere else — you
**must** load and follow [`semver-convention`](skills/semver-convention/SKILL.md)
(`/skill:semver-convention`).
