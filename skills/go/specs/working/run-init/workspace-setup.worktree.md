---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cubits-design-doc"
workspace: "go"
date: "2026-07-17"
step_id: 0
id: CDD-GO-WORKSPACE-SETUP-WORKTREE
version: "1.0.0"
scope: run-init
status: extracted-archive
consumers: [agent-generator]
superseded_by: [NIB-M-GO-WORKSPACE-SETUP-WORKTREE]
---

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
n'existe à cet emplacement (aucun `.git` trouvé), ignorer la validation
Git et passer à l'étape 1.2. Sinon :
1. Vérifier que `git -C <canonicalRepositoryRoot> rev-parse
   --show-toplevel` résolu via `realpath` correspond à
   `realpath(canonicalRepositoryRoot)`. Si divergence, lever `failed`.
2. Vérifier que `git config core.worktree` est vide dans le dépôt source.
   Si non vide, lever `failed` (configuration incompatible avec les
   worktrees Git).
3. Vérifier que `projectRoot` (si spécifié) est bien un sous-dossier de
   `canonicalRepositoryRoot`.

### 1.2 Initialisation (nouveau dépôt)
Si aucun dépôt n'existe à `canonicalRepositoryRoot` :
1. Initialiser le dépôt (`git init`).
2. Déterminer la branche par défaut locale :
   `git config --get init.defaultBranch`. Si absent, utiliser `"main"`.
3. Positionner HEAD sur la branche par défaut sans checkout de fichier :
   `git symbolic-ref HEAD refs/heads/<defaultBranch>`. Cette commande
   fonctionne même sur un dépôt vide sans commits (contrairement à
   `git checkout` ou `git checkout -b` qui échouent sur un unborn
   branch).
4. Indexer les fichiers présents (`git add -A`).
5. Commiter l'état existant (`git commit -m "initial"` ou `--allow-empty`
   si aucun fichier).
6. Créer le dépôt distant via l'API du provider (utilisant la
   configuration `ProviderConfig` déjà validée par `run-init`).
   L'appel API doit spécifier un dépôt **vide sans initialisation
   automatique** (ex: `auto_init: false` sur GitHub,
   `initialize_with_readme: false` sur GitLab) pour éviter un rejet
   du push à l'étape 8 (non-fast-forward). Si le nom est déjà pris
   (race condition ou repo préexistant), lever `errored`.
7. Associer le remote :
   a. Si `origin` existe déjà → `git remote set-url origin <url>`.
   b. Sinon → `git remote add origin <url>`.
8. Pousser la branche par défaut : `git push -u origin <defaultBranch>`.

### 1.3 Point de départ Git
- `baseHeadSha` : `git rev-parse --verify HEAD^{commit}`. Si la tête
  n'existe pas (aucun commit), initialiser avec un premier commit vide
  (`git commit --allow-empty -m "initial"`) puis relancer.
- `baseBranch` : `git branch --show-current`. Retourne une chaîne vide
  si HEAD est détaché. En cas de HEAD détaché, `baseBranch` vaut `null`
  (le run est autorisé depuis un commit détaché, documenté dans
  `WorkSession`).
- `defaultTargetBranch` :
  1. Si le remote `origin` est absent → `failed` (voir contrat §8).
  2. Tenter `git symbolic-ref refs/remotes/origin/HEAD` → extraire le
     nom court.
  3. Si échec, fallback : `git branch -r --list "origin/main"` puis
     `"origin/master"`.
  4. Si aucun fallback ne matche → `failed`.

### 1.4 Création du workspace

**Pré-nettoyage :** Avant toute création, exécuter
`git worktree prune` pour nettoyer les métadonnées orphelines sous
`.git/worktrees/` (ex: worktrees interrompus par crash). Si une entrée
orpheline porte le même chemin que `workspaceRoot`, la supprimer via le
protocole §1.7.a-c avant de continuer.

1. Créer la branche de travail locale `work/<runId>` depuis
   `baseHeadSha` **via `git branch` (sans checkout)**. Un checkout
   de cette branche dans le dépôt principal bloquerait l'étape 1.4.4
   (`git worktree add` refuse une branche déjà checkout ailleurs).
   Si la branche existe déjà :
   a. Si retry avec checkpoint valide : vérifier que
      `git merge-base <branche> <baseHeadSha>` retourne `baseHeadSha`
      (même historique). Si oui, réutiliser. Si non, forcer avec
      `git branch -f work/<runId> <baseHeadSha>`.
   b. Si premier run (pas de checkpoint) : lever `failed` (collision
      inattendue de runId).
2. Vérifier que le chemin `workspaceRoot` est libre (aucun fichier ni
   dossier n'existe à cet emplacement). La notion d'« adoptable »
   s'applique uniquement au retry (voir §1.7).
3. Résoudre le **parent** de `workspaceRoot` via `realpath` et y
   apposer le basename de `workspaceRoot` pour construire
   `resolvedWorkspaceRoot`. (Sur macOS, `realpath` échoue sur un chemin
   inexistant — résoudre le parent puis concaténer le basename.)
4. Ajouter le workspace physique privé :
   `git worktree add <resolvedWorkspaceRoot> work/<runId>`.
5. Post-création, vérifier que `realpath(workspaceRoot)` correspond à
   `resolvedWorkspaceRoot`. La comparaison est normalisée à la casse
   du filesystem (`toLowerCase()` sur macOS/Windows, stricte sur
   Linux). Si divergence, lever `errored` (workspace créé sous un
   chemin résolu inattendu).
6. Verrouiller le workspace :
   `git worktree lock <workspaceRoot> --reason "go-run:<runId>"`. Ce lock
   empêche `git worktree prune` manuel ou automatique de supprimer un
   worktree actif.

### 1.4bis Initialisation après création du workspace

Après création réussie du workspace, exécuter dans l'ordre, depuis
`workspaceRoot` :

1. **Submodules** : si `.gitmodules` existe à la racine du workspace,
   exécuter `git submodule update --init --recursive`. Si échec, lever
   `errored`.
2. **Git LFS** : si `.gitattributes` contient un filtre `filter=lfs`,
   exécuter `git lfs pull`. Si `git-lfs` n'est pas installé, lever
   `failed` (dépendance manquante documentée). Si installé mais échec,
   lever `errored`.
3. **Git hooks** : toutes les commandes Git mutantes exécutées dans le
   workspace par `workspace-setup` (y compris l'application du patch
   §1.5) doivent être préfixées de `-c core.hooksPath=/dev/null` pour
   neutraliser les hooks globaux ET les hooks locaux copiés du dépôt
   principal.

### 1.5 Application du patch
Si un `DirtyStateDiffArtifact` indique `"dirty"` :
1. Vérifier l'applicabilité avec
   `git -c core.hooksPath=/dev/null apply --check --binary <patch>`.
   Si échec, lever `failed` (patch incompatible).
2. Appliquer le patch :
   `git -c core.hooksPath=/dev/null apply --binary <patch>`.
3. Capturer le `git status --porcelain` du workspace privé après
   l'application.

Les modifications appliquées restent dans le working tree (non stagées).
Ceci est intentionnel : l'agent d'implémentation démarre avec l'état
dirty exact tel que capturé par `dirty-state-capture`.

Si le patch ne s'applique pas proprement à l'étape 2, lever un échec
`failed`.

### 1.6 Persistance
1. Créer le sous-dossier `workspace-setup/` sous `artefactRoot`.
2. Écrire le fichier de preuve `WorkSession` (conforme au schéma
   validé).
3. Persister le `WorkflowExecutionRecord` associé.

### 1.7 Gestion des Retries et `skipSetup`
Le comportement en cas de retry dépend de la valeur de `skipSetup` :

* **`skipSetup = true` :** Exécuter le pipeline en mode diagnostic sans
  recréer le workspace. Ignorer les étapes 1.2 et 1.4. Vérifications :
  1. **Containment :** le chemin résolu de `workspaceRoot` est sous le
     namespace du run (`runDir`). Si violation, lever `errored`.
  2. **Constater le lien `.git` :** détecter si le fichier `.git` dans
     `workspaceRoot` existe et pointe vers un `gitdir:` valide dans
     `.git/worktrees/` du dépôt principal. Stocker le diagnostic sans
     lever d'erreur immédiate.
  3. **Branche active :** si le lien `.git` est fonctionnel, vérifier
     que `git -C <workspaceRoot> branch --show-current` retourne
     `work/<runId>`. Si divergence, lever `errored`.
  4. **Continuité d'historique :** si le lien `.git` est fonctionnel,
     `git -C <workspaceRoot> merge-base --is-ancestor <baseHeadSha>
     HEAD`. Si échec, lever `errored`.
  5. **Réparation :** si le lien `.git` est cassé ou absent :
     a. Si Git ≥ 2.31, tenter
        `git worktree repair <workspaceRoot>`.
        - Si la réparation réussit, relancer les vérifications 3 et 4.
        - Si la réparation échoue, lever `errored`.
     b. Si Git < 2.31, lever `errored` (le lien est cassé et la
        version de Git ne permet pas de le réparer).

  Toute erreur levée dans ce mode ne doit jamais altérer le disque.

* **`skipSetup = false` (avec `workspaceRoot` préexistant) :**
  1. Valider le lien `.git` du workspace et s'assurer que la branche
     `work/<runId>` existe.
  2. Vérifier que la branche active est bien `work/<runId>` :
     `git -C <workspaceRoot> branch --show-current`. Si divergence,
     tenter `git -C <workspaceRoot> checkout work/<runId>`. Si échec,
     considérer le workspace comme corrompu.
  3. Valider la continuité d'historique :
     `git merge-base --is-ancestor <baseHeadSha> HEAD`.
  4. Si un patch a été adopté :
     a. Vérifier que le fichier patch existe et est lisible. Si absent,
        lever `errored` (corruption d'artefact).
     b. Vérifier s'il a déjà été appliqué via
        `git apply --reverse --check <patch>`. Si oui, valider l'état
        porcelain filtré sur les fichiers du patch. Si non appliqué,
        tenter de l'appliquer à l'étape 1.5.
  5. Si cohérent, l'adopter. Si corrompu ou incohérent, tenter la
     reconstruction **une seule fois**. Un compteur de tentatives est
     maintenu dans le `BootstrapTaskCheckpoint` (`retryAttempt`). Si
     `retryAttempt > 1`, lever `errored` sans reconstruction (pas de
     boucle infinie). Nettoyer dans cet ordre strict avant de
     reconstruire (étapes 1.4-1.6) :
     a. `git worktree unlock <workspaceRoot>` (si verrouillé).
     b. `git worktree remove --force <workspaceRoot>` — tenter de
        désenregistrer le workspace côté dépôt principal.
     c. `git worktree prune` — **impératif** après toute tentative de
        suppression, pour nettoyer les métadonnées orphelines sous
        `.git/worktrees/` dans le dépôt principal. Sans cette étape,
        Git conservera des descripteurs périmés qui bloqueront les
        tentatives futures de recréer le workspace.
     d. **Containment préalable obligatoire :** avant toute suppression
        physique, vérifier que le chemin résolu de `workspaceRoot` est
        strictement sous le namespace du run (`runDir`). Si violation,
        lever `errored` — ne jamais exécuter `rm -rf` hors du run.
        Supprimer physiquement le dossier résiduel (`rm -rf
        <workspaceRoot>`) **uniquement en dernier recours** si le
        dossier persiste après les étapes b et c.
     e. Vérifier que `git worktree list` ne référence plus
        `workspaceRoot`. Si encore présent, lever `errored` —
        corruption du dépôt principal non résolue.

> En stratégie sandbox, le cleanup est délégué à la destruction du
> conteneur. Les étapes b et c (`git worktree remove`,
> `git worktree prune`) sont absentes en mode sandbox.

---

## 2. Invariants spécifiques à la stratégie worktree

### 2.1 Résolution des chemins (`realpath`)
Avant `git worktree add`, résoudre le **parent** de `workspaceRoot` via
`realpath` et y apposer le basename de `workspaceRoot`. Après création,
résoudre `workspaceRoot` via `realpath` pour usage ultérieur et vérifier
la correspondance avec le chemin attendu. Ce protocole en deux temps évite
l'échec de `realpath` sur macOS (où la commande n'accepte pas les chemins
inexistants, pas de `--canonicalize-missing`) tout en garantissant qu'aucun
symlink n'est écrit dans les pointeurs internes de Git.

Cet invariant est spécifique à la stratégie worktree ; un clone standard
(sandbox) a un `.git` autonome insensible aux symlinks du parent.

### 2.2 Nettoyage physique au retry
Les étapes de nettoyage (§1.7.b/c/d) utilisent `git worktree remove
--force` et `git worktree prune` pour désenregistrer le workspace côté
dépôt principal. Ces commandes sont spécifiques à la stratégie worktree.
En stratégie sandbox, le nettoyage est délégué à la destruction du
conteneur.

### 2.3 Prérequis Git
La stratégie worktree nécessite :
- Git ≥ 2.18 pour `git worktree remove --force`
- Git ≥ 2.31 pour `git worktree repair` (mode diagnostic)

Ces versions minimales sont validées par `run-init` via la bootstrap task
`prerequisite-validation`, avant toute tâche utilisant Git.
`workspace-setup` suppose cette précondition satisfaite et ne re-vérifie
pas.

---

## 3. Opérations internes

- `verify-canonical-repository`
- `initialize-git-repo-and-remote` (si dépôt vide ; suppose Git ≥ 2.18
  validé par `prerequisite-validation`)
- `determine-base-git-pointers` (`baseHeadSha`, `baseBranch`,
  `defaultTargetBranch`)
- `create-work-branch`
- `create-physical-workspace` (via `git worktree add`)
- `init-submodules` (si `.gitmodules` présent)
- `init-git-lfs` (si `.gitattributes` avec filtre LFS)
- `apply-dirty-patch-into-workspace`
- `write-work-session-evidence`
- `persist-execution-record`

---

## 4. Failure modes

> Cette table liste les failure modes **spécifiques à la stratégie
> worktree**. Pour les failure modes transverses (indépendants de la
> stratégie), voir [`workspace-setup.md` §8](./workspace-setup.md#8-failure-modes).

| Pipeline | Échec rencontré | Statut | Action |
|---|---|---|---|
| 1.1.1 | `git rev-parse --show-toplevel` ≠ `realpath(canonicalRepositoryRoot)` | `failed` | Arrêt |
| 1.1.2 | `core.worktree` non vide dans le dépôt source | `failed` | Arrêt — incompatible worktree |
| 1.2.6 | Création du dépôt distant échouée (nom déjà pris) | `errored` | Arrêt |
| 1.2.8 | `git push -u origin <defaultBranch>` échoue | `errored` | Arrêt |
| 1.3 | `origin` remote absent | `failed` | Arrêt |
| 1.3 | Aucun `origin/HEAD` ni fallback `main`/`master` | `failed` | Arrêt |
| 1.4 | `git worktree prune` pré-nettoyage échoue | `errored` | Arrêt — dépôt principal instable |
| 1.4.1 | Branche `work/<runId>` existe déjà sans checkpoint valide | `failed` | Arrêt — collision runId |
| 1.4.4 | `git worktree add` échoue (chemin occupé par dossier étranger) | `errored` | Arrêt |
| 1.4.4 | `git worktree add` échoue (disque plein) | `errored` | Arrêt |
| 1.4.4 | `git worktree add` échoue (permission denied) | `errored` | Arrêt |
| 1.4.4 | `git worktree add` échoue (erreur Git interne) | `errored` | Arrêt |
| 1.4.5 | `realpath(workspaceRoot)` post-création ≠ `resolvedWorkspaceRoot` | `errored` | Arrêt |
| 1.4bis.1 | `git submodule update --init` échoue | `errored` | Arrêt |
| 1.4bis.2 | `git-lfs` non installé | `failed` | Arrêt — dépendance manquante |
| 1.4bis.2 | `git lfs pull` échoue | `errored` | Arrêt |
| 1.5.1 | `git apply --check` échoue | `failed` | Arrêt — patch incompatible |
| 1.5.2 | `git apply --binary` échoue | `failed` | Arrêt |
| 1.7.4.a | Fichier patch absent alors que dirty state déclaré | `errored` | Arrêt — corruption d'artefact |
| 1.7.5 | `retryAttempt > 1` (boucle cleanup → rebuild) | `errored` | Arrêt — reconstruction impossible |
| 1.7.5.b | `git worktree remove --force` échoue (workspace inconnu de Git) | `errored` | Passer à 1.7.5.c |
| 1.7.5.c | `git worktree prune` échoue | `errored` | Arrêt — corruption du dépôt principal |
| 1.7.5.d | Dossier résiduel persiste après 1.7.5.b et 1.7.5.c | `errored` | Arrêt — conflit de chemin non résolu |
| 1.7.5.e | `git worktree list` référence encore `workspaceRoot` après nettoyage | `errored` | Arrêt — corruption non résolue |

---

## 5. Cleanup post-run

Le cleanup du workspace privé après succès du run est hors périmètre de
`workspace-setup`. Il relève de la phase de finalisation du workflow
(après merge, packaging, ou abandon documenté). Voir
[`multi-agent-concurrency.md` §7](../../standards/multi-agent-concurrency.md#7-nettoyage)
pour les règles de conservation.

Le protocole de suppression est identique à §1.7.5.a-e (unlock → remove
→ prune → suppression physique → vérification).

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
