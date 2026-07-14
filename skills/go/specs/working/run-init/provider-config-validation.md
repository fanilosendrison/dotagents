# Startup task `provider-config-validation`

`provider-config-validation` verifie que la configuration fournisseur de `/go`
est presente et valide avant toute autre operation. C'est la toute premiere
bootstrap task de `run-init`, executee en fail-fast.

Elle n'interagit pas avec le reseau et ne cree pas de ressources : elle lit,
valide, et reussit ou echoue.

---

## 1. Objectif

Garantir que `ProviderConfig` est chargeable et valide avant que `run-init`
n'alloue des ressources (runId, artefactRoot, worktreeRoot) ou ne lance des
operations Git.

Si la configuration est absente ou invalide, le run echoue immediatement avec
`errored`, sans effet de bord.

---

## 2. Position dans le workflow

`provider-config-validation` est la premiere bootstrap task de `run-init`. Elle
s'execute de maniere sequentielle et synchrone, avant `repo-capture`.

```text
run-init
│
├─ provider-config-validation (sequentiel)
│       ↓
├─ repo-capture (sequentiel)
│       │
│       ├─ run-capture (parallele)
│       ├─ workspace-setup (parallele)
│       └─ repo-discovery-draft (parallele)
│                  │
│                  └──────────┬───────────┘
│                             ↓
│                 project-discovery-finalize
│                             ↓
│                 join run-capture
│                             ↓
└─ delegate implementation
```

Elle ne depend d'aucune autre bootstrap task et ne consomme aucun artefact.

---

## 3. Inputs

Aucun input dynamique du run. La configuration est lue depuis un chemin statique
connu a l'installation :

- Chemin : `~/.go/config.json` (resolu via `realpath`)
- Aucune dependance sur `BootstrapState`, `RepoCapture`, `WorkSession`, ou
  `artefactRoot`

La tache ne recoit que les inputs necessaires a l'ecriture de son checkpoint :

- `runId` (fourni par Turnlock)
- `artefactRoot` (reserve par `run-init` — utilise uniquement pour ecrire le
  checkpoint et l'evidence en cas d'echec)

---

## 4. Outputs

Artefact metier ecrit sous `artefactRoot/startup/provider-config-validation/provider-config.json` :

```ts
type ProviderConfigValidation = {
  schema: "go.provider-config-validation.v1";
  runId: string;
  provider: "github" | "gitlab";
  username: string;
  defaultVisibility: "private" | "public";
  validatedAt: string;
};
```

Le token n'est **jamais** ecrit dans l'artefact, les logs, ou le
`WorkflowState`. Seuls les champs non-sensibles sont transcrits.

---

## 5. Pipeline

Les etapes s'enchainent dans l'ordre suivant :

### 5.1 Localisation du fichier

1. Resoudre `~/.go/config.json` via `realpath`.
2. Verifier que le fichier existe (`fs.stat`).
3. Verifier les permissions : `600` (lecture/ecriture proprietaire uniquement).
   Si les permissions sont plus permissives, emettre un avertissement mais ne
   pas echouer.
4. Si le fichier est absent → `failed`.

### 5.2 Parsing et validation du schema

1. Lire le contenu brut du fichier.
2. Parser le JSON. Si parsing echoue → `failed`.
3. Valider contre le schema `ProviderConfig` :
   ```ts
   type ProviderConfig = {
     provider: "github" | "gitlab";
     token: string;
     username: string;
     defaultVisibility: "private" | "public";
   };
   ```
   - `provider` : doit etre `"github"` ou `"gitlab"`
   - `token` : string non-vide
   - `username` : string non-vide
   - `defaultVisibility` : `"private"` ou `"public"`
   - Champs supplementaires non declares → `failed`

### 5.3 Ecriture de l'artefact

1. Creer le sous-dossier `artefactRoot/startup/provider-config-validation/`.
2. Ecrire `provider-config.json` (artefact metier, sans le token).
3. Persister le `BootstrapTaskCheckpoint` et le `WorkflowExecutionRecord`.

---

## 6. Regles & Invariants

### 6.1 Fail-fast

L'echec de cette tache doit survenir avant toute allocation de ressources par
`repo-capture` ou `workspace-setup`. Aucun `runId` n'est consomme, aucun
dossier cree, aucun worktree reserve.

### 6.2 Non-divulgation du token

Le token d'authentification (`ProviderConfig.token`) ne doit jamais apparaitre
dans :
- `ProviderConfigValidation` (l'artefact metier)
- `StateFile` ou `WorkflowState`
- Les logs, stdout, ou stderr
- Les messages d'erreur
- Les fichiers d'evidence

En cas d'echec de validation, le message d'erreur peut indiquer qu'un token est
manquant ou invalide, mais ne doit jamais afficher la valeur du token.

### 6.3 Immutabilite par run

`ProviderConfig` est une configuration statique d'installation. Sa valeur est
immuable pour la duree d'un run. Aucune bootstrap task ou stage ne peut la
modifier.

### 6.4 Obligatoire pour tous les runs

`ProviderConfig` est requis meme si le depot cible existe deja et possede un
remote `origin`. Les stages aval (`package-and-publish`, `pr-ci-review`)
utilisent la configuration fournisseur pour creer des PRs et pousser des
branches. Aucun mode "local-only" n'est supporte en v1.

---

## 7. Failure modes

| Pipeline | Cause de l'echec | Statut |
|---|---|---|
| 5.1 | `~/.go/config.json` introuvable (absent ou permissions insuffisantes) | `failed` |
| 5.2 | Fichier non parseable en JSON | `failed` |
| 5.2 | Schema `ProviderConfig` non respecte (champ manquant, type incorrect, enum inconnue) | `failed` |
| 5.2 | `token` manquant ou vide | `failed` |
| 5.2 | `username` manquant ou vide | `failed` |
| 5.2 | Champs supplementaires non declares presents dans le fichier | `failed` |
| 5.3 | `artefactRoot` inaccessible pour l'ecriture du checkpoint | `errored` |

---

## 8. Non-goals

- Tester la validite du token via un appel API (la validation est syntaxique
  et schema, pas reseau).
- Verifier que le token a les permissions suffisantes (ex: `repo` scope GitHub).
  Cette verification est implicite au premier appel API et echouera au moment
  opportun.
- Gerer plusieurs providers simultanement (v1 = un seul).
- Faire tourner les tokens ou gerer leur expiration.
- Supporter des providers autres que GitHub et GitLab.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
