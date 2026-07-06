---
name: antigravity-context
description: >-
  Charge les directives et l'architecture du harnais Antigravity
  (~/.gravity/ / dotgravity). Utilise UNIQUEMENT quand la requête
  mentionne explicitement Antigravity, ~/.gravity/, .gravity ou
  dotgravity (le repo).
  Déclencheurs valides : l'utilisateur cite Antigravity par son nom,
  cite ~/.gravity/, .gravity ou dotgravity, signale une redirection
  path-guard spécifiquement vers ~/.gravity/, demande de modifier le
  harnais Antigravity, invoque un skill lié au harnais
  (ex: /document-wrapper), ou travaille sur des extensions/docs sous
  ~/.gravity/.
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
| "modifie le harnais **Antigravity**" / "ajoute une extension **dans .gravity**" | Charger le fichier puis suivre les conventions du harnais |
| invoque `/document-wrapper` ou un autre skill lié au harnais | Charger le fichier pour accéder à la config du harnais |
| travaille sur des extensions/docs sous **".gravity/"** / **"~/.gravity/"** | Charger le fichier pour naviguer vers les specs et la doc |
