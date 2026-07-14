# Startup task `workspace-setup`

`workspace-setup` prépare le terrain isolé d'un run `/go`. Elle doit s'exécuter
avant toute délégation agentique qui modifie le code. Elle est une bootstrap task
interne a la phase Turnlock `run-init`, pas une phase Turnlock separee.

---

## 1. Objectif

Créer un worktree Git physique privé, enregistrer le point de départ, et
produire un `WorkSession`.

Cette bootstrap task ne produit aucun code applicatif.

---

## 2. Inputs

- `runId`
- `RepoCapture` stocke par `run-init`
- `WorkflowPolicy.dirtyState`
- `artefactRoot` reserve par `run-init`
- `worktreeRoot` reserve par `run-init`
- `skipSetup` (`boolean`, default: `false`)

---

## 3. Outputs

Evidence JSON principale :

```ts
type WorkspaceSetupEvidence = {
  workSession: WorkSession;
  dirtyStateAdoption?: DirtyStateAdoption;
  createdDirectories: string[];
  worktreeProjectRoot?: string;
};
```

La task produit aussi un `WorkflowExecutionRecord` durable. Si elle passe par le
stage harness, ce record reference le `StageOutput` canonique.

---

## 4. Pipeline

Les etapes s'enchainent dans cet ordre. Chaque etape depend de la precedente.

### 4.1 Resolution du depot

`canonicalRepositoryRoot` provient du `RepoCapture`. Si aucun depot Git n'existe a `canonicalRepositoryRoot` (par exemple si le dossier est vide ou nouvellement cree), ignorer la verification de la racine Git reelle et passer directement a l'etape 4.2. Sinon, verifier qu'il correspond a la racine Git reelle.

Si `projectRoot` est present dans le `RepoCapture`, verifier qu'il est bien un
sous-dossier de `canonicalRepositoryRoot`.

### 4.2 Initialisation (nouveau depot)

Si aucun depot Git n'existe a `canonicalRepositoryRoot` :

1. `git init`
2. `git add -A`
3. `git commit -m "initial"` — l'etat existant devient le commit initial. Si apres `git add -A` l'index est vide (0 fichier a commiter, par exemple si le dossier est vide ou entierement gitignore), utiliser `git commit --allow-empty -m "initial"`.
4. Creer le repo distant via l'API du provider (`ProviderConfig`) :
   - `POST https://api.github.com/user/repos` (ou equivalent GitLab)
   - `name` = `basename(canonicalRepositoryRoot)`
   - `private` = `ProviderConfig.defaultVisibility`
5. `git remote add origin <url-retournee-par-l'API>`
6. `git push -u origin main`

Si `ProviderConfig` est absent alors qu'un `git init` est necessaire, echec
`errored`.

### 4.3 Point de depart Git

- `baseHeadSha` : `git rev-parse --verify HEAD^{commit}`. Si la commande echoue (exit code 128, tete non nee / aucun commit), initialiser le depot avec un premier commit vide (`git commit --allow-empty -m "initial"`), puis relancer la commande pour obtenir le SHA du commit initial comme `baseHeadSha`.
- `baseBranch` : `git rev-parse --abbrev-ref HEAD`
  - Si HEAD est detache, `baseBranch` = `"(detached)"`
- `defaultTargetBranch` : `git symbolic-ref refs/remotes/origin/HEAD`
  - Extraire le nom court (ex: `refs/remotes/origin/main` → `main`)
  - Si `origin/HEAD` n'est pas configure, tenter d'utiliser `main` puis `master` comme fallback. Si aucun des deux n'existe sur le remote, emettre un avertissement et laisser `defaultTargetBranch` indefini ; l'echec sera leve uniquement par la suite si cette information s'avere indispensable (ex: packaging/PR).

### 4.4 Dirty state

1. Lire le dirty state du dépôt source (`git status --porcelain`)
2. Si le worktree source est clean → continuer
3. Si `WorkflowPolicy.dirtyState.mode` refuse le dirty state → `failed`
4. Si adoption autorisee :
   - Capturer le dirty state (fichiers tracked et untracked) comme patch de maniere isolee sans alterer l'index reel du dépôt source :
     ```bash
     TMP=$(mktemp)
     GIT_INDEX_FILE="$TMP" git read-tree HEAD
     GIT_INDEX_FILE="$TMP" git add -A
     GIT_INDEX_FILE="$TMP" git diff --cached --binary --full-index
     rm "$TMP"
     ```
   - Hasher le patch obtenu
   - Le patch sera rejoue dans le worktree prive apres sa creation (etape 4.6)

### 4.5 Creation du worktree

1. Creer la branche `work/<runId>` depuis `baseHeadSha`.
2. Verifier que le chemin `worktreeRoot` est libre ou adoptable
3. `git worktree add <worktreeRoot> work/<runId>` — utiliser la forme
   `realpath` de `worktreeRoot` (voir invariant 5.8)

### 4.6 Replay du dirty state

Si un dirty state a ete adopte (etape 4.4), rejouer le patch dans le worktree
prive. Capturer `git status --porcelain` du worktree apres replay comme
evidence.

Si le patch ne s'applique pas proprement → `failed`.

### 4.7 Persistance

1. Creer le sous-dossier `workspace-setup/` sous `artefactRoot`
2. Ecrire `WorkSession` (artefact metier valide par schema)
3. Persister `WorkflowExecutionRecord`

### 4.8 Retry

Le comportement de cette etape depend de la valeur de `skipSetup` :

#### 4.8.1 `skipSetup = true`
Si `skipSetup` vaut `true`, le pipeline est execute pour verifier l'integrite sans recreer le worktree depuis zero :
- Les etapes 4.2 (initialisation) et 4.5 (creation du worktree) sont ignorees.
- L'etape 4.1 est executee avec des verifications assouplies : verifier uniquement que le chemin `worktreeRoot` est bien contenu dans le dossier du run et ne rentre pas en conflit avec un autre run, sans imposer que la racine Git de la source y soit resolue ou accessible.
- Si le worktree ou la branche `work/<runId>` n'existe pas, ou si des incoherences majeures de configuration sont detectees, lever une erreur sans tenter de suppression ou reconstruction.

#### 4.8.2 `skipSetup = false` (avec `worktreeRoot` preexistant)
Si `worktreeRoot` existe deja lors d'un retry avec `skipSetup = false` :

1. Verifier que le lien `.git` dans le worktree est valide.
2. Verifier que la branche `work/<runId>` existe dans Git.
3. Verifier que `baseHeadSha` (si non nul) est un ancetre du HEAD actuel du worktree (`git merge-base --is-ancestor <baseHeadSha> HEAD`), garantissant ainsi la continuite de l'historique sans imposer une egalite stricte de HEAD.
4. Si la `WorkSession` contient un `dirtyStateAdoption` :
   - Extraire la liste des fichiers modifies par le patch (via `git apply --numstat` ou en analysant les en-têtes du patch).
   - Tenter `git apply --reverse --check <patch>` sur le worktree. Si ce dry-run reverse reussit, alors le patch a deja ete applique. Verifier alors que l'etat porcelain (`git status --porcelain`), filtre uniquement sur la liste des fichiers extraits du patch, correspond exactement a l'etat attendu dans le `dirtyStateAdoption` (ignorant ainsi tout fichier untracked ou modifie etranger au patch, comme `.DS_Store` ou des caches locaux).
   - Sinon, tenter `git apply --check <patch>` (forward). Si ce dry-run forward reussit, alors le patch n'a pas encore ete applique (le worktree est propre depuis `baseHeadSha`). Le patch sera re-applique a l'etape 4.6.
   - Si aucun des deux dry-runs ne reussit, le worktree est considere comme corrompu.
5. Si tout est valide et correspond au `WorkSession` existant → adopter sans modification.
6. Si corrompu ou inconsistent (l'une des verifications ci-dessus echoue) :
   - Tenter de nettoyer proprement via `git worktree remove --force` et `git worktree prune`.
   - Si les commandes Git echouent (par exemple si le worktree n'est pas enregistre), forcer la suppression du dossier physique `worktreeRoot` (`rm -rf`) et executer `git worktree prune`.
   - Supprimer la branche locale, puis recreer depuis zero (etapes 4.5-4.7).

---

## 5. Invariants

### 5.1 Worktree physique obligatoire

Le run ne travaille pas dans le dépôt source. Une simple branche ne suffit
pas.

### 5.2 Artefacts hors worktree

Les artefacts du harness et du workflow ne doivent pas rendre le worktree dirty.

### 5.3 Base figee

`baseHeadSha` est le commit de reference pour tout diff produit par le run.

### 5.4 Dirty state adopte

Un dirty state adopte n'est pas une permission vague de travailler dans le
dépôt source. Il devient un input du run seulement si `workspace-setup` peut
produire `DirtyStateAdoption` :

- `git status --porcelain` du dépôt source capture comme evidence
- patch (capture isole via index temporaire, cf. 4.4)
- hash du patch
- replay du patch dans le worktree prive
- `git status --porcelain` du worktree apres replay capture comme evidence

Si `WorkflowPolicy.dirtyState.adoptionRequiresWorktreeReplay` vaut `true`, le
replay dans le worktree prive est obligatoire. Si le patch ne peut pas etre
rejoue proprement, `workspace-setup` echoue `failed` ou ouvre la `HumanGate`
prevue par `WorkflowPolicy.dirtyState.mode`.

### 5.5 No direct main work

L'agent n'implemente pas directement sur la branche par defaut.

### 5.6 Independance de `run-capture`

`workspace-setup` ne lit pas `RunCaptureArtifact` et ne depend pas de la
capture du prompt `/go`. Elle peut s'executer en parallele de `run-capture`,
car sa responsabilite est de figer le point de depart Git et de creer le
worktree prive.

### 5.7 Frontiere d'autorite Git

`workspace-setup` produit le premier artefact autoritatif pour les preuves Git :
`WorkSession`.

Les bootstrap tasks de discovery qui ont lu le dépôt source avant la creation
du worktree doivent etre finalisees contre ce `WorkSession` avant de produire un
`ProjectDiscovery` autoritatif.

### 5.8 Resolution des symlinks

Pour toutes les operations Git liees au worktree (notamment `git worktree add`),
`workspace-setup` doit utiliser la forme resolue (`realpath`) de `worktreeRoot`
(`canonicalRepositoryRoot` etant par definition deja resolu). Ceci garantit que
Git n'ecrit pas de chemins contenant des symlinks dans ses pointeurs internes,
evitant ainsi la corruption du worktree prive.

---

## 6. Cas limites

- **HEAD detache** : `baseBranch` vaut `"(detached)"`. `baseHeadSha` reste le
  SHA du commit detache. La branche `work/<runId>` est creee normalement depuis
  ce SHA.
- **Pas de remote `origin`** : `workspace-setup` echoue avec `failed` (sauf si
  elle vient d'initialiser le depot, auquel cas elle configure `origin`
  automatiquement via `ProviderConfig`).
- **`origin/HEAD` non configure** : tenter `main` puis `master` comme fallback. En cas d'absence complete, laisser indefini (avec avertissement) et ne lever l'echec que si une etape subsequente en a imperativement besoin.
- **Echec de creation du repo distant** : `errored`. L'etat local (commits)
  reste intact mais le run ne peut pas continuer sans remote.

---

## 7. Failure modes

| Etape | Echec | Statut |
|---|---|---|
| 4.1 | `RepoCapture` absent ou invalide | `errored` |
| 4.1 | Racine Git reelle ≠ `canonicalRepositoryRoot` | `failed` |
| 4.1 | `projectRoot` hors repo | `failed` |
| 4.2 | `ProviderConfig` absent alors que `git init` necessaire | `errored` |
| 4.2 | Creation repo distant echouee (API injoignable, token invalide, nom deja pris) | `errored` |
| 4.3 | `origin/HEAD` et fallbacks absents | `failed` (si requis) |
| 4.4 | Dirty state non adopte | `failed` |
| 4.4/4.6 | Patch irrejouable dans le worktree prive | `failed` |
| 4.5 | Branche `work/<runId>` deja existante sans checkpoint valide | nettoyee et recreee |
| 4.5 | Worktree cible deja occupe par un dossier corrompu | nettoye et recree |
| 4.5 | Echec du nettoyage worktree corrompu | `errored` |
| 4.5 | Creation du worktree impossible | `errored` |
| 4.7 | Sous-dossier `workspace-setup/` deja occupe | `errored` |
| 4.8 | Worktree existant valide et correspond au `WorkSession` | adopte |
| 4.8 | Worktree existant corrompu ou inconsistent | nettoie/reconstruit |

---

## 8. Non-goals

- Implementer la demande utilisateur.
- Publier une branche.
- Creer une PR.
- Decouper le diff.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
