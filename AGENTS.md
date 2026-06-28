# Shared Agent Conventions

Conventions partagées entre tous les harnesses (Pi, Claude Code, Codex).

## Skills

Les skills sont dans `~/.agents/skills/`. Pour en ajouter un, créer un dossier avec
un `SKILL.md` (format Agent Skills standard) :

```
~/.agents/skills/mon-skill/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

## Commit après modification

Toute modification dans `~/.agents/` doit être commitée :

```bash
REPO=$(dirname "$(readlink ~/.agents/skills)")
cd "$REPO" && /git-commits-push
```
