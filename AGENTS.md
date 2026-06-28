# Shared Agent Conventions

Conventions partagées entre tous les harnesses (Pi, Claude Code, Codex).

## Symlink Structure — CRITICAL

Every `~/.` path below is a symlink to a git-tracked `dot*` repo:

| Path | Résout vers |
|------|-------------|
| `~/.pi/agent/` (files individuels) | `~/Developper/Projects/dotpi/` |
| `~/.agents/` (files individuels) | `~/Developper/Projects/dotagents/` |
| `~/.claude/skills/` | `~/Developper/Projects/dotclaude/skills/` |

**Règle absolue :**
- Toujours écrire via `~/.` (ex: `~/.agents/skills/mon-skill/`)
- Ne **jamais** écrire directement dans `dot*`
- Les symlinks écrivent automatiquement dans le repo git correspondant

**Pour commiter :**

```bash
cd $(dirname "$(readlink ~/.agents/skills)") && /git-commits-push    # dotagents
cd $(dirname "$(readlink ~/.pi/agent/AGENTS.md)") && /git-commits-push  # dotpi
cd $(readlink ~/.claude/skills)/.. && /git-commits-push                 # dotclaude
```

## Skills

Les skills sont dans `~/.agents/skills/`. Pour créer ou modifier un skill, toujours
utiliser le skill [`skill-creator`](skills/skill-creator/SKILL.md) (`/skill:skill-creator`).
