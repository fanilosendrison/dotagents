---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cubits-design-doc"
workspace: "go"
date: "2026-07-17"
step_id: 0
id: CDD-GO-PREREQUISITE-VALIDATION
version: "1.0.0"
scope: run-init
status: extracted-archive
consumers: [agent-generator]
superseded_by: [NIB-M-GO-PREREQUISITE-VALIDATION]
---

# Startup task `prerequisite-validation`

`prerequisite-validation` vérifie que les conditions minimales d'exécution
de `/go` sont satisfaites avant toute autre opération. C'est la toute première
bootstrap task de `run-init`, exécutée en fail-fast.

Elle couvre deux prérequis indépendants :
1. La configuration fournisseur (`ProviderConfig`)
2. La version de Git

Elle n'interagit pas avec le réseau (hormis la validation syntaxique du
token) et ne crée pas de ressources : elle lit, valide, et réussit ou échoue.

---

## 1. Objectif

Garantir que l'environnement d'exécution est viable avant que `run-init`
ne projette le `runId` dans le `WorkflowState` de `/go`, ne réserve le
worktree physique, ou ne lance les autres branches de bootstrap.

Si un prérequis est absent ou invalide, le run échoue immédiatement avec
`errored` ou `failed`, sans effet de bord.

---

## 2. Position dans le workflow

`prerequisite-validation` est la première bootstrap task de `run-init`. Elle
s'exécute de manière séquentielle et synchrone, avant `repo-capture`.

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

Elle ne dépend d'aucune autre bootstrap task et ne consomme aucun artefact.

---

## 3. Inputs

Aucun input dynamique du run en dehors de ceux nécessaires à l'écriture
du checkpoint :

- `runId` (fourni par Turnlock)
- `artefactRoot` (réservé par `run-init` — utilisé uniquement pour écrire le
  checkpoint et l'evidence en cas d'échec)

Les prérequis sont lus depuis des sources statiques :

- **ProviderConfig** : `~/.go/config.json` (résolu via `realpath`)
- **Git** : `git --version` (PATH système)

La tâche ne dépend pas de `BootstrapState`, `RepoCapture`, `WorkSession`,
ou de toute autre sortie de bootstrap task.

---

## 4. Outputs

Artefact métier écrit sous
`artefactRoot/startup/prerequisite-validation/prerequisite-validation.json` :

```ts
type PrerequisiteValidation = {
  schema: "go.prerequisite-validation.v1";
  runId: string;
  provider: "github" | "gitlab";
  username: string;
  defaultVisibility: "private" | "public";
  apiEndpoint?: string;
  gitVersion: string;
  validatedAt: string;
};
```

Le token n'est **jamais** écrit dans l'artefact, les logs, ou le
`WorkflowState`. Seuls les champs non-sensibles sont transcrits.

`gitVersion` contient la sortie brute de `git --version` (ex: `git version
2.45.0`).

---

## 5. Pipeline

Les étapes s'enchaînent dans l'ordre suivant. L'échec de l'une stoppe le
pipeline immédiatement.

### 5.0 Vérification de la version Git

1. Exécuter `git --version`. Si la commande échoue (Git non installé ou
   injoignable), lever `errored`.
2. Parser le numéro de version. Si la version est < 2.18, lever `failed`
   (prérequis worktree non satisfait : `git worktree remove --force`
   nécessite Git ≥ 2.18).

Ce check est placé en première position pour garantir un fail-fast
explicite avant `dirty-state-capture` (première tâche exécutant des
commandes Git sur le dépôt source).

### 5.1 Localisation du fichier ProviderConfig

1. Étendre le chemin en remplaçant le tilde `~` par le répertoire personnel de
   l'utilisateur (`os.homedir()` ou équivalent `HOME`/`USERPROFILE`), puis
   résoudre le chemin résultant via `realpath`.
2. Vérifier que le fichier existe (`fs.stat`).
3. Vérifier les permissions : `600` (lecture/écriture propriétaire uniquement)
   sur les systèmes POSIX (Linux, macOS). Ignorer ce contrôle spécifique sur
   Windows. Si les permissions sont plus permissives sur POSIX, émettre un
   avertissement mais ne pas échouer.
4. Si le fichier est absent → `failed`.

### 5.2 Parsing et validation du schéma ProviderConfig

1. Lire le contenu brut du fichier.
2. Parser le JSON. Si parsing échoue → `failed`.
3. Valider contre le schéma `ProviderConfig` :
   ```ts
   type ProviderConfig = {
     provider: "github" | "gitlab";
     token: string;
     username: string;
     defaultVisibility: "private" | "public";
     apiEndpoint?: string;
   };
   ```
   - `provider` : doit être `"github"` ou `"gitlab"`
   - `token` : string non-vide + validation syntaxique selon le provider :
     - Pour `"github"` : le token doit commencer par l'un des préfixes
       officiels (`ghp_`, `github_pat_`, `gho_`, `ghs_`, `ghu_`).
     - Pour `"gitlab"` : le token doit commencer par `glpat-`.
     - Tout token contenant une valeur de substitution par défaut
       (ex: `YOUR_TOKEN_HERE`, `TODO`) ou ne respectant pas le format du
       provider est rejeté → `failed`.
   - `username` : string non-vide
   - `defaultVisibility` : `"private"` ou `"public"`
   - `apiEndpoint` : optionnel. Si présent, doit être une URL absolue
     parseable (protocole `http` ou `https` et hostname requis). Si absent,
     l'endpoint SaaS public du provider est utilisé par défaut
     (`https://api.github.com` ou `https://gitlab.com/api/v4`).
   - Champs supplémentaires non déclarés → `failed`

### 5.3 Écriture de l'artefact

1. Créer le sous-dossier
   `artefactRoot/startup/prerequisite-validation/`.
2. Écrire `prerequisite-validation.json` (artefact métier, sans le token,
   incluant `gitVersion`).
3. Persister le `BootstrapTaskCheckpoint` et le `WorkflowExecutionRecord`.

---

## 6. Règles & Invariants

### 6.1 Fail-fast

L'échec de cette tâche doit survenir avant toute allocation de ressources par
`repo-capture` ou `workspace-setup`. Aucun `runId` n'est projeté dans le
`WorkflowState` de `/go`, aucun worktree n'est réservé, et aucune autre
branche de bootstrap n'est démarrée. Le `runDir` et l'`artefactRoot` déjà
alloués par Turnlock en amont ne servent qu'à consigner le checkpoint
d'échec pour audit.

### 6.2 Non-divulgation du token

Le token d'authentification (`ProviderConfig.token`) ne doit jamais apparaître
dans :
- `PrerequisiteValidation` (l'artefact métier)
- `StateFile` ou `WorkflowState`
- Les logs, stdout, ou stderr
- Les messages d'erreur
- Les fichiers d'evidence

En cas d'échec de validation, le message d'erreur peut indiquer qu'un token est
manquant ou invalide, mais ne doit jamais afficher la valeur du token.

**Note d'implémentation :** Le token d'authentification valide est conservé
uniquement en mémoire par le processus exécuteur de Turnlock. Sa propagation
aux tâches aval suit deux mécanismes distincts :

- **Opérations Git (`push`, `clone`, `fetch`) :** Utilisation de
  `GIT_ASKPASS` avec un script éphémère généré par Turnlock qui écrit le
  token sur stdout. Le token n'est jamais injecté comme variable
  d'environnement persistante, ce qui empêche toute fuite accidentelle via
  des sous-processus arbitraires (linter, test runner, build tool) qui
  pourraient dumper leur environnement dans un log ou un crash report.

- **Appels API REST (créer un dépôt distant, ouvrir une PR, lire le statut
  CI) :** Passage explicite du token en paramètre de fonction au niveau du
  client HTTP, sans écriture dans l'environnement ni dans un fichier
  temporaire.

Ces deux mécanismes garantissent que le token reste immuable pour la durée
du run et ne peut pas fuiter vers des processus non contrôlés par Turnlock,
même si le fichier `~/.go/config.json` est modifié sur le disque par un
processus externe.

### 6.3 Immutabilité par run

`ProviderConfig` est une configuration statique d'installation. Sa valeur est
immuable pour la durée d'un run. Aucune bootstrap task ou stage ne peut la
modifier. La version de Git installée est également considérée comme immuable
pour la durée du run.

### 6.4 Obligatoire pour tous les runs

`ProviderConfig` est requis même si le dépôt cible existe déjà et possède un
remote `origin`. Les stages aval (`package-and-publish`, `pr-ci-review`)
utilisent la configuration fournisseur pour créer des PRs et pousser des
branches. Aucun mode "local-only" n'est supporté en v1.

Git ≥ 2.18 est requis pour la stratégie worktree (`git worktree remove
--force`). Si une stratégie sandbox est introduite ultérieurement, ce
prérequis pourra être rendu conditionnel.

### 6.5 Checkpoints et comportement au retry

La tâche écrit un `BootstrapTaskCheckpoint` atomique sous
`artefactRoot/startup/prerequisite-validation/task-record.json`.

**Composition des hashes :**
- `inputHash` : empreinte SHA-256 de la concaténation de deux sources :
  1. Le contenu brut de `~/.go/config.json` (les octets du fichier tels que
     lus, avant parsing JSON).
  2. La sortie de `git --version`.
  Ces deux inputs sont les seuls sémantiquement pertinents pour cette tâche.
  **Note de déviation :** le hachage JCS ne s'applique pas ici car les
  inputs ne sont pas du JSON structuré ; on utilise SHA-256 sur les octets
  bruts. C'est la seule bootstrap task avec cette particularité.
- `repoCaptureHash`, `workflowPolicyHash`, `captureContextHash` : fixés à
  la valeur sentinelle déterministe
  `sha256:0000000000000000000000000000000000000000000000000000000000000000`
  (64 zéros après le préfixe). Cette tâche ne dépend ni du `RepoCapture`,
  ni de la `WorkflowPolicy`, ni du `CaptureContext` et ces champs
  n'existent pas encore au moment de son exécution.

**Comportement au retry :**
- Checkpoint terminal présent et `inputHash` identique → adoption directe
  du résultat précédent.
- Checkpoint absent → ré-exécution complète de la tâche de validation.
- `inputHash` différent (mismatch) → échec ferme (`failed`). La
  configuration fournisseur globale et la version de Git sont supposées
  immuables pour la durée du run (§6.3). Un changement entre deux
  exécutions du même `runId` constitue une corruption de l'environnement
  d'exécution.
- Checkpoint terminal `failed` ou `errored` → échec ferme (pas de
  ré-exécution automatique sans intervention).

---

## 7. Failure modes

| Pipeline | Cause de l'échec | Statut |
|---|---|---|
| 5.0 | `git --version` échoue (Git non installé ou injoignable) | `errored` |
| 5.0 | Version Git < 2.18 | `failed` |
| 5.1 | `~/.go/config.json` introuvable (absent ou permissions insuffisantes) | `failed` |
| 5.2 | Fichier non parseable en JSON | `failed` |
| 5.2 | Schéma `ProviderConfig` non respecté (champ manquant, type incorrect, enum inconnue) | `failed` |
| 5.2 | `token` manquant ou vide | `failed` |
| 5.2 | `username` manquant ou vide | `failed` |
| 5.2 | `token` ne respecte pas le format/préfixe du provider déclaré | `failed` |
| 5.2 | `token` contient une valeur de substitution par défaut | `failed` |
| 5.2 | `apiEndpoint` présent mais non parseable en URL absolue | `failed` |
| 5.2 | Champs supplémentaires non déclarés présents dans le fichier | `failed` |
| 5.3 | `artefactRoot` inaccessible pour l'écriture du checkpoint | `errored` |

---

## 8. Non-goals

- Tester la validité du token via un appel API (la validation est syntaxique
  et schéma, pas réseau).
- Vérifier que le token a les permissions suffisantes (ex: `repo` scope GitHub).
  Cette vérification est implicite au premier appel API et échouera au moment
  opportun.
- Gérer plusieurs providers simultanément (v1 = un seul).
- Faire tourner les tokens ou gérer leur expiration.
- Supporter des providers autres que GitHub et GitLab.
- Vérifier la présence de `git-lfs` ou d'autres outils optionnels (ils sont
  validés au moment de leur utilisation par `workspace-setup`).

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
