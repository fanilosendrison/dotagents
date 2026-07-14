---
id: ADR-GO-REPO-CAPTURE-ROBUSTNESS
type: adr
version: "1.0.0"
scope: go-workflow/run-init/repo-capture
status: active
supersedes: []
superseded_by: []
---

# ADR - Robustesse de la détection du dépôt cible dans `repo-capture`

VegaCorp - July 2026

---

## Contexte

`repo-capture` est la première bootstrap task séquentielle de `run-init`. Elle
résout le dépôt Git cible uniquement via des opérations filesystem locales
(`realpath`, `stat`, lecture de fichiers), sans exécuter `git`. Sa mission est
de produire un `RepoCapture` valide avant que les tâches parallèles
(`workspace-setup`, `repo-discovery-draft`, `run-capture`) ne démarrent.

L'algorithme initial présentait quatre angles morts :

1. **`.git` fichier ignoré** : la recherche ascendante ne considérait que les
   dossiers `.git/`, ignorant les fichiers `.git` utilisés par les worktrees
   Git et les sous-modules (contenant `gitdir: <path>`). Un `/go` invoqué
   depuis l'intérieur d'un worktree existant n'aurait pas détecté le dépôt.
2. **Dépôts Bare non filtrés** : un dépôt configuré avec `core.bare = true`
   n'a pas de working tree et ne peut pas recevoir de `git worktree add`. Sans
   détection, `workspace-setup` échouerait plus tard avec une erreur peu
   claire.
3. **Garde-fou anti-`git init` sauvage absent** : si aucun dépôt n'est trouvé,
   `repo-capture` délègue la création à `workspace-setup`. Sans vérification,
   un `/go` invoqué depuis `~` ou `/` déclencherait un `git init` suivi d'un
   `git add -A` sur des milliers de fichiers personnels ou système.
4. **Détection de gateway par sous-chaîne** : la vérification des sentinelles
   (`.agents`, `.codex`, `.pi`, `.gravity`) utilisait une logique de
   sous-chaîne sur le chemin, produisant des faux positifs (ex: `.pi` dans
   `api/` ou `spine/`, `AGENTS.md` dans `PROJECT-AGENTS.md`).

---

## Décision

### 1. Support des entrées `.git` fichier et rejet des dépôts Bare

La recherche ascendante cible désormais toute **entrée `.git`** (dossier ou
fichier régulier), et non plus exclusivement les dossiers `.git/`.

- Si l'entrée est un **dossier** : vérifier `core.bare` dans `.git/config`
  (lecture directe, sans `git`). Si `bare = true`, rejeter immédiatement.
- Si l'entrée est un **fichier** (worktree ou sous-module) : lire le lien
  `gitdir:` qu'il contient pour localiser les métadonnées réelles du dépôt
  principal et déterminer la racine physique du dépôt.

Le rejet des dépôts Bare est justifié par l'incompatibilité avec
`git worktree add` — pierre angulaire de l'isolation physique du run.

### 2. Garde-fou de sécurité sur les répertoires système et utilisateur

Avant de déléguer un `git init` à `workspace-setup`, `repo-capture` vérifie
que le répertoire résolu n'est **pas** un chemin système racine ou le
répertoire personnel de l'utilisateur :

- Chemins refusés : `/`, `/Users`, `/home`, `$HOME` (`os.homedir()`)
- Statut de rejet : `failed` (sécurité)

Le rejet explicite guide l'utilisateur vers un sous-dossier projet approprié.
Aucun seuil arbitraire de nombre de fichiers n'est retenu — un template
fraîchement généré peut légitimement contenir 100+ fichiers sans être un
répertoire système.

### 3. Détection de gateway par composant de chemin exact

La vérification des sentinelles passe d'une logique de sous-chaîne à une
logique de composant exact :

- **Dossiers** : un segment de chemin complet est comparé aux noms sentinelles
  (`.agents`, `.codex`, `.pi`, `.gravity`). Le segment `.pi` dans un chemin
  `api/` n'est pas confondu avec le dossier `.pi`.
- **Fichiers** : seuls les fichiers directement enfants de
  `invocationDirectory` dont le `basename` exact est `AGENTS.md`, `SKILL.md`,
  `CODEX.md`, ou `GRAVITY.md` sont considérés comme sentinelles.

---

## Conséquences

- **Worktrees et sous-modules** : un `/go` invoqué depuis un worktree Git
  existant détecte désormais correctement le dépôt parent.
- **Dépôts Bare** : rejet précoce avec un message clair, plutôt qu'un échec
  cryptique dans `workspace-setup`.
- **Sécurité hôte** : `git init` accidentel sur `~` ou `/` est impossible.
  L'utilisateur reçoit une invitation explicite à se placer dans un
  sous-dossier projet.
- **Précision des gateways** : aucun faux positif sur des projets nommés
  `api/`, `spine/`, `my-agents/` ou contenant `PROJECT-AGENTS.md`.
- **Rétrocompatibilité** : aucun changement de contrat du `RepoCapture`. Les
  champs et le schéma restent identiques. Seul l'algorithme de résolution
  interne est affiné.

---

## Alternatives rejetées

### Suivre `gitdir:` uniquement dans `workspace-setup`

Rejeté. Retarder la résolution au moment de `workspace-setup` contredit la
mission de `repo-capture` : fournir un `canonicalRepositoryRoot` fiable avant
le démarrage des tâches parallèles. `workspace-setup` consomme ce champ pour
créer le worktree — le lui faire découvrir en cours de route créerait une
dépendance cyclique ou une duplication de logique.

### Seuil de nombre de fichiers comme garde-fou

Rejeté. Un seuil fixe (ex: 50 fichiers) est arbitraire et produirait des faux
positifs sur des projets légitimes générés depuis un template. La liste des
« fichiers de configuration système à exclure » est infinie et dépendante de
l'OS. Le rejet explicite des chemins système racine et du `$HOME` est
suffisant, non ambigu, et ne bloque aucun cas d'usage légitime.

### Laisser `git init` échouer naturellement dans `workspace-setup`

Rejeté. L'échec surviendrait après le `git add -A`, potentiellement après
avoir indexé des données sensibles dans l'index Git local. Le fail-fast dans
`repo-capture` empêche toute opération Git sur un répertoire non autorisé.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
