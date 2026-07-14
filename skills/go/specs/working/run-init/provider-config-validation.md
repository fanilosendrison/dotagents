# Startup task `provider-config-validation`

`provider-config-validation` verifie que la configuration fournisseur de `/go`
est presente et valide avant toute autre operation. C'est la toute premiere
bootstrap task de `run-init`, executee en fail-fast.

Elle n'interagit pas avec le reseau et ne cree pas de ressources : elle lit,
valide, et reussit ou echoue.

---

## 1. Objectif

Garantir que `ProviderConfig` est chargeable et valide avant que `run-init`
ne projette le `runId` dans le `WorkflowState` de `/go`, ne reserve le
worktree physique, ou ne lance les autres branches de bootstrap.

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
  apiEndpoint?: string;
  validatedAt: string;
};
```

Le token n'est **jamais** ecrit dans l'artefact, les logs, ou le
`WorkflowState`. Seuls les champs non-sensibles sont transcrits.

---

## 5. Pipeline

Les etapes s'enchainent dans l'ordre suivant :

### 5.1 Localisation du fichier

1. Etendre le chemin en remplacant le tilde `~` par le repertoire personnel de
   l'utilisateur (`os.homedir()` ou equivalent `HOME`/`USERPROFILE`), puis
   resoudre le chemin resultant via `realpath`.
2. Verifier que le fichier existe (`fs.stat`).
3. Verifier les permissions : `600` (lecture/ecriture proprietaire uniquement)
   sur les systemes POSIX (Linux, macOS). Ignorer ce controle specifique sur
   Windows. Si les permissions sont plus permissives sur POSIX, emettre un
   avertissement mais ne pas echouer.
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
     apiEndpoint?: string;
   };
   ```
   - `provider` : doit etre `"github"` ou `"gitlab"`
   - `token` : string non-vide + validation syntaxique selon le provider :
     - Pour `"github"` : le token doit commencer par l'un des prefixes
       officiels (`ghp_`, `github_pat_`, `gho_`, `ghs_`, `ghu_`).
     - Pour `"gitlab"` : le token doit commencer par `glpat-`.
     - Tout token contenant une valeur de substitution par defaut
       (ex: `YOUR_TOKEN_HERE`, `TODO`) ou ne respectant pas le format du
       provider est rejete → `failed`.
   - `username` : string non-vide
   - `defaultVisibility` : `"private"` ou `"public"`
   - `apiEndpoint` : optionnel. Si present, doit etre une URL absolue
     parseable (protocole `http` ou `https` et hostname requis). Si absent,
     l'endpoint SaaS public du provider est utilise par defaut
     (`https://api.github.com` ou `https://gitlab.com/api/v4`).
   - Champs supplementaires non declares → `failed`

### 5.3 Ecriture de l'artefact

1. Creer le sous-dossier `artefactRoot/startup/provider-config-validation/`.
2. Ecrire `provider-config.json` (artefact metier, sans le token).
3. Persister le `BootstrapTaskCheckpoint` et le `WorkflowExecutionRecord`.

---

## 6. Regles & Invariants

### 6.1 Fail-fast

L'echec de cette tache doit survenir avant toute allocation de ressources par
`repo-capture` ou `workspace-setup`. Aucun `runId` n'est projete dans le
`WorkflowState` de `/go`, aucun worktree n'est reserve, et aucune autre
branche de bootstrap n'est demarree. Le `runDir` et l'`artefactRoot` deja
alloues par Turnlock en amont ne servent qu'a consigner le checkpoint
d'echec pour audit.

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

**Note d'implementation :** Le token d'authentification valide est conserve
uniquement en memoire par le processus executeur de Turnlock. Sa propagation
aux taches aval suit deux mecanismes distincts :

- **Operations Git (`push`, `clone`, `fetch`) :** Utilisation de
  `GIT_ASKPASS` avec un script ephemere genere par Turnlock qui ecrit le
  token sur stdout. Le token n'est jamais injecte comme variable
  d'environnement persistante, ce qui empeche toute fuite accidentelle via
  des sous-processus arbitraires (linter, test runner, build tool) qui
  pourraient dumper leur environnement dans un log ou un crash report.

- **Appels API REST (creer un depot distant, ouvrir une PR, lire le statut
  CI) :** Passage explicite du token en parametre de fonction au niveau du
  client HTTP, sans ecriture dans l'environnement ni dans un fichier
  temporaire.

Ces deux mecanismes garantissent que le token reste immuable pour la duree
du run et ne peut pas fuiter vers des processus non controles par Turnlock,
meme si le fichier `~/.go/config.json` est modifie sur le disque par un
processus externe.

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
| 5.2 | `token` ne respecte pas le format/prefixe du provider declare | `failed` |
| 5.2 | `token` contient une valeur de substitution par defaut | `failed` |
| 5.2 | `apiEndpoint` present mais non parseable en URL absolue | `failed` |
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
