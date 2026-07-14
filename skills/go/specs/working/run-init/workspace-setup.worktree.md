# Stratégie Git Worktree — `workspace-setup`

> **Stratégie d'implémentation du contrat [`workspace-setup`](./workspace-setup.md).**
> Ce document décrit le pipeline physique basé sur `git worktree add`.
> Voir [ADR-go-physical-worktree-isolation.md](../../adr/ADR-go-physical-worktree-isolation.md)
> pour la motivation du worktree physique.

---

## 1. Pipeline

Les étapes du pipeline s'enchaînent de la manière suivante. Chaque étape
dépend de la réussite de la précédente :

### 1.1 Résolution du dépôt
`canonicalRepositoryRoot` provient de `RepoCapture`. Si aucun dépôt Git
n'existe à cet emplacement (dossier vide/nouveau), ignorer la validation
Git et passer à l'étape 1.2. Sinon, vérifier que
`canonicalRepositoryRoot` correspond à la racine Git réelle. Vérifier
que `projectRoot` (si spécifié) est bien un sous-dossier de
`canonicalRepositoryRoot`.

### 1.2 Initialisation (nouveau dépôt)
Si aucun dépôt n'existe à `canonicalRepositoryRoot` :
1. Initialiser le dépôt (`git init`).
2. Indexer les fichiers présents (`git add -A`).
3. Commiter l'état existant (`git commit -m "initial"` ou `--allow-empty`
   si aucun fichier).
4. Créer le dépôt distant via l'API du provider (utilisant la
   configuration `ProviderConfig` déjà validée par `run-init`).
5. Associer le remote : `git remote add origin <url-retournée>`.
6. Pousser la branche par défaut : `git push -u origin main`.

### 1.3 Point de départ Git
- `baseHeadSha` : `git rev-parse --verify HEAD^{commit}`. Si la tête
  n'existe pas (aucun commit), initialiser avec un premier commit vide
  (`git commit --allow-empty -m "initial"`) puis relancer.
- `baseBranch` : `git rev-parse --abbrev-ref HEAD` (vaut `"(detached)"`
  si HEAD détaché).
- `defaultTargetBranch` : `git symbolic-ref refs/remotes/origin/HEAD`
  (extraire le nom court, ex: `main`. Fallback sur `main` puis `master`
  si absent).

### 1.4 Création du workspace
1. Créer la branche de travail locale `work/<runId>` depuis
   `baseHeadSha`.
2. Vérifier que le chemin `workspaceRoot` est libre ou adoptable.
3. Ajouter le workspace physique privé (`git worktree add <workspaceRoot>
   work/<runId>`) en résolvant impérativement `workspaceRoot` via
   `realpath` (Invariant §2.1).

### 1.5 Application du patch
Si un `DirtyStateCaptureArtifact` indique `"dirty"`, appliquer le patch
dans le workspace privé. Capturer le `git status --porcelain` du
workspace privé après l'application. Si le patch ne s'applique pas
proprement, lever un échec `failed`.

### 1.6 Persistance
1. Créer le sous-dossier `workspace-setup/` sous `artefactRoot`.
2. Écrire le fichier de preuve `WorkSession` (conforme au schéma
   validé).
3. Persister le `WorkflowExecutionRecord` associé.

### 1.7 Gestion des Retries et `skipSetup`
Le comportement en cas de retry dépend de la valeur de `skipSetup` :

* **`skipSetup = true` :** Exécuter le pipeline en mode diagnostic sans
  recréer le workspace. Ignorer les étapes 1.2 et 1.4. Vérifier que
  `workspaceRoot` est cohérent. Lever une erreur s'il y a des
  incohérences, sans altérer le disque.

* **`skipSetup = false` (avec `workspaceRoot` préexistant) :**
  1. Valider le lien `.git` du workspace et s'assurer que la branche
     `work/<runId>` existe.
  2. Valider la continuité d'historique :
     `git merge-base --is-ancestor <baseHeadSha> HEAD`.
  3. Si un patch a été adopté, vérifier s'il a déjà été appliqué via
     `git apply --reverse --check <patch>`. Si oui, valider l'état
     porcelain filtré sur les fichiers du patch. Si non appliqué,
     tenter de l'appliquer à l'étape 1.5.
  4. Si cohérent, l'adopter. Si corrompu ou incohérent, nettoyer
     proprement dans cet ordre strict avant de reconstruire
     (étapes 1.4-1.6) :
     a. `git worktree remove --force <workspaceRoot>` — tenter de
        désenregistrer le workspace côté dépôt principal.
     b. `git worktree prune` — **impératif** après toute tentative de
        suppression, pour nettoyer les métadonnées orphelines sous
        `.git/worktrees/` dans le dépôt principal. Sans cette étape,
        Git conservera des descripteurs périmés qui bloqueront les
        tentatives futures de recréer le workspace.
     c. Supprimer physiquement le dossier résiduel (`rm -rf
        <workspaceRoot>`) **uniquement en dernier recours** si le
        dossier persiste après les étapes a et b.

> En stratégie sandbox, le cleanup est délégué à la destruction du
> conteneur. Les étapes a et b (`git worktree remove`,
> `git worktree prune`) sont absentes en mode sandbox.

---

## 2. Invariants spécifiques à la stratégie worktree

### 2.1 Résolution des chemins (`realpath`)
Pour toutes les opérations Git impliquant le workspace (ex:
`git worktree add`), `workspace-setup` doit utiliser la forme résolue
(`realpath`) du chemin `workspaceRoot` pour éviter d'écrire des chemins
contenant des symlinks dans les pointeurs internes de Git, ce qui
corromprait le workspace privé. Cet invariant est spécifique à la
stratégie worktree ; un clone standard (sandbox) a un `.git` autonome
insensible aux symlinks du parent.

### 2.2 Nettoyage physique au retry
Les étapes de nettoyage (§1.7.a/b/c) utilisent `git worktree remove
--force` et `git worktree prune` pour désenregistrer le workspace côté
dépôt principal. Ces commandes sont spécifiques à la stratégie worktree.
En stratégie sandbox, le nettoyage est délégué à la destruction du
conteneur.

---

## 3. Opérations internes

- `verify-canonical-repository`
- `initialize-git-repo-and-remote` (si dépôt vide)
- `determine-base-git-pointers` (`baseHeadSha`, `baseBranch`,
  `defaultTargetBranch`)
- `create-work-branch`
- `create-physical-workspace` (via `git worktree add`)
- `apply-dirty-patch-into-workspace`
- `write-work-session-evidence`
- `persist-execution-record`

---

## 4. Failure modes

| Pipeline | Échec rencontré | Statut | Action |
|---|---|---|---|
| 1.4 | Création du workspace impossible (chemin occupé par dossier étranger) | `errored` | Arrêt |
| 1.7.a | `git worktree remove --force` échoue (workspace inconnu de Git) | `errored` | Passer à 1.7.b |
| 1.7.b | `git worktree prune` échoue | `errored` | Arrêt — corruption du dépôt principal |
| 1.7.c | Dossier résiduel persiste après 1.7.a et 1.7.b | `errored` | Arrêt — conflit de chemin non résolu |

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
