# Startup task `dirty-state-capture`

`dirty-state-capture` capture l'état dirty du dépôt source avant toute
création de workspace. Elle s'exécute exclusivement sur l'hôte, en lecture
seule, et produit un `DirtyStateDiffArtifact` consommé par
`workspace-setup` pour le replay du patch.

C'est une bootstrap task interne à la phase Turnlock `run-init`, et non une
phase Turnlock séparée.

---

## 1. Objectif

Détecter et capturer l'état dirty du dépôt source sous forme de patch
binaire, sans altérer l'index Git réel du dépôt source. Produire un
`DirtyStateDiffArtifact` durable dans `artefactRoot`.

Cette bootstrap task ne produit aucun code applicatif. Elle est purement
mécanique : lecture seule, pas d'écriture dans le dépôt source.

---

## 2. Position dans le workflow

`dirty-state-capture` s'exécute séquentiellement après `repo-capture` et
avant le bloc parallèle (`run-capture`, `workspace-setup`,
`repo-discovery-draft`).

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
│       ├─ workspace-setup (parallèle)
│       └─ repo-discovery-draft (parallèle)
│                  │
│                  └──────────┬───────────┘
│                             ↓
│                 project-discovery-finalize
```

Elle est séquentielle pour garantir que `workspace-setup` dispose du patch
capturé avant de créer le workspace. Elle est host-side uniquement — elle
ne pénètre jamais dans le workspace — elle opère exclusivement sur le dépôt
source.

Le mapping vers `WorkSession` : la présence de `dirtyStateDiffAdoption` dans
`WorkSession` indique que le dirty state a été adopté et replayé ; son
absence indique un workspace clean.

---

## 3. Inputs

- `runId` (identifiant unique Crockford base32 ULID)
- `RepoCapture` (contexte de dépôt préalablement résolu par `run-init`)
- `WorkflowPolicy.dirtyState` (règles d'adoption du dirty state)
- `artefactRoot` (répertoire réservé aux preuves)

---

## 4. Outputs

Artefact métier écrit sous
`artefactRoot/startup/dirty-state-capture/dirty-state-capture.json` :

```ts
type DirtyStateDiffArtifact = {
  schema: "go.dirty-state-diff.v1";
  runId: string;
  capturedAt: string;
  initialDirtyState: "clean" | "dirty";
  sourceStatusPorcelainRef?: string;
  sourcePatchRef?: string;
  sourcePatchHash?: string;
};
```

Si `initialDirtyState` vaut `"clean"`, les champs `sourceStatusPorcelainRef`,
`sourcePatchRef` et `sourcePatchHash` sont absents.

Cette tâche produit également un `WorkflowExecutionRecord` durable.

---

## 5. Pipeline

### 5.1 Détection du dirty state
1. Lire le dirty state initial (`git status --porcelain`) depuis
   `canonicalRepositoryRoot`.
2. Si la sortie est vide, le dépôt est clean. Écrire
   `DirtyStateDiffArtifact` avec `initialDirtyState: "clean"` et
   terminer.

### 5.2 Validation de la policy
1. Si `WorkflowPolicy.dirtyState.mode` refuse le dirty state, lever un
   échec `failed`.
2. Si l'adoption est autorisée (`"adopt-as-input"` ou
   `"human-gate-if-dirty"`), continuer.

### 5.3 Capture du patch
1. Sauvegarder le `git status --porcelain` brut dans un fichier d'evidence
   sous `artefactRoot/startup/dirty-state-capture/evidence/`.
2. Capturer le dirty state sous forme de patch binaire sans altérer
   l'index réel du dépôt source :
   ```bash
   TMP=$(mktemp)
   GIT_INDEX_FILE="$TMP" git read-tree HEAD
   GIT_INDEX_FILE="$TMP" git add -A
   GIT_INDEX_FILE="$TMP" git diff --cached --binary --full-index
   rm "$TMP"
   ```
3. Sauvegarder la sortie du patch dans un fichier d'evidence.
4. Calculer le hash SHA256 du patch brut.
5. Écrire le `DirtyStateDiffArtifact` avec `initialDirtyState:
   "dirty"` et les références aux fichiers d'evidence.

---

## 6. Règles & Invariants

### 6.1 Lecture seule absolue
`dirty-state-capture` ne doit jamais modifier le dépôt source. Elle lit
l'état Git et crée un index temporaire dans un fichier séparé
(`GIT_INDEX_FILE`), sans toucher à l'index réel.

### 6.2 Host-side uniquement
Cette tâche s'exécute exclusivement sur l'hôte, avant toute entrée dans
un workspace. Elle ne dépend pas de `workspace-setup` et ne
lit pas le workspace.

### 6.3 Indépendance de `run-capture`
`dirty-state-capture` ne lit pas et ne dépend pas du prompt de
l'utilisateur capturé par `run-capture`.

### 6.4 Idempotence via checkpoint
La tâche écrit un `BootstrapTaskCheckpoint` atomique sous
`artefactRoot/startup/dirty-state-capture/task-record.json`.

**Composition des hashes :**
- `inputHash` : empreinte JCS de
  `{ runId, RepoCapture, WorkflowPolicy.dirtyState, artefactRoot }`.
- `repoCaptureHash` : pertinent. La tâche consomme `RepoCapture` pour
  accéder au dépôt source.
- `workflowPolicyHash` : pertinent. La tâche consomme
  `WorkflowPolicy.dirtyState` pour décider de l'adoption ou du rejet.
- `captureContextHash` : fixé à la valeur sentinelle déterministe
  `sha256:0000000000000000000000000000000000000000000000000000000000000000`
  (64 zéros). Cette tâche ne consomme pas le `CaptureContext`.

**Comportement au retry :**
- Checkpoint terminal présent et hashes identiques → adoption directe.
- Checkpoint absent → ré-exécution complète.
- Mismatch → échec ferme (`failed`).

---

## 7. Opérations internes typiques

- `detect-source-dirty-state` (via `git status --porcelain`)
- `validate-dirty-state-policy`
- `capture-dirty-patch` (via index Git temporaire)
- `hash-dirty-patch`
- `write-capture-artifact`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Échec rencontré | Statut | Action |
|---|---|---|---|
| 5.1 | `RepoCapture` absent ou invalide | `errored` | Arrêt immédiat |
| 5.1 | `canonicalRepositoryRoot` inaccessible | `errored` | Arrêt |
| 5.2 | Dirty state détecté mais rejeté par la policy | `failed` | Arrêt |
| 5.3 | Échec de la capture du patch (index temporaire, diff) | `errored` | Arrêt |
| 5.3 | Fichiers d'evidence écrits hors de l'`artefactRoot` | `errored` | Arrêt de sécurité |

---

## 9. Non-goals

- Créer un workspace.
- Appliquer le patch (responsabilité de `workspace-setup`).
- Modifier le dépôt source.
- Interpréter l'intention utilisateur.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
