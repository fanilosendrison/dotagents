---
id: ADR-GO-PHYSICAL-WORKTREE-ISOLATION
type: ard
version: "1.0.0"
scope: go-workflow/workspace
status: active
supersedes: []
superseded_by: []
---

# ARD - Worktree physique par run `/go`

VegaCorp - July 2026

---

## Contexte

Le stage harness calcule l'état canonique du repository après un stage :

- `headShaAfter`
- `trackedWorktreeHash`
- `worktreeClean`

Ces valeurs supposent que le `workDir` n'est pas modifié par un autre acteur
pendant l'exécution du stage.

Une branche Git seule n'isole pas le filesystem. Deux runs sur le même checkout
partagent les fichiers non suivis, les fichiers ignorés, l'index, les artefacts
de build, les watchers et les mutations d'éditeur.

---

## Décision

Chaque run `/go` cible doit utiliser un worktree Git physique privé associé à
`work/<run-id>`.

Le checkout source ne doit pas être utilisé comme `workDir` d'implémentation.

Les artefacts du run doivent être hors du worktree.

---

## Conséquences

- Plusieurs runs `/go` peuvent travailler en parallèle.
- Les hashes du stage harness deviennent interprétables.
- Les dirty states ne sont pas partagés entre sessions.
- Le cleanup doit gérer les worktrees physiques.
- `workspace-setup` devient un stage obligatoire avant toute implémentation.

---

## Alternatives rejetées

### Branche seule dans le checkout courant

Rejetée pour la cible du workflow : elle n'isole pas le filesystem.

Acceptable seulement pour une expérimentation mono-session non concurrente, pas
pour le contrat canonique.

### Copier le repository sans Git worktree

Rejeté : plus coûteux, moins fidèle aux opérations Git, et plus difficile à
réconcilier avec les branches PR.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
