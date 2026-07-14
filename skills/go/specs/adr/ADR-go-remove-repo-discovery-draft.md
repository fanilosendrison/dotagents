---
id: ADR-GO-REMOVE-REPO-DISCOVERY-DRAFT
type: ard
version: "1.0.0"
scope: go-workflow/run-init
status: active
supersedes:
  - ADR-GO-RUN-INIT-EARLY-PARALLEL-BRANCHES
superseded_by: []
---

# ADR — Suppression de `repo-discovery-draft`

VegaCorp - July 2026

---

## Contexte

L'ADR [ADR-go-run-init-early-parallel-branches](./ADR-go-run-init-early-parallel-branches.md)
a optimisé le graphe de `run-init` en faisant démarrer `repo-discovery-draft`
immédiatement après `repo-capture`, en parallèle de `dirty-state-capture`.
Cette correction a mis en lumière un problème plus profond : la tâche
elle-même n'a pas de raison d'être.

`repo-discovery-draft` scanne le dépôt source en lecture seule pour produire
un `RepositoryDiscoveryDraft` — un artefact explicitement **non-autoritatif**
qui liste les commandes candidates, le package manager détecté, et les
lockfiles. Ce brouillon est ensuite validé par `project-discovery-finalize`,
qui compare les hashes des fichiers du draft avec ceux du worktree privé.

**Le problème :** le draft n'accélère rien. Scanner 3-5 fichiers de
configuration (`package.json`, `Cargo.toml`, `go.mod`, lockfiles) prend
quelques millisecondes. Le faire en parallèle de `workspace-setup` (qui dure
plusieurs secondes) n'apporte aucun gain mesurable. Pire : `project-discovery-finalize`
doit de toute façon re-scanner les mêmes fichiers dans le worktree pour
valider les hashes. Si les hashes diffèrent (cas rare mais possible), le
draft est jeté et la discovery est relancée depuis zéro.

La tâche ajoute donc :
- un artefact métier (`RepositoryDiscoveryDraft`)
- une logique de comparaison de hashes dans `project-discovery-finalize`
- un mode `"draft-finalized"` vs `"workspace-rerun"` dans `ProjectDiscovery`
- un join explicite entre `workspace-setup` et `repo-discovery-draft`
- un point de défaillance supplémentaire (draft incohérent)

Sans aucun bénéfice de performance mesurable.

---

## Décision

### 1. Supprimer `repo-discovery-draft`

La tâche `repo-discovery-draft` est supprimée. La discovery est effectuée
directement par `project-discovery-finalize` depuis le worktree privé, sans
étape de brouillon intermédiaire.

### 2. Simplifier `project-discovery-finalize`

La tâche n'est plus un join. C'est une tâche séquentielle simple qui :
1. Attend `workspace-setup` (dont elle reçoit `WorkSession` + `workspaceRoot`)
2. Scanne directement les fichiers de configuration du worktree
3. Détecte le package manager, les lockfiles, les commandes candidates
4. Filtre selon `WorkflowPolicy.gates`
5. Produit `ProjectDiscovery`

### 3. Simplifier le type `ProjectDiscovery`

Les champs liés au cycle de vie du draft sont supprimés :
- `source: "draft-finalized" | "workspace-rerun"` → supprimé
- `finalizedFromDraftId` → supprimé

### 4. Nouveau graphe

```
            repo-capture
          ┌──────┴──────┐
          ▼             ▼
     run-capture    dirty-state
          │             │
          │             ▼
          │        workspace-setup
          │             │
          │             ▼
          │   project-discovery-finalize
          │             │
          └──────┬──────┘
                 ▼
        delegate implementation
```

Deux branches depuis `repo-capture`. `project-discovery-finalize` n'est
plus un join — c'est une étape séquentielle après `workspace-setup`.

---

## Conséquences

### Positives

- **Moins de complexité** : 1 tâche, 1 artefact métier, 1 join supprimés.
- **Pipeline plus simple** : `project-discovery-finalize` scanne directement
  le worktree, pas de logique de comparaison de hashes.
- **Type simplifié** : `ProjectDiscovery` n'a plus de champ `source`.
- **Policy simplifiée** : `WorkflowPolicy.discovery.allowWorkspaceRerun` n'a
  plus de sens (il n'y a qu'un seul chemin de discovery).
- **Graphe plus lisible** : 2 branches au lieu de 3.

### Coûts

- 1 fichier supprimé (`repo-discovery-draft.md`)
- 4 fichiers modifiés en profondeur (`run-init.md`,
  `project-discovery-finalize.md`, `run-capture.md`,
  `canonical-vocabulary.md`)
- Références résiduelles dans les fichiers legacy (non modifiés par cet ADR)
- L'ADR `ADR-go-run-init-early-parallel-branches` est partiellement
  superseded (son optimisation de parallélisme pour `repo-discovery-draft`
  n'a plus d'objet)

### Non-goals

- Ce changement ne modifie pas le comportement de `workspace-setup` ou
  `run-capture`.
- Il ne change pas le stage harness ni les stages aval.
- Il ne nettoie pas les références dans les fichiers legacy.

---

## Alternatives rejetées

### Garder `repo-discovery-draft` comme cache

Rejeté. Un cache pour 3 fichiers de config n'a pas de sens. Le coût de
maintien (draft, comparaison, rerun, deux modes dans `ProjectDiscovery`)
dépasse largement le gain.

### Fusionner `repo-discovery-draft` dans `project-discovery-finalize`

Rejeté car c'est exactement ce que fait cette décision, mais en supprimant
le concept de draft plutôt qu'en le cachant dans une autre tâche.

### Garder le draft pour les monorepos

Rejeté. Même dans un monorepo avec 50 `package.json`, le scan prend moins
d'une seconde. Le parallélisme avec `workspace-setup` n'apporte rien car
`workspace-setup` domine le chemin critique.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
