# Startup task `workspace-setup`

`workspace-setup` prépare le terrain isolé d'un run `/go`. Elle doit
s'exécuter avant toute délégation agentique qui modifie le code. Elle est
une bootstrap task interne à la phase Turnlock `run-init`, et non une phase
Turnlock séparée.

> **Contrat commun.** Ce document définit l'interface contractuelle
> (inputs, outputs, invariants agnostiques) partagée par toutes les
> stratégies de création de workspace. La stratégie actuelle est documentée
> dans [`workspace-setup.worktree.md`](./workspace-setup.worktree.md). Une
> stratégie future (clone-in-sandbox) implémentera le même contrat. Voir
> [ADR-go-workspace-agnostic-terminology.md](../../adr/ADR-go-workspace-agnostic-terminology.md).

---

## 1. Objectif

Créer un workspace Git physique privé et isolé, rejouer le dirty state
capturé par [`dirty-state-capture`](./dirty-state-capture.md) si
nécessaire, enregistrer avec précision le point de départ Git du run, et
produire l'artefact `WorkSession` durable.

Cette bootstrap task ne produit aucun code applicatif.

---

## 2. Position dans le workflow

`workspace-setup` s'exécute en parallèle avec `run-capture` et
`repo-discovery-draft` au sein de la phase Turnlock `run-init`, après
`dirty-state-capture`.

```text
run-init
│
├─ provider-config-validation (séquentiel)
│       ↓
├─ repo-capture (séquentiel)
│       ↓
├─ dirty-state-capture (séquentiel, host-side only)
│       │
│       ├─ run-capture (parallèle)
│       ├─ workspace-setup (parallèle) ──┐
│       └─ repo-discovery-draft (parallèle)
│                  │                      │
│                  └──────────┬───────────┘
│                             ↓
│                 project-discovery-finalize
```

Ses extrants sont requis comme intrants indispensables pour finaliser la
découverte de projet dans `project-discovery-finalize`.

---

## 3. Inputs

- `runId` (identifiant unique Crockford base32 ULID)
- `RepoCapture` (contexte de dépôt préalablement résolu par `run-init`)
- `DirtyStateCaptureArtifact` (produit par `dirty-state-capture`)
- `artefactRoot` (répertoire réservé aux preuves)
- `workspaceRoot` (chemin réservé pour le workspace privé)
- `skipSetup` (boolean, défaut: `false` ; utilisé pour bypasser la
  création lors des retries/verifications)

---

## 4. Outputs

Evidence JSON principale écrite sous
`artefactRoot/startup/workspace-setup/work-session.json` :

```ts
type WorkspaceSetupEvidence = {
  workSession: WorkSession;
  dirtyStateAdoption?: DirtyStateAdoption;
  createdDirectories: string[];
  workspaceProjectRoot?: string;
};
```

Le champ `dirtyStateAdoption` est présent uniquement si le
`DirtyStateCaptureArtifact` indique `"dirty"` et que le replay a réussi.
Il référence le `captureArtifactId` du `DirtyStateCaptureArtifact`.

Cette tâche produit également un `WorkflowExecutionRecord` durable.

---

## 5. Stratégie de création

La création effective du workspace est déléguée à une stratégie. La
stratégie actuelle est la **stratégie Git Worktree**, documentée dans
[`workspace-setup.worktree.md`](./workspace-setup.worktree.md).

Quelle que soit la stratégie, le pipeline logique est :

1. Résoudre le dépôt et le point de départ Git (`baseHeadSha`,
   `baseBranch`, `defaultTargetBranch`).
2. Initialiser un nouveau dépôt distant si nécessaire.
3. Créer le workspace physique via la stratégie.
4. Si `DirtyStateCaptureArtifact.initialDirtyState === "dirty"`, rejouer
   le patch dans le workspace.
5. Persister le `WorkSession` et le `WorkflowExecutionRecord`.

---

## 6. Règles & Invariants

### 6.1 Workspace physique obligatoire [Agnostique]
Le run de l'agent ne travaille jamais dans le dépôt source. Une simple
branche Git locale ne suffit pas pour isoler les fichiers non suivis, les
caches ou les conflits.

### 6.2 Isolation des artefacts [Agnostique]
Les artefacts et logs du run doivent être stockés hors du workspace privé
(sous `artefactRoot` ou le dossier de logs du run) pour éviter de polluer
le `git status` et les diffs de l'implémentation.

### 6.3 Base de référence figée [Agnostique]
`baseHeadSha` est le commit parent définitif de tout le travail effectué
pendant le run. Il est immuable une fois le run démarré.

### 6.4 Dirty state adopté [Agnostique]
Un dirty state adopté ne donne pas le droit d'écrire ou travailler dans le
dépôt source. Il est encapsulé comme un intrant strict via
`DirtyStateAdoption`, qui référence le `DirtyStateCaptureArtifact` produit
par `dirty-state-capture` et documente le statut de replay dans le
workspace.

### 6.5 Pas d'implémentation directe sur main [Agnostique]
L'agent ne doit jamais travailler ou commiter directement sur la branche
par défaut (ex: `main`, `master`).

### 6.6 Indépendance de `run-capture` [Agnostique]
`workspace-setup` ne lit pas et ne dépend pas du prompt de l'utilisateur
capturé par `run-capture`. Ces deux tâches de startup peuvent tourner de
façon asynchrone et concurrente.

### 6.7 Frontière d'autorité Git [Agnostique]
`WorkSession` est le premier document d'autorité Git produit par le run.
Les analyses de projet faites en parallèle sur le dépôt source doivent
être validées contre ce `WorkSession` avant d'être finalisées.

### 6.8 Checkpoints et comportement au retry [Agnostique]

La tâche écrit un `BootstrapTaskCheckpoint` atomique sous
`artefactRoot/startup/workspace-setup/task-record.json`.

Le comportement de nettoyage au retry dépend de la stratégie. La stratégie
worktree utilise `git worktree remove --force` + `git worktree prune` (voir
[`workspace-setup.worktree.md`](./workspace-setup.worktree.md) §1.7). Une
stratégie sandbox délègue le nettoyage à la destruction du conteneur.

**Composition des hashes :**
- `inputHash` : empreinte JCS de
  `{ runId, RepoCapture, artefactRoot, workspaceRoot, skipSetup }`,
  les inputs consommés par cette tâche. `RepoCapture` est référencé par
  valeur (hash JCS), pas par référence.
- `repoCaptureHash` : pertinent. La tâche consomme `RepoCapture` pour
  `canonicalRepositoryRoot`, `projectRoot` et la validation du dépôt
  source.
- `workflowPolicyHash` : pertinent. La tâche consomme
  `WorkflowPolicy.dirtyState` pour valider la cohérence avec le
  `DirtyStateCaptureArtifact`.
- `captureContextHash` : fixé à la valeur sentinelle déterministe
  `sha256:0000000000000000000000000000000000000000000000000000000000000000`
  (64 zéros après le préfixe). Conformément au §6.6, cette tâche est
  indépendante de `run-capture` et ne consomme pas le `CaptureContext`.

**Comportement au retry :**
- Checkpoint terminal présent et tous les hashes pertinents identiques
  (`inputHash`, `repoCaptureHash`, `workflowPolicyHash`) → adoption
  directe. Le workspace est validé par diagnostic (`skipSetup: true`) sans
  reconstruction.
- Checkpoint absent → ré-exécution complète (`skipSetup: false`).
- `inputHash` différent (mismatch) → échec ferme (`failed`).
- Checkpoint terminal `failed` ou `errored` → échec ferme.

---

## 7. Opérations internes typiques

- `load-dirty-state-capture-artifact`
- `verify-canonical-repository`
- `initialize-git-repo-and-remote` (si dépôt vide)
- `determine-base-git-pointers` (`baseHeadSha`, `baseBranch`,
  `defaultTargetBranch`)
- `create-work-branch`
- `create-workspace` (délégué à la stratégie)
- `apply-dirty-patch-into-workspace`
- `write-work-session-evidence`
- `persist-execution-record`

---

## 8. Failure modes

| Échec | Statut | Action |
|---|---|---|
| `RepoCapture` absent ou invalide | `errored` | Arrêt immédiat |
| Racine Git réelle ≠ `canonicalRepositoryRoot` | `failed` | Arrêt |
| `projectRoot` résolu hors de `canonicalRepositoryRoot` | `failed` | Arrêt |
| Création du dépôt distant échouée | `errored` | Arrêt |
| `origin/HEAD` et branches fallback absents | `failed` | Arrêt |
| Patch ne s'applique pas proprement | `failed` | Arrêt |
| Dossier d'artefacts déjà occupé au retry | `errored` | Arrêt |

Pour les failure modes spécifiques à la stratégie (worktree remove, prune,
dossier résiduel), voir
[`workspace-setup.worktree.md`](./workspace-setup.worktree.md) §4.

---

## 9. Non-goals

- Capturer le dirty state (responsabilité de `dirty-state-capture`).
- Résoudre ou interpréter l'intention utilisateur.
- Publier ou pousser la branche de travail `work/<runId>` vers le remote.
- Créer une Pull Request.
- Effectuer des optimisations de code, lancer des tests ou exécuter des
  gates mécaniques.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
