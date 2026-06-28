# dotagents

Ce repo contient la configuration partagée entre tous les harnesses d'agent
(Pi, Claude Code, Codex). Il est symlinké vers `~/.agents/`.

## Structure

```
dotagents/
├── skills/          ← Skills partagés (tous harnesses)
├── agent-hooks/     ← Hooks agent (validateurs, linters, etc.)
├── AGENTS.md        ← Ce fichier
└── .gitignore
```

## Skills

Les skills dans `skills/` sont disponibles pour :
- **Pi** : découverte native de `~/.agents/skills/`
- **Claude Code** : via symlink `~/.claude/skills → ~/.agents/skills/`
- **Codex** : via symlink `~/.codex/skills → ~/.agents/skills/`

### Ajouter un skill

Créer un dossier dans `skills/` avec un `SKILL.md` (format Agent Skills standard) :

```
skills/mon-skill/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```
