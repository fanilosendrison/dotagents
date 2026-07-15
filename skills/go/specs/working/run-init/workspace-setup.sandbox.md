# Stratégie OCI Sandbox (Docker/OrbStack) — `workspace-setup`

> **Stratégie d'implémentation du contrat [`workspace-setup`](./workspace-setup.md).**
> Ce document décrit le pipeline physique basé sur un conteneur OCI (OrbStack/Docker)
> avec montage de volume (Volume-Mount) et isolation réseau.
> Voir [ADR-go-workspace-agnostic-terminology.md](../../adr/ADR-go-workspace-agnostic-terminology.md)
> pour le contexte d'indépendance de la stratégie.

---

## 1. Objectif

Créer un espace de travail sécurisé et confiné dans un conteneur OCI. Cette
stratégie utilise le montage de volume (Volume-Mount) pour exposer le code
source au conteneur tout en maintenant les secrets d'authentification Git (PAT,
clés SSH) confinés sur l'hôte, et en bloquant physiquement (au niveau noyau via
montage Read-Only) toute mutation non autorisée du dépôt parent.

---

## 2. Prérequis techniques

La stratégie sandbox nécessite que les composants suivants soient disponibles
sur l'hôte :
- **Runtime OCI** : OrbStack (recommandé sur macOS pour le mappage
  d'utilisateurs dynamique) ou Docker Engine (≥ 20.10).
- **Git** : Version ≥ 2.18 sur l'hôte pour le support des commandes de
  worktree.

Ces dépendances doivent être validées en amont par la tâche
`prerequisite-validation`.

---

## 3. Image OCI du Workspace

Le conteneur utilise une image contenant l'ensemble des dépendances nécessaires
pour compiler, tester et analyser le projet.

### 3.1 Image par défaut (Générique)
Par défaut, `/go` utilise une image générique minimale hébergée par le registre
VegaCorp :
`ghcr.io/vegacorp/go-sandbox-env:latest`
Elle intègre : Node.js, Bun, Python, Go, Git (sans clés ni configuration
globale), curl et les outils de compilation essentiels (`build-essential`).

### 3.2 Personnalisation par projet
Un projet peut remplacer l'image par défaut de deux manières :
1. **Automatique** : Présence d'un dossier `.devcontainer/` ou d'un
   `Dockerfile.dev` à la racine du dépôt.
2. **Explicite** : Déclaration dans la politique locale `WorkflowPolicy` :
   ```json
   {
     "sandbox": {
       "image": "my-custom-image:1.0",
       "network": "none"
     }
   }
   ```

### 3.3 Pré-chargement (Pre-pull)
Au premier démarrage du workflow `/go`, l'image sélectionnée est pré-téléchargée
(`docker pull`) pendant la phase `prerequisite-validation` afin d'éviter des
timeouts lors du premier run.

---

## 4. Architecture de montage et Variables Git

Pour permettre aux outils du conteneur (Jest, ESLint, etc.) d'interroger l'état
Git (ex: `git diff`) sans exposer le dépôt principal en écriture, le conteneur
utilise un triplet de montages et de variables d'environnement.

### 4.1 Configuration des montages et variables

| Variable         | Contenu                                          | Montage                    |
|------------------|--------------------------------------------------|----------------------------|
| `GIT_WORK_TREE`  | `workspaceRoot` (fichiers de travail)            | Volume RW (`/workspace`)   |
| `GIT_DIR`        | `.git/worktrees/work-<runId>/` (index, HEAD)     | Volume RW (`/worktree-git`)|
| `GIT_COMMON_DIR` | `.git/` (dépôt principal : objets, refs)         | Volume RO (`/parent-git`)  |

---

## 5. Alignement avec les extrants du contrat parent

La stratégie sandbox s'intègre au cycle de vie global en produisant les
artefacts de preuve requis par le contrat parent
([`workspace-setup.md`](./workspace-setup.md) §4). L'enveloppe
`WorkspaceSetupEvidence` est écrite sous
`artefactRoot/startup/workspace-setup/work-session.json` et contient :

| Extrant attendu           | Rôle et modalité de production par la stratégie                         |
|---------------------------|-------------------------------------------------------------------------|
| `workSession`             | `WorkSession` complet, écrit sur l'hôte après création du worktree.     |
| `dirtyStateDiffAdoption`  | Présent si `DirtyStateDiffArtifact` indique `"dirty"` et replay réussi. |
| `createdDirectories`      | Contient `[workspaceRoot]` (le répertoire de travail créé sur l'hôte).  |
| `workspaceProjectRoot`    | Chemin absolu du sous-projet dans le workspace (si applicable).         |

Un `BootstrapTaskCheckpoint` (`task-record.json`) et un
`WorkflowExecutionRecord` sont également persistés.

---

## 6. Gestion des primitives Git dans le conteneur

### 6.1 Primitives autorisées (Lecture seule)
L'agent d'implémentation et ses outils peuvent interroger librement l'état du
dépôt :
- `git diff`, `git status`, `git log`, `git show`, `git rev-parse`
- `git diff --name-only`, `git diff --cached` (l'écriture locale de l'index se
  fait dans `/worktree-git` qui est monté en RW).
- Toute opération de lecture sur les objets (`objects/`) et les références
  (`refs/`).

### 6.2 Primitives bloquées (Garantie Filesystem)
Le noyau rejette matériellement toute tentative d'altération du dépôt
principal :
- `git commit`, `git push`, `git fetch`, `git pull`
- `git branch -D/-m`, `git tag`, `git reset --hard`
Le blocage est assuré par le montage en lecture seule de `/parent-git` sur
l'hôte, et non par une règle de configuration Git contournable.

### 6.3 Ajustements Git pour le mode lecture seule
Pour éliminer les alertes d'écritures de logs d'historique et de gc
automatique lors des opérations autorisées, les variables d'environnement
suivantes sont injectées dans le conteneur :
```bash
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=gc.auto
export GIT_CONFIG_VALUE_0=0
export GIT_CONFIG_KEY_1=core.logAllRefUpdates
export GIT_CONFIG_VALUE_1=false
```

---

## 7. Gestion de l'identité des processus (UID/GID)

Pour éviter que les fichiers générés par le conteneur n'appartiennent à `root`
(ce qui bloquerait le nettoyage et l'édition sur le host), la stratégie de
gestion d'identité est la suivante :

### 7.1 Mode OrbStack (Natif)
OrbStack mappe automatiquement l'utilisateur root du conteneur avec l'UID de
l'utilisateur hôte via son mécanisme natif de namespace (`userns-remap`).
Aucune configuration supplémentaire n'est requise.

### 7.2 Mode Docker Fallback
Sur Docker Engine standard, le conteneur est lancé avec la directive
`--user $(id -u):$(id -g)`. L'entrypoint du conteneur intègre un wrapper de
démarrage chargé d'injecter l'utilisateur dans les tables d'identité de la
sandbox :
```bash
if ! getent passwd "$(id -u)" > /dev/null 2>&1; then
    echo "agent:x:$(id -u):$(id -g):Agent Sandbox:/workspace:/bin/sh" >> /etc/passwd
    echo "agent:x:$(id -g):" >> /etc/group
fi
export HOME=/workspace
export USER=agent
exec "$@"
```
Ce wrapper garantit que les outils comme `npm`, `cargo`, `pip` ou `jest`
s'exécutent avec des variables `$HOME` et `$USER` cohérentes et fonctionnelles.

---

## 8. Pipeline logique et étapes détaillées

### 8.0 Initialisation du dépôt (si nécessaire)
Si aucun dépôt Git n'existe à `canonicalRepositoryRoot`, exécuter le protocole
d'initialisation identique à la stratégie worktree (voir
[`workspace-setup.worktree.md`](./workspace-setup.worktree.md) §1.2) : `git
init`, premier commit, création du dépôt distant via API provider, association
du remote `origin`, et `git push -u origin <defaultBranch>`. Cette
initialisation s'exécute intégralement sur l'hôte, avant toute création de
worktree ou démarrage de conteneur.

### 8.1 Création du worktree host-side
1. Résoudre le parent de `workspaceRoot` via `realpath`, puis y apposer le
   basename pour construire `resolvedWorkspaceRoot`. Ce protocole est identique
   à la stratégie worktree (voir
   [`workspace-setup.worktree.md`](./workspace-setup.worktree.md) §2.1).
2. Créer la branche de travail `work/<runId>` depuis `baseHeadSha` via
   `git branch` (sans checkout).
3. Exécuter `git worktree add <resolvedWorkspaceRoot> work/<runId>` sur l'hôte.
4. Vérifier post-création que `realpath(workspaceRoot)` correspond au chemin
   attendu (comparaison normalisée à la casse du filesystem).
5. Verrouiller le workspace :
   `git worktree lock <workspaceRoot> --reason "go-run:<runId>"`.
6. Initialiser les submodules (`git submodule update --init --recursive`) et
   Git LFS (`git lfs pull`) si nécessaire, en neutralisant les hooks via
   `-c core.hooksPath=/dev/null`.

### 8.2 Application du dirty-state
1. Si `DirtyStateDiffArtifact` indique `"dirty"`, appliquer le patch sur
   l'hôte dans le workspace :
   `git -C <workspaceRoot> -c core.hooksPath=/dev/null apply --binary <patch>`.
2. Capturer `git status --porcelain` post-application.
3. Enregistrer `DirtyStateDiffAdoption` (avec `captureArtifactId`,
   `replayStatus: "applied"`, `replayedAt`) dans l'artefact
   `work-session.json`.

### 8.3 Démarrage du conteneur
1. Résoudre l'image OCI à utiliser (configuration locale `WorkflowPolicy` >
   `.devcontainer/` ou `Dockerfile.dev` > image par défaut).
2. Résoudre l'UID/GID courant de l'hôte pour le mode Docker fallback (§7.2).
3. Lancer le conteneur en mode détaché avec maintien en vie :
   ```bash
   docker run -d \
     -v <workspaceRoot>:/workspace \
     -v <gitDir>:/worktree-git \
     -v <gitCommonDir>:/parent-git:ro \
     -w /workspace \
     --network bridge \
     --rm \
     --name go-sandbox-<runId> \
     -e GIT_WORK_TREE=/workspace \
     -e GIT_DIR=/worktree-git \
     -e GIT_COMMON_DIR=/parent-git \
     -e GIT_CONFIG_COUNT=2 \
     -e GIT_CONFIG_KEY_0=gc.auto \
     -e GIT_CONFIG_VALUE_0=0 \
     -e GIT_CONFIG_KEY_1=core.logAllRefUpdates \
     -e GIT_CONFIG_VALUE_1=false \
     <image> tail -f /dev/null
   ```
   Le `tail -f /dev/null` maintient le conteneur en vie pour les `docker exec`
   ultérieurs. En mode OrbStack natif, le flag `--user` est omis (userns-remap
   automatique). En mode Docker fallback, ajouter `--user $(id -u):$(id -g)`.
   Si la policy `WorkflowPolicy.sandbox.network` vaut `"none"`, remplacer
   `--network bridge` par `--network none`.
4. Valider que le statut du conteneur est `running` :
   `docker ps --filter "name=go-sandbox-<runId>" --format '{{.Status}}'`.

### 8.4 Exécution des commandes de stage
1. Transmettre les commandes à exécuter au conteneur via
   `docker exec -w /workspace go-sandbox-<runId> <cmd>`.
2. Les logs et preuves de stage sont écrits sous `artefactRoot/` sur l'hôte
   (hors conteneur).
3. Le stage harness utilise `workDir = workspaceRoot` (chemin host) pour ses
   validations de fin de stage (`trackedWorktreeHash`, `worktreeClean`).

### 8.5 Destruction et nettoyage
1. Envoyer un signal d'arrêt au conteneur :
   `docker stop --time 10 go-sandbox-<runId>` (SIGTERM, puis SIGKILL après
   timeout de 10 secondes).
2. Supprimer de force si le conteneur persiste :
   `docker rm -f go-sandbox-<runId>`.
3. Nettoyer le worktree sur l'hôte selon le protocole standard :
   `git worktree unlock <workspaceRoot>`, `git worktree remove --force
   <workspaceRoot>`, `git worktree prune`, suppression physique avec
   containment check (`rm -rf <workspaceRoot>` uniquement si le chemin est
   sous `runDir`).

---

## 9. Gestion des retours (Retries) et de `skipSetup`

Le comportement de reprise est piloté par la valeur de `skipSetup` :

### 9.1 `skipSetup = true` (Diagnostic uniquement)
La tâche effectue des vérifications de diagnostic sur l'hôte sans démarrer de
conteneur ni altérer le disque :
- Valider que le répertoire `workspaceRoot` existe sur l'hôte.
- Valider la cohérence du lien `.git` du worktree.
- Valider que la branche active correspond à `work/<runId>`.
- Valider la continuité d'historique :
  `git merge-base --is-ancestor <baseHeadSha> HEAD`.
- Si le lien `.git` est cassé, tenter `git worktree repair <workspaceRoot>`
  (Git ≥ 2.31).

### 9.2 `skipSetup = false` (Reconstruction au retry)
En cas de retry de tâche demandant une reconstruction :
1. Supprimer de force tout conteneur résiduel :
   `docker rm -f go-sandbox-<runId>` (ignore les erreurs si le conteneur
   n'existe pas).
2. Nettoyer le worktree sur l'hôte selon le protocole standard (unlock →
   remove → prune → suppression physique avec containment check).
3. Relancer le pipeline complet à partir de l'étape 8.0.
4. Un compteur `retryAttempt` est maintenu dans le `BootstrapTaskCheckpoint`.
   Si `retryAttempt > 1`, lever `errored` sans reconstruction (pas de boucle
   infinie).

### 9.3 Composition du Hash de Checkpoint
La stratégie sandbox **étend** la composition de l'`inputHash` définie par le
contrat parent ([`workspace-setup.md`](./workspace-setup.md) §6.8). En plus des
champs standards (`runId`, `RepoCapture`, `dirtyStateDiffHash`, `artefactRoot`,
`workspaceRoot`, `skipSetup`), le digest de l'image OCI est inclus.
L'identifiant est obtenu via `docker image inspect --format '{{.ID}}'
<image>`. Toute modification de l'image de base invalide le checkpoint et
déclenche une reconstruction complète au prochain run.

L'`inputHash` est l'empreinte JCS du sous-ensemble canoniquement ordonné de
ces champs. Les deux hashes sentinelles (`workflowPolicyHash`,
`captureContextHash`) conservent leur comportement standard défini par le
contrat parent.

---

## 10. Invariants de sécurité : Confinement strict des secrets

Le conteneur ne reçoit **jamais** :
- Le token d'authentification Git (`GIT_ASKPASS` n'est pas monté,
  `GITHUB_TOKEN` n'est pas injecté).
- Les clés SSH du host (`~/.ssh` n'est pas monté).
- Les fichiers de configuration sensibles du host (`~/.gitconfig`, `~/.npmrc`,
  `~/.netrc`).
- Les variables d'environnement du host (le conteneur démarre avec un
  environnement vierge ; seules les variables Git explicitées aux §4.1 et §6.3
  sont injectées).

Cet invariant est conforme à
l'[ADR-GO-TOKEN-PROPAGATION-GIT-ASKPASS](../../adr/ADR-go-token-propagation-git-askpass.md).
Toute opération nécessitant une authentification (commit, push, création de PR)
est exécutée sur l'hôte **après** destruction du conteneur.

---

## 11. Failure modes spécifiques

| Pipeline | Échec rencontré                                            | Statut    | Action                    |
|----------|------------------------------------------------------------|-----------|---------------------------|
| 3        | Image introuvable ou échec du pull                         | `failed`  | Arrêt                     |
| 8.0      | Échec de l'initialisation du dépôt (`git init`, remote)    | `errored` | Arrêt                     |
| 8.1      | `git worktree add` échoue (chemin occupé, disque plein)    | `errored` | Arrêt                     |
| 8.2      | Patch dirty-state incompatible (`git apply --check`)       | `failed`  | Arrêt                     |
| 8.3      | Échec du démarrage du conteneur (daemon indisponible)      | `errored` | Arrêt                     |
| 8.3      | Image OCI introuvable localement après pull                | `failed`  | Arrêt                     |
| 8.4      | Échec d'une commande de stage dans le conteneur            | `failed`  | Arrêt ou remédiation      |
| 8.5      | Échec de la destruction du conteneur                       | `errored` | Nettoyage forcé           |
| 8.5.3    | Dossier worktree résiduel après `remove --force` + `prune` | `errored` | Vérification containment  |
| 9.2      | `retryAttempt > 1` (boucle reconstruction)                 | `errored` | Arrêt sans reconstruction |

---

## 12. Non-goals

- Transmettre ou stocker des tokens Git ou SSH à l'intérieur du conteneur.
- Supporter la persistance à long terme des conteneurs après la fin d'un run
  `/go`.
- Autoriser l'agent à reconfigurer le daemon Docker de l'hôte.
- Remplacer le protocole de nettoyage du worktree host-side (le worktree reste
  créé sur l'hôte et doit être nettoyé selon le protocole standard).

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
