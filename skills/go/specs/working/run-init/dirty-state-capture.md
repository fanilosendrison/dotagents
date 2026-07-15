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

`dirty-state-capture` s'exécute en parallèle avec `run-capture`, après
`repo-capture`. Elle est séquentielle par rapport à `workspace-setup` qui
dépend de son patch — c'est le seul maillon linéaire de la branche.

```text
              run-init
                 │
       prerequisite-validation
                 │
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

> **Note pour les consommateurs :** le hash JCS canonique du
> `DirtyStateDiffArtifact` est utilisé par `workspace-setup` comme
> `dirtyStateDiffHash` dans son `inputHash` de checkpoint. Si
> `initialDirtyState === "clean"`, le hash JCS vaut la sentinelle
> déterministe (64 zéros).

---

## 5. Pipeline

### 5.0 Dépôt inexistant

Si `canonicalRepositoryRoot` ne contient aucun `.git`, le dépôt n'existe
pas encore (`repo-capture` a délégué sa création à `workspace-setup`).
Dans ce cas, écrire un `DirtyStateDiffArtifact` avec
`initialDirtyState: "clean"` et terminer immédiatement. Il n'y a rien à
capturer.

### 5.1 Diagnostic du dépôt source

1. **Vérification HEAD** : exécuter `git rev-parse --verify HEAD`. Si HEAD
   n'existe pas (dépôt vide avec `.git` mais sans commit), le dépôt n'a
   aucun état à capturer. Écrire un `DirtyStateDiffArtifact` avec
   `initialDirtyState: "clean"` et terminer. Le commit initial sera créé
   par `workspace-setup`.
   > Note : le cas « aucun dépôt » (pas de `.git`) est traité en amont par
   > l'étape 5.0.
2. **Détection des conflits** : lire le dirty state initial
   (`git -c core.quotePath=false status --porcelain`) depuis
   `canonicalRepositoryRoot`. Le flag `core.quotePath=false` garantit que
   les chemins contenant des caractères non-ASCII ou des espaces sont
   restitués tels quels (sans échappement octal ni guillemets), afin
   d'être consommables par les appels `fs.stat` ultérieurs. Si la sortie
   contient des fichiers en conflit non résolu (codes d'état `DD`, `AU`,
   `UD`, `UA`, `DU`, `AA`, `UU`), lever un échec `failed`.
3. **Vérification des fichiers masqués** :
   - Lister les fichiers flaggés via `git -c core.quotePath=false ls-files
     -v`. Le flag `core.quotePath=false` garantit des chemins non échappés,
     consommables par `git ls-files -s` et `git hash-object` ci-dessous.
   - Pour chaque fichier préfixé par `h` (assume-unchanged) ou `S`
     (skip-worktree) en première colonne :
     - Récupérer son hash dans l'index via `git ls-files -s <chemin>`.
     - Calculer le hash du fichier sur le disque via
       `git hash-object <chemin>`.
     - Si les hashes diffèrent, le fichier masqué a été modifié localement.
       Lever un échec `failed` (arrêt de sécurité).
4. **Vérification d'état clean** : si `git status --porcelain` est vide et
   qu'aucun fichier masqué n'est modifié, le dépôt est clean. Écrire
   `DirtyStateDiffArtifact` avec `initialDirtyState: "clean"` et terminer.

### 5.2 Validation de la policy

1. Si `WorkflowPolicy.dirtyState.mode` refuse le dirty state, lever un
   échec `failed`.
2. Si l'adoption est autorisée (`"adopt-as-input"` ou
   `"human-gate-if-dirty"`), continuer.

### 5.3 Capture du patch

1. **Initialisation du répertoire** : créer récursivement le dossier
   temporaire de travail
   (`mkdir -p "${artefactRoot}/startup/dirty-state-capture/tmp/"`).
2. **Capture du patch** : capturer l'état dirty sous forme de patch binaire
   sans altérer l'index réel du dépôt source :
   ```bash
   INDEX_TMP="${artefactRoot}/startup/dirty-state-capture/tmp/index"
   GIT_INDEX_FILE="$INDEX_TMP" git read-tree HEAD
   GIT_INDEX_FILE="$INDEX_TMP" git add -A
   GIT_INDEX_FILE="$INDEX_TMP" git diff --cached --binary --full-index
   rm "$INDEX_TMP"
   ```
3. **Sauvegarde et preuves** :
   - Écrire la sortie de `git -c core.quotePath=false status --porcelain`
     dans
     `artefactRoot/startup/dirty-state-capture/evidence/status.txt`,
     garantissant des chemins lisibles dans les preuves d'audit.
   - Écrire la sortie du patch dans
     `artefactRoot/startup/dirty-state-capture/evidence/patch.diff`.
   - Calculer le hash SHA256 du patch brut.
   - Écrire le `DirtyStateDiffArtifact` avec `initialDirtyState: "dirty"`,
     `sourceStatusPorcelainRef`, `sourcePatchRef` et `sourcePatchHash`.

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
  `{ runId, RepoCapture, WorkflowPolicy.dirtyState, artefactRoot,
  gitStateDigest }`, où `gitStateDigest` est calculé comme
  `sha256(git rev-parse HEAD + "\n" + git status --porcelain)`. Tout
  changement physique du dépôt source invalidera le checkpoint au retry.
  **Note de déviation :** `gitStateDigest` n'est pas un hachage JCS
  (les sorties Git sont du texte brut, pas du JSON structuré).
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

### 6.5 Compromis de race condition (non-verrouillage)
La tâche capture le dirty state de manière non bloquante. Si des
modifications concurrentes surviennent sur l'hôte pendant la capture, la
cohérence temporelle absolue n'est pas garantie. C'est un compromis de
conception acceptable pour éviter d'acquérir des verrous système intrusifs
sur le dépôt de l'utilisateur.

---

## 7. Opérations internes typiques

- `verify-head-exists` (via `git rev-parse --verify HEAD`)
- `detect-source-dirty-state` (via `git -c core.quotePath=false status
  --porcelain`)
- `detect-merge-conflicts` (via patterns `DD|AU|UD|UA|DU|AA|UU` dans
  `git status --porcelain`)
- `detect-masked-file-modifications` (via `git -c core.quotePath=false
  ls-files -v` + `git ls-files -s` + `git hash-object`)
- `validate-dirty-state-policy`
- `capture-dirty-patch` (via index Git temporaire)
- `hash-dirty-patch`
- `write-capture-artifact`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Échec rencontré | Statut | Action |
|---|---|---|---|
| 5.0 | `RepoCapture` absent ou invalide (avant accès au dépôt) | `errored` | Arrêt immédiat |
| 5.1 | `canonicalRepositoryRoot` inaccessible | `errored` | Arrêt |
| 5.1.2 | Conflits de merge non résolus détectés | `failed` | Arrêt |
| 5.1.3 | Fichiers assume-unchanged ou skip-worktree modifiés détectés | `failed` | Arrêt de sécurité |
| 5.2 | Dirty state détecté mais rejeté par la policy | `failed` | Arrêt |
| 5.3.2 | Échec de la capture du patch (index temporaire, diff) | `errored` | Arrêt |
| 5.3.4 | Fichiers d'evidence ou temporaires écrits hors de l'`artefactRoot` | `errored` | Arrêt de sécurité |

---

## 9. Non-goals

- Créer un workspace.
- Appliquer le patch (responsabilité de `workspace-setup`).
- Modifier le dépôt source.
- Interpréter l'intention utilisateur.
- Garantir la cohérence atomique contre des modifications concurrentes de
  l'hôte pendant la capture.
- Supporter ou réintégrer les configurations et fichiers sous drapeau
  `assume-unchanged` ou `skip-worktree`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
