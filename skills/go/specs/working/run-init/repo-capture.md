# Startup task `repo-capture`

`repo-capture` définit le contexte de dépôt cible que `run-init` doit résoudre avant de pouvoir amorcer le reste du workflow. 

Cette bootstrap task est synchrone et s'exécute de manière isolée : elle ne lance pas `git`, ne choisit pas de branche et ne communique pas avec le réseau. Elle utilise uniquement des opérations système de fichiers locales (`realpath`, `stat`) pour déduire le contexte du dépôt à partir du répertoire d'invocation fourni par le parent process.

---

## 1. Objectif

Produire un `RepoCapture` valide répondant à la question précise :
*Quel dépôt Git et quel sous-périmètre projet ce run `/go` cible-t-il ?*

La capture garantit que le run a une cible unique et valide avant le démarrage des bootstrap tasks parallèles et la création de tout worktree physique.

---

## 2. Position dans le workflow

`repo-capture` s'exécute de manière synchrone et séquentielle au début de la phase Turnlock `run-init`, juste après la validation de la configuration fournisseur (`ProviderConfig`).

```text
run-init
│
├─ provider-config-validation (séquentiel)
│       ↓
├─ repo-capture (séquentiel)
│       │
│       ├─ run-capture (parallèle)
│       ├─ workspace-setup (parallèle)
│       └─ repo-discovery-draft (parallèle)
```

Aucune tâche parallèle de démarrage (notamment `workspace-setup`) ne peut démarrer avant que `repo-capture` ne soit finalisée, car elle fournit la racine Git cible et le sous-périmètre nécessaires pour la création et la configuration du worktree.

---

## 3. Inputs

- `invocationDirectory` (reçu via le `BootstrapState` de départ) : répertoire courant de la session utilisateur qui invoque `/go` (l'unique source de vérité pour la cible).
- `runDir` (fourni par Turnlock) : répertoire runtime de l'enveloppe courante du run (pour validation du containment).

---

## 4. Outputs

Le produit de cette tâche est l'artefact `RepoCapture` projeté dans le `WorkflowState` :

```ts
type RepoCapture = {
  schema: "go.repo-capture.v1";
  invocationDirectory: string;
  canonicalRepositoryRoot: string;
  projectRoot?: string;
  symlinkResolved: boolean;
  resolvedAt: string;
};
```

- `canonicalRepositoryRoot` : racine Git canonique cible (ou dossier de base cible si aucun dépôt n'existe encore).
- `projectRoot` : chemin absolu du sous-projet en cas de monorepo (ou absent si l'on travaille à la racine).

---

## 5. Pipeline

Le sous-système de résolution de `run-init` produit le contexte en appliquant la logique suivante :

1. **Point de départ :** Utiliser le répertoire courant de la session (`invocationDirectory`) comme unique point de départ.
2. **Normalisation :** Résoudre et normaliser les liaisons symboliques éventuelles pour obtenir le chemin physique réel.
3. **Ascension Git :** Remonter les répertoires parents successifs à la recherche du premier dossier `.git/` valide.
4. **Détection Dépôt :**
   - Si un dépôt Git est trouvé, `canonicalRepositoryRoot` est résolu comme la racine de ce dépôt.
   - Si aucun dépôt n'est trouvé, vérifier que le répertoire résolu n'est pas une gateway symbolique (voir Règles §6). Si ce n'est pas une gateway, assigner `canonicalRepositoryRoot = realpath(invocationDirectory)` et déléguer la création/initialisation du dépôt Git à `workspace-setup`.
5. **Validation du Containment :** Si le parent process n'a pas configuré de `runDirRoot` valide, vérifier que le dossier runtime `runDir` n'est pas contenu dans le dépôt cible résolu (`canonicalRepositoryRoot`). En cas de violation, la validation échoue.

---

## 6. Règles & Invariants

### 6.1 Sous-dossiers de Monorepos
Si le terminal de la session (`invocationDirectory`) cible un sous-dossier (ex: `packages/app/`) d'un dépôt Git global (ex: `monorepo/`), `repo-capture` doit distinguer :
- `canonicalRepositoryRoot` : la racine du dépôt global (`monorepo/`) car Git crée des worktrees au niveau du dépôt, pas des sous-dossiers.
- `projectRoot` : le sous-dossier métier (`monorepo/packages/app/`) résolu via `realpath` pour éviter la propagation de symlinks.
Le `projectRoot` doit impérativement être un sous-dossier de `canonicalRepositoryRoot`.

### 6.2 Dépôts Git imbriqués
La recherche du dépôt cible s'arrête sur le premier dépôt `.git/` trouvé en remontant depuis `invocationDirectory`. Le terminal de la session a toujours raison : se situer dans `workspace/` cible le dépôt parent, alors que se situer dans `workspace/vendor/nested-repo/` cible le sous-dépôt.

### 6.3 Gateway Symlinks (Sécurité)
`run-init` ne doit jamais accepter un répertoire "gateway" global comme dépôt cible.
- Si aucun dépôt `.git` n'est présent dans le répertoire ou ses parents, et que `realpath(invocationDirectory)` contient un dossier sentinelle (`.agents/`, `.codex/`, `.pi/`, `.gravity/`) ou un fichier sentinelle (`AGENTS.md`, `SKILL.md`, `CODEX.md`, `GRAVITY.md`), le répertoire est identifié comme une gateway. La résolution échoue immédiatement avec le statut `failed`.

### 6.4 Autorité Git ultérieure
`repo-capture` ne valide pas l'intégrité de l'historique ou du dépôt. C'est à la charge de `workspace-setup` de confirmer la conformité physique avec `canonicalRepositoryRoot`.

---

## 7. Opérations internes typiques

- `resolve-cwd-path` (lecture de l'invocationDirectory)
- `resolve-symlinks` (normalisation via realpath)
- `find-nearest-git-root` (recherche ascendante du répertoire `.git`)
- `check-gateway-sentinels` (vérification de fichiers/dossiers gateways)
- `verify-path-containment` (vérification que runDir est hors du dépôt cible)
- `write-repo-capture-draft` (construction de la structure RepoCapture)

---

## 8. Failure modes

| Pipeline | Cause de l'échec | Statut du run |
|---|---|---|
| 5.1 | `invocationDirectory` ou chemin cible non exploitable | `errored` (crash avant run) |
| 5.4 | Aucun dépôt trouvé et répertoire CWD identifié comme une gateway sentinelle | `failed` (invitation à changer de CWD) |
| 5.5 | `projectRoot` résolu hors de `canonicalRepositoryRoot` | `failed` |
| 5.5 | `runDir` contenu à l'intérieur du dépôt cible résolu | `failed` |
| - | Payload `RepoCapture` invalide ou corrompu | `errored` |

---

## 9. Non-goals

- Initialiser un dépôt Git (tâche déléguée à `workspace-setup`).
- Configurer les remotes, les branches ou les commits.
- Se connecter à l'API d'un fournisseur Git.
- Interroger ou modifier le contenu des fichiers du projet (tâche déléguée à `repo-discovery-draft`).

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
