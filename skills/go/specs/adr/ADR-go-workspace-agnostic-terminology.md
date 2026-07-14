---
id: ADR-GO-WORKSPACE-AGNOSTIC-TERMINOLOGY
type: ard
version: "1.1.0"
scope: go-workflow/workspace
status: active
supersedes: []
superseded_by: []
---

# ADR — Terminologie agnostique du workspace

VegaCorp - July 2026

---

## Contexte

L'ADR [ADR-go-physical-worktree-isolation.md](./ADR-go-physical-worktree-isolation.md)
établit que chaque run `/go` doit utiliser un worktree Git physique privé pour
isoler le filesystem entre sessions concurrentes. La stratégie actuelle de
`workspace-setup` est basée sur `git worktree add` et les invariants associés
(`git worktree remove`, `git worktree prune`, `realpath` obligatoire).

Cette stratégie résout le problème de concurrence. Elle ne résout pas le
problème de confinement : un agent dans `/go` peut écrire hors de son worktree,
lire des fichiers sensibles du host, modifier la configuration globale, ou
laisser des processus persistants après la session.

Une stratégie alternative — clone intégral dans un conteneur ou une VM
éphémère (sandbox) — offrirait une isolation complète (filesystem, réseau,
processus) tout en préservant la concurrence multi-run. Elle pourrait remplacer
la stratégie worktree sans modifier le reste du workflow.

Le vocabulaire actuel des specs, des types et des invariants est couplé au
mécanisme worktree :

- `worktreeRoot`, `worktreeProjectRoot`, `worktreeRootReservedPath`
  apparaissent dans les contrats (`WorkSession`, `RunInitRecord`,
  `RunInitOwnershipMarker`) ;
- `worktreeRoot` est référencé dans `ProjectDiscovery`, `WorkflowPolicy`,
  `RepositoryContext`, et `DirtyStateAdoption` ;
- les invariants de `workspace-setup` mélangent contrat commun et mécanisme
  `git worktree add`.

Ce couplage rend la swapabilité difficile : un futur implémenteur sandbox
devrait soit contourner les noms existants (confusion), soit casser la
rétrocompatibilité (risque).

Pourtant, le reste du workflow — stages métier, stage harness, gates
mécaniques — est déjà agnostique. Le contrat `StageInput { workDir }` ne
présuppose rien sur l'origine du répertoire de travail. Le découplage
architectural existe déjà dans le code. Il ne manque que le vocabulaire.

---

## Décision

### 1. Renommer les concepts mécanisme-spécifiques en concepts agnostiques

Les champs et identifiants qui nomment le mécanisme de création du workspace
sont renommés :

| Ancien nom (worktree) | Nouveau nom (workspace) | Portée |
|---|---|---|
| `worktreeRoot` | `workspaceRoot` | `WorkSession` |
| `worktreeProjectRoot` | `workspaceProjectRoot` | `WorkSession`, `RepositoryContext` |
| `worktreeRootReservedPath` | `workspaceRootReservedPath` | `RunInitRecord`, `RunInitOwnershipMarker` |
| `finalizedAgainstWorktreeRoot` | `finalizedAgainstWorkspaceRoot` | `ProjectDiscovery` |
| `"worktree-rerun"` | `"workspace-rerun"` | `ProjectDiscovery.source` |
| `adoptionRequiresWorktreeReplay` | `adoptionRequiresWorkspaceReplay` | `WorkflowPolicy` |
| `allowWorktreeRerun` | `allowWorkspaceRerun` | `WorkflowPolicy` |
| `requireCleanWorktreeForPackaging` | `requireCleanWorkspaceForPackaging` | `WorkflowPolicy` |
| `replayedIntoWorktree` | `replayedIntoWorkspace` | `DirtyStateAdoption` |
| `worktreeStatusAfterReplayRef` | `workspaceStatusAfterReplayRef` | `DirtyStateAdoption` |

### 2. Rendre `sourceRepo` optionnel

Dans `WorkSession`, `sourceRepo` est le chemin du dépôt source utilisé pour la
capture du dirty state. En mode worktree, il est obligatoire (le dépôt source
est sur le même filesystem). En mode sandbox, il est absent (la sandbox n'a pas
accès au dépôt source du host).

`sourceRepo` passe de `string` à `string?` (optionnel).

### 3. Préserver la rétrocompatibilité par aliasing

Les anciens noms sont conservés comme champs dépréciés optionnels. Un
producteur écrit le nouveau nom. Un consommateur lit le nouveau nom avec
fallback sur l'ancien.

Cette règle permet à un `workspace-setup` worktree et à un futur
`workspace-setup` sandbox d'être interchangeables sans casser les
consommateurs existants.

### 4. Ne pas renommer les concepts Git standard

`trackedWorktreeHash`, `worktreeClean`, et les autres termes utilisant
« worktree » au sens Git canonique (« working tree » = le répertoire de
travail) ne sont pas renommés. Ces termes sont indépendants de `git worktree
add` et s'appliquent à tout checkout Git (worktree, clone, ou autre). Les
renommer créerait de la confusion avec la terminologie Git officielle sans
apporter de valeur.

### 5. Séparer physiquement le contrat de la stratégie dans `workspace-setup`

Le spec `workspace-setup.md` est restructuré en deux fichiers :

- le **contrat commun** ([`workspace-setup.md`](../working/run-init/workspace-setup.md)) :
  inputs, outputs, invariants agnostiques (6.1-6.7), référence vers la
  stratégie ;
- la **stratégie Git Worktree**
  ([`workspace-setup.worktree.md`](../working/run-init/workspace-setup.worktree.md)) :
  pipeline `git worktree add/remove/prune`, invariants `realpath` (6.8),
  cleanup au retry (6.9.cleanup), opérations internes, failure modes
  worktree-spécifiques.

Cette séparation rend explicite ce qui doit être remplacé par une future
stratégie sandbox et ce qui est commun aux deux. Une stratégie sandbox
(`workspace-setup.sandbox.md`) pourra être créée en implémentant le même
contrat sans ambiguïté.

### 6. Extraire la capture du dirty state en bootstrap task autonome

La capture du dirty state est extraite de `workspace-setup` pour devenir une
bootstrap task indépendante :

- **[`dirty-state-capture`](../working/run-init/dirty-state-capture.md)** :
  s'exécute séquentiellement après `repo-capture`, en amont du bloc
  parallèle. Host-side uniquement. Produit un `DirtyStateCaptureArtifact`
  projeté dans `RunInitRecord.dirtyStateCapture`.
- **`workspace-setup`** ne capture plus le dirty state. Il consomme le
  `DirtyStateCaptureArtifact` et rejoue le patch dans le workspace.

Ce split est nécessaire pour la stratégie sandbox : la capture doit avoir
lieu sur l'host avant l'entrée dans la sandbox, puis le replay dans la
sandbox. Sans cette séparation, la capture serait impossible en mode
sandbox (pas d'accès au dépôt source host).

Le type `DirtyStateAdoption` est simplifié : il référence le
`DirtyStateCaptureArtifact` via `captureArtifactId` au lieu de dupliquer
les champs de provenance (`sourceStatusPorcelainRef`, `sourcePatchRef`,
`sourcePatchHash`).

### 7. Annoter la terminologie conceptuelle

Les fichiers qui utilisent « worktree » au sens conceptuel de « répertoire de
travail isolé » (et non au sens du mécanisme `git worktree add`) reçoivent un
callout de clarification en tête de fichier :

- `canonical-vocabulary.md`
- `software-design-workflow.md`
- `multi-agent-concurrency.md`

---

## Conséquences

### Positives

- Le vocabulaire des contrats (`WorkSession`, `WorkflowPolicy`,
  `ProjectDiscovery`) ne présuppose plus le mécanisme de création du workspace.
- Une future stratégie sandbox peut être introduite sans casser les types
  existants.
- La rétrocompatibilité est préservée : les champs dépréciés restent
  consommables.
- Le stage harness et tous les stages downstream ne changent pas (ils ne
  connaissaient déjà pas le mécanisme).
- Zéro changement de code TypeScript (le harness valide `StageInput`, pas
  `WorkSession`).
- Les invariants communs (7 sur 9) sont explicitement identifiés, réduisant le
  travail de spécification pour la stratégie sandbox.

### Coûts

- Dette de nommage transitoire : les anciens noms cohabitent avec les nouveaux
  jusqu'à migration complète.
- 7 fichiers de spec modifiés, 2 créés (`workspace-setup.worktree.md`,
  `dirty-state-capture.md`), 3 annotés.
- Le graphe d'exécution de `run-init` est modifié : `dirty-state-capture`
  s'intercale séquentiellement entre `repo-capture` et le bloc parallèle.
- Le type `DirtyStateAdoption` est simplifié (référence au
  `DirtyStateCaptureArtifact` plutôt que champs dupliqués).
- Les implémentations runtime qui lisent `WorkSession` directement (hors stage
  harness) doivent gérer le fallback ancien → nouveau nom.

### Non-goals

- Ce changement ne spécifie pas la stratégie sandbox. Il prépare uniquement le
  terrain pour qu'elle soit possible.
- Il ne modifie pas le comportement runtime de `workspace-setup`.
- Il ne renomme pas `trackedWorktreeHash` ni aucun terme Git standard.

---

## Alternatives rejetées

### Ne rien changer

Rejeté. Le couplage terminologique force un futur implémenteur sandbox à
contourner des noms trompeurs ou à casser la rétrocompatibilité. Le coût du
renommage maintenant (spéculatif) est faible ; le coût du renommage plus tard
(avec du code en production) est élevé.

### Renommer aussi `trackedWorktreeHash` et `worktreeClean`

Rejeté. Ces termes utilisent « worktree » au sens Git standard (« working
tree »), pas au sens du mécanisme `git worktree add`. Les renommer créerait une
dissonance avec la documentation Git officielle et le code existant du stage
harness sans faciliter la swapabilité (ils sont déjà agnostiques).

### Supprimer les anciens noms sans période de transition

Rejeté. Casserait la rétrocompatibilité pour les consommateurs existants sans
bénéfice proportionné. L'aliasing permet une migration progressive.

### Faire un ADR par champ renommé

Rejeté. Les 10 renommages partagent la même motivation (swapabilité sandbox),
le même périmètre (specs, pas code), et les mêmes règles de rétrocompatibilité.
Un ADR unique évite 10 documents quasi-identiques.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
