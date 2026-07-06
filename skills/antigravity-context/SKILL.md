---
name: antigravity-context
description: >-
  Charges les directives et l'architecture du harnais Antigravity (~/.gravity/).
  Utilise ce skill quand l'utilisateur : (1) interroge sur le rejet/blocage d'un commit,
  (2) demande comment fonctionnent les git hooks, wrappers ou enforcers,
  (3) signale un faux positif au secret-scanner,
  (4) veut modifier/ajouter un hook, wrapper ou enforcer,
  (5) interroge sur une redirection path-guard vers ~/.gravity/,
  (6) veut comprendre l'architecture Antigravity,
  (7) veut commiter des changements dans dotgravity.
---

# Antigravity Context

Charge le fichier d'entrée du harnais pour comprendre son architecture, ses règles et localiser ses composants.

```bash
read /Users/famillesendrison/.gravity/CONTEXT.md
```

Une fois chargé, suis les directives du fichier (règles d'écriture, navigation vers docs/wrappers/specs/tests).

## Cas d'usage principaux

| Situation | Action |
|---|---|
| Commit rejeté/bloqué | Identifier l'enforcer responsable via l'architecture hooks → wrappers → enforcers |
| Modifier un hook | Suivre la navigation vers `git-hooks/` puis le wrapper correspondant |
| Modifier un wrapper | Navigation vers `wrappers/<name>/` |
| Comprendre le path-guard | Appliquer la règle : écrire via `~/.gravity/`, jamais dans `dotgravity/` |
| Commiter dotgravity | Utiliser la commande de commit indiquée dans le fichier |
