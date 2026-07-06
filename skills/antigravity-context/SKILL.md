---
name: antigravity-context
description: >-
  Charge les directives et l'architecture du harnais Antigravity
  (~/.gravity/ / dotgravity). Utilise UNIQUEMENT quand la requête
  mentionne explicitement Antigravity, ~/.gravity/, .gravity ou
  dotgravity (le repo). Ne pas utiliser pour des problèmes génériques
  de hooks/wrappers/enforcers/commits qui pourraient concerner un
  autre harnais (dotagents, dotpi, etc.).
  Déclencheurs valides : l'utilisateur cite Antigravity par son nom,
  cite ~/.gravity/, .gravity ou dotgravity, ou signale une redirection
  path-guard spécifiquement vers ~/.gravity/.
---

# Antigravity Context

Charge le fichier d'entrée du harnais pour comprendre son architecture, ses règles et localiser ses composants.

```bash
read /Users/famillesendrison/.gravity/CONTEXT.md
```

Une fois chargé, suis les directives du fichier (règles d'écriture, navigation vers docs/wrappers/specs/tests).

## Cas d'usage (Antigravity uniquement)

| Quand l'utilisateur dit... | Alors... |
|---|---|
| "mon commit est rejeté **dans dotgravity**" / "**Antigravity** a bloqué mon commit" | Identifier l'enforcer via l'architecture hooks → wrappers → enforcers |
| "ajoute un hook **dans .gravity**" / "modifie le wrapper X **d'Antigravity**" | Suivre la navigation vers `git-hooks/` ou `wrappers/<name>/` |
| "le path-guard redirige vers **~/.gravity/**" | Appliquer la règle : écrire via `~/.gravity/`, jamais dans `dotgravity/` |
| "commite **dotgravity**" | Utiliser la commande de commit indiquée dans le fichier |
| "explique l'architecture **Antigravity**" | Charger le fichier et naviguer vers les docs/specs indiqués |
