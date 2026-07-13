---
id: ADR-GO-IMPLICIT-LAUNCH-CONTEXT-CONTROL
type: ard
version: "1.0.0"
scope: go-workflow/launch-context
status: active
supersedes: []
superseded_by: []
---

# ARD - Contrôle implicite du Launch Context par l'environnement du terminal

VegaCorp - July 2026

---

## Contexte

Le démarrage d'un run `/go` nécessite de résoudre le `RepositoryLaunchContext`, c'est-à-dire déterminer sur quel dépôt Git l'agent doit s'ancrer, et à partir de quelle branche il doit créer son worktree de travail.

Historiquement, la spécification tentait de mélanger plusieurs heuristiques :
- Déduire le repo cible via les fichiers ouverts dans l'IDE (`activePathRefs`) en priorité sur le répertoire courant.
- Permettre à l'utilisateur de fournir des hints explicites pour forcer un repo.
- Introduire un `baseBranchHint` artificiel pour séparer la branche de départ de la branche de fusion (PR cible).

Cette approche créait de la friction, de l'ambiguïté (magie de l'IDE), et complexifiait le contrat parent/agent sans réelle valeur ajoutée par rapport aux primitives Git standards.

---

## Décision

Le `RepositoryLaunchContext` est désormais résolu de manière strictement implicite et déterministe via l'état du terminal au moment de l'invocation, selon la philosophie : **"là où tu es, là où tu bosses"**.

1. **Le dépôt cible (canonicalRepositoryRoot)** est l'unique dépôt Git trouvé en remontant depuis le `invocationDirectory` (CWD). Les fichiers ouverts dans l'IDE (`activePathRefs`) ne peuvent plus court-circuiter cette règle.
2. **La branche de départ (defaultTargetBranchHint)** est strictement déduite du pointeur `HEAD` courant du checkout source. L'utilisateur contrôle son point de départ en effectuant simplement un `git checkout` avant d'invoquer `/go`.
3. **La cible de Pull Request** (ex: `main` ou `master`) n'est plus devinée par le parent process. C'est une propriété intrinsèque du dépôt que la startup task `workspace-setup` découvrira elle-même en inspectant le remote.

---

## Conséquences

- **Prédictibilité absolue** : Le comportement est transparent pour l'utilisateur. Le terminal a toujours raison. Il n'y a plus de comportement "magique" de l'IDE qui déplace le focus à l'insu de l'utilisateur.
- **Simplicité du contrat** : Le schéma JSON du `RepositoryLaunchContext` perd des champs redondants (`baseBranchHint`).
- **Contrôle sans friction** : L'utilisateur n'a pas besoin d'apprendre des arguments spécifiques au workflow `/go` pour spécifier une branche de départ. L'outil respecte son flux de travail Git naturel.

---

## Alternatives rejetées

### Priorité au contexte actif de l'IDE
Rejetée. Si le terminal est à la racine d'un workspace, mais que le curseur est dans un fichier d'un submodule, ancrer automatiquement le run sur le submodule contredisait l'intention explicite du shell courant.

### Séparation de `baseBranchHint` et `defaultTargetBranchHint`
Rejetée. Ajouter un champ explicite pour la branche de départ était une sur-ingénierie. `defaultTargetBranchHint` retrouve sa sémantique originelle (le point de départ du worktree basé sur le `HEAD`), et la détection de la branche de fusion est reléguée au moteur d'analyse Git interne.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
