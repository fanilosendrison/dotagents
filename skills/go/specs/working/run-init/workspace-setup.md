# Startup task `workspace-setup`

`workspace-setup` prépare le terrain isolé d'un run `/go`. Elle doit s'exécuter avant toute délégation agentique qui modifie le code. Elle est une bootstrap task interne à la phase Turnlock `run-init`, et non une phase Turnlock séparée.

---

## 1. Objectif

Créer un worktree Git physique privé et isolé, enregistrer avec précision le point de départ Git du run, et produire l'artefact `WorkSession` durable. 

Cette bootstrap task ne produit aucun code applicatif.

---

## 2. Position dans le workflow

`workspace-setup` s'exécute en parallèle avec `run-capture` et `repo-discovery-draft` au sein de la phase Turnlock `run-init`.

```text
run-init
│
├─ provider-config-validation (séquentiel)
│       ↓
├─ repo-capture (séquentiel)
│       │
│       ├─ run-capture (parallèle)
│       ├─ workspace-setup (parallèle) ──┐
│       └─ repo-discovery-draft (parallèle)
│                  │                      │
│                  └──────────┬───────────┘
│                             ↓
│                 project-discovery-finalize
```

Elle s'exécute après la validation de `ProviderConfig` et la résolution de `RepoCapture`. Ses extrants sont requis comme intrants indispensables pour finaliser la découverte de projet dans `project-discovery-finalize`.

---

## 3. Inputs

- `runId` (identifiant unique Crockford base32 ULID)
- `RepoCapture` (contexte de dépôt préalablement résolu par `run-init`)
- `WorkflowPolicy.dirtyState` (règles d'adoption du dirty state)
- `artefactRoot` (répertoire réservé aux preuves)
- `worktreeRoot` (chemin réservé pour le worktree privé)
- `skipSetup` (boolean, défaut: `false` ; utilisé pour bypasser la création lors des retries/verifications)

---

## 4. Outputs

Evidence JSON principale écrite sous `artefactRoot/startup/workspace-setup/work-session.json` :

```ts
type WorkspaceSetupEvidence = {
  workSession: WorkSession;
  dirtyStateAdoption?: DirtyStateAdoption;
  createdDirectories: string[];
  worktreeProjectRoot?: string;
};
```

Cette tâche produit également un `WorkflowExecutionRecord` durable. Si elle passe par le stage harness, ce record référence le `StageOutput` canonique.

---

## 5. Pipeline

Les étapes du pipeline s'enchaînent de la manière suivante. Chaque étape dépend de la réussite de la précédente :

### 5.1 Résolution du dépôt
`canonicalRepositoryRoot` provient de `RepoCapture`. Si aucun dépôt Git n'existe à cet emplacement (dossier vide/nouveau), ignorer la validation Git et passer à l'étape 5.2. Sinon, vérifier que `canonicalRepositoryRoot` correspond à la racine Git réelle. Vérifier que `projectRoot` (si spécifié) est bien un sous-dossier de `canonicalRepositoryRoot`.

### 5.2 Initialisation (nouveau dépôt)
Si aucun dépôt n'existe à `canonicalRepositoryRoot` :
1. Initialiser le dépôt (`git init`).
2. Indexer les fichiers présents (`git add -A`).
3. Commiter l'état existant (`git commit -m "initial"` ou `--allow-empty` si aucun fichier).
4. Créer le dépôt distant via l'API du provider (utilisant la configuration `ProviderConfig` déjà validée par `run-init`).
5. Associer le remote : `git remote add origin <url-retournée>`.
6. Pousser la branche par défaut : `git push -u origin main`.

### 5.3 Point de départ Git
- `baseHeadSha` : `git rev-parse --verify HEAD^{commit}`. Si la tête n'existe pas (aucun commit), initialiser avec un premier commit vide (`git commit --allow-empty -m "initial"`) puis relancer.
- `baseBranch` : `git rev-parse --abbrev-ref HEAD` (vaut `"(detached)"` si HEAD détaché).
- `defaultTargetBranch` : `git symbolic-ref refs/remotes/origin/HEAD` (extraire le nom court, ex: `main`. Fallback sur `main` puis `master` si absent).

### 5.4 Capture du Dirty State
1. Lire le dirty state initial (`git status --porcelain`) du dépôt source.
2. Si le dépôt est clean, continuer.
3. Si `WorkflowPolicy.dirtyState.mode` refuse le dirty state, lever un échec `failed`.
4. Si l'adoption est autorisée, capturer le dirty state sous forme de patch de manière isolée sans altérer l'index réel du dépôt source :
   ```bash
   TMP=$(mktemp)
   GIT_INDEX_FILE="$TMP" git read-tree HEAD
   GIT_INDEX_FILE="$TMP" git add -A
   GIT_INDEX_FILE="$TMP" git diff --cached --binary --full-index
   rm "$TMP"
   ```
5. Calculer le hash SHA256 du patch brut. Le patch sera appliqué à l'étape 5.6.

### 5.5 Création du worktree
1. Créer la branche de travail locale `work/<runId>` depuis `baseHeadSha`.
2. Vérifier que le chemin `worktreeRoot` est libre ou adoptable.
3. Ajouter le worktree physique privé (`git worktree add <worktreeRoot> work/<runId>`) en résolvant impérativement `worktreeRoot` via `realpath` (Invariant 6.8).

### 5.6 Application du patch
Si un dirty state a été adopté (étape 5.4), appliquer le patch dans le worktree privé. Capturer le `git status --porcelain` du worktree privé après l'application. Si le patch ne s'applique pas proprement, lever un échec `failed`.

### 5.7 Persistance
1. Créer le sous-dossier `workspace-setup/` sous `artefactRoot`.
2. Écrire le fichier de preuve `WorkSession` (conforme au schéma validé).
3. Persister le `WorkflowExecutionRecord` associé.

### 5.8 Gestion des Retries et skipSetup
Le comportement en cas de retry dépend de la valeur de `skipSetup` :
* **`skipSetup = true` :** Exécuter le pipeline en mode diagnostic sans recréer le worktree. Ignorer les étapes 5.2 et 5.5. Vérifier que `worktreeRoot` est cohérent. Lever une erreur s'il y a des incohérences, sans altérer le disque.
* **`skipSetup = false` (avec `worktreeRoot` préexistant) :** 
  1. Valider le lien `.git` du worktree et s'assurer que la branche `work/<runId>` existe.
  2. Valider la continuité d'historique : `git merge-base --is-ancestor <baseHeadSha> HEAD`.
  3. Si un patch a été adopté, vérifier s'il a déjà été appliqué via `git apply --reverse --check <patch>`. Si oui, valider l'état porcelain filtré sur les fichiers du patch. Si non appliqué, tenter de l'appliquer à l'étape 5.6.
  4. Si cohérent, l'adopter. Si corrompu ou incohérent, nettoyer proprement via `git worktree remove --force` / `git worktree prune` ou en forçant la suppression physique du dossier (`rm -rf`) avant de reconstruire (étapes 5.5-5.7).

---

## 6. Règles & Invariants

### 6.1 Worktree physique obligatoire
Le run de l'agent ne travaille jamais dans le dépôt source. Une simple branche Git locale ne suffit pas pour isoler les fichiers non suivis, les caches ou les conflits.

### 6.2 Isolation des artefacts
Les artefacts et logs du run doivent être stockés hors du worktree privé (sous `artefactRoot` ou le dossier de logs du run) pour éviter de polluer le `git status` et les diffs de l'implémentation.

### 6.3 Base de référence figée
`baseHeadSha` est le commit parent définitif de tout le travail effectué pendant le run. Il est immuable une fois le run démarré.

### 6.4 Dirty state adopté
Un dirty state adopté ne donne pas le droit d'écrire ou travailler dans le dépôt source. Il est encapsulé comme un intrant strict via `DirtyStateAdoption` (status porcelain d'origine, patch binaire complet, hash du patch, statut de replay dans le worktree).

### 6.5 Pas d'implémentation directe sur main
L'agent ne doit jamais travailler ou commiter directement sur la branche par défaut (ex: `main`, `master`).

### 6.6 Indépendance de `run-capture`
`workspace-setup` ne lit pas et ne dépend pas du prompt de l'utilisateur capturé par `run-capture`. Ces deux tâches de startup peuvent tourner de façon asynchrone et concurrente.

### 6.7 Frontière d'autorité Git
`WorkSession` est le premier document d'autorité Git produit par le run. Les analyses de projet faites en parallèle sur le dépôt source doivent être validées contre ce `WorkSession` avant d'être finalisées.

### 6.8 Résolution des chemins (realpath)
Pour toutes les opérations Git impliquant le worktree (ex: `git worktree add`), `workspace-setup` doit utiliser la forme résolue (`realpath`) du chemin `worktreeRoot` pour éviter d'écrire des chemins contenant des symlinks dans les pointeurs internes de Git, ce qui corromprait le worktree privé.

---

## 7. Opérations internes typiques

- `verify-canonical-repository`
- `initialize-git-repo-and-remote` (si dépôt vide)
- `determine-base-git-pointers` (`baseHeadSha`, `baseBranch`, `defaultTargetBranch`)
- `capture-source-dirty-state` (via index Git temporaire)
- `create-work-branch`
- `create-physical-worktree`
- `apply-dirty-patch-into-worktree`
- `write-work-session-evidence`
- `persist-execution-record`

---

## 8. Failure modes

| Pipeline | Échec rencontré | Statut du run | Action corrective / comportement |
|---|---|---|---|
| 5.1 | `RepoCapture` absent ou invalide | `errored` | Arrêt immédiat |
| 5.1 | Racine Git réelle du dépôt source ≠ `canonicalRepositoryRoot` | `failed` | Arrêt |
| 5.1 | `projectRoot` résolu hors de `canonicalRepositoryRoot` | `failed` | Arrêt |
| 5.2 | Création du dépôt distant échouée (API injoignable, nom pris, auth) | `errored` | Arrêt |
| 5.3 | `origin/HEAD` et branches fallbacks absents | `failed` | Échec (uniquement si cette info est indispensable) |
| 5.4 | Dirty state détecté mais rejeté par la policy | `failed` | Arrêt |
| 5.4/5.6 | Le patch capturé ne s'applique pas proprement dans le worktree | `failed` | Arrêt |
| 5.5 | Création du worktree impossible (chemin occupé par dossier étranger) | `errored` | Arrêt |
| 5.8 | Nettoyage d'un worktree existant corrompu échoue | `errored` | Arrêt |
| 5.7 | Dossier d'artefacts `workspace-setup/` déjà occupé lors du retry | `errored` | Arrêt |

---

## 9. Non-goals

- Résoudre ou interpréter l'intention utilisateur.
- Publier ou pousser la branche de travail `work/<runId>` vers le remote (tâche déléguée aux stages de packaging/publication).
- Créer une Pull Request.
- Effectuer des optimisations de code, lancer des tests ou exécuter des gates mécaniques.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
