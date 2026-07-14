# Phase Turnlock `run-init`

Ce document definit comment la phase Turnlock `run-init` amorce un run `/go`,
execute les travaux de bootstrap/onboarding, et s'arrete sur la premiere
delegation agentique.

`run-init` est la premiere phase de l'orchestrateur Turnlock configure pour
`/go`. Turnlock l'execute, la reprend, la verrouille et persiste sa transition
comme une phase runtime. Son implementation appartient au consommateur `/go`,
pas au runtime Turnlock.

`run-init` n'est pas :

- une primitive generique fournie par Turnlock ;
- un stage metier `/go` ;
- une bootstrap task parallele ;
- une phase obligatoire pour tous les orchestrateurs Turnlock.

Elle est obligatoire seulement pour le workflow `/go`, parce que `/go` doit
transformer `BootstrapState` en `WorkflowState`, executer le
bootstrap/onboarding, puis emettre la premiere delegation agentique.

Le principe central : le bootstrap n'est pas un stage metier et les travaux de
startup ne sont pas des phases Turnlock separees. Ils sont des bootstrap tasks
internes a `run-init`. Les bootstrap branches peuvent s'executer en parallele,
mais leurs artefacts ne deviennent autoritaires qu'au moment ou `run-init`
les valide et les projette dans le `WorkflowState` donne a Turnlock avec la
delegation `implementation`.

---

## 1. Graphe d'execution

Dans `run-init`, le graphe nominal est :

```text
run-init
│
├─ provider-config-validation (sequentiel)
│       ↓
├─ repo-capture (sequentiel)
│       │
│       ├─ run-capture (parallele) ─────────────────┐
│       ├─ workspace-setup (parallele) ──┐          │
│       └─ repo-discovery-draft (parallele)         │
│                  │                      │          │
│                  └──────────┬───────────┘          │
│                             ↓                      │
│                 project-discovery-finalize         │
│                             │                      │
│                             ↓                      │
│                 join run-capture ◄─────────────────┘
│                             ↓
└─ delegate implementation
         ↓ resumeAt
    implementation-settlement
```

### 1.0 Validation du ProviderConfig

Avant toute autre operation, `run-init` verifie que `ProviderConfig` est
present et valide dans la configuration globale de `/go` (`~/.go/config.json`).

Cette validation est un fail-fast : si le fichier est absent, illisible, ou
invalide (schema non conforme, token manquant), `run-init` echoue
immediatement avec `errored`, avant toute reservation de ressources ou
operation Git.

`ProviderConfig` est necessaire pour :
- l'initialisation d'un nouveau depot distant (`workspace-setup` §4.2) ;
- la creation de PR et le packaging (stages aval).

Sa validation en premiere position garantit qu'aucune operation couteuse n'est
lancee si la configuration fournisseur est defectueuse.

### 1.1 Resolution du repo capture

`run-init` resout le `RepoCapture` comme sa toute premiere
bootstrap task, depuis le CWD fourni dans `BootstrapState`. Le contrat
detaille vit dans [`repo-capture.md`](./repo-capture.md).

Cette etape est sequentielle : `workspace-setup` a besoin de
`canonicalRepositoryRoot` et `projectRoot` pour creer le worktree, donc elle
ne peut pas demarrer en parallele de la resolution.

Si le `RepoCapture` ne peut pas etre resolu (par exemple si on ne
trouve aucun depot Git parent), `run-init` echoue avant que les bootstrap tasks
internes ne puissent produire une evidence autoritative.

### 1.2 Branches paralleles

Les trois bootstrap tasks suivantes s'executent en parallele une fois
`repo-capture` termine :

- **`run-capture`** : capture les preuves du moment `/go` (prompt, extrait de
  session). Contrat dans [`run-capture.md`](./run-capture.md). Elle ne depend
  pas du worktree, seulement du `CaptureContext` fourni dans
  `BootstrapState`. Pour v1, `run-init` ne delegue pas `implementation`
  tant que `RunCaptureArtifact` n'est pas terminal, et Turnlock termine le
  process apres `io.delegate` : un mode sidecar ou ensure-before-review
  pourra etre ajoute plus tard.
- **`workspace-setup`** : prepare le worktree Git prive et produit
  `WorkSession`. Contrat dans [`workspace-setup.md`](./workspace-setup.md).
  Si le depot n'existe pas encore, l'initialise et le connecte a un
  repo distant via [`ProviderConfig`](./provider-config-validation.md).
- **`repo-discovery-draft`** : lit le dépôt source pour decouvrir les
  commandes et capacites du repo, pendant que le worktree est cree. Ce
  resultat n'est qu'un brouillon. De plus, `repo-discovery-draft` ne doit pas
  executer de commandes Git sur le dépôt source. Elle lit uniquement des
  fichiers. Si un fichier ou dossier (comme `.git/`) est absent parce que
  `workspace-setup` est en cours d'initialisation parallele, la branche
  traite cette absence comme une information manquante (draft incomplet) et ne
  crashe pas. Le join `project-discovery-finalize` validera ou relancera la
  discovery finale.

Aucune bootstrap branch ne demarre avant que `run-init` ait reserve ses refs
d'ecriture (artefactRoot, worktreeRoot, ownership marker), car aucune startup
branch ne doit inventer son propre emplacement d'ecriture ou son propre
identifiant.

### 1.3 Joins

`project-discovery-finalize` est le bootstrap join entre `workspace-setup` et
`repo-discovery-draft`. Il verifie que les fichiers inspectes par le draft
correspondent au worktree prive (hashes de `package.json`, lockfile, config).
Si les hashes matchent, le draft est finalise en `ProjectDiscovery`
autoritatif. Sinon, la discovery est relancee depuis `worktreeRoot` ou le
join echoue ferme selon `WorkflowPolicy.discovery`.

Pour v1, `run-init` joint aussi `run-capture` avant la sortie : la delegation
`implementation` n'est pas emise tant que `RunCaptureArtifact` n'est pas
terminal, schema-valide, hash-verifie et projete dans le `WorkflowState`.

### 1.4 Delegation

Une fois tous les joins satisfaits, `run-init` prepare l'input de delegation
agentique et retourne a Turnlock :

```text
io.delegate(
  { label: "implementation", ... },
  "implementation-settlement",
  workflowState
)
```

### 1.5 Regles de parallelisme

**Regle d'autorite.** Une bootstrap branch ne modifie pas directement
`WorkflowState`. Elle produit un artefact metier type, des evidence refs, et un
`WorkflowExecutionRecord`. `run-init` valide ensuite (schema, containment,
hashes) et projette dans le `WorkflowState` qu'il remet a Turnlock. Cette regle
evite les courses d'ecriture entre branches de demarrage.

**Echecs paralleles et cancellation.** L'echec d'une branche est fail-closed :

- si `workspace-setup` echoue, `run-init` annule les branches encore actives,
  attend leur terminaison controlee ou leur timeout court, puis echoue ;
- si `project-discovery-finalize` echoue, `run-init` annule les branches encore
  actives et echoue ;
- si `repo-discovery-draft` echoue, `project-discovery-finalize` peut relancer
  la discovery depuis `worktreeRoot` seulement si `WorkflowPolicy.discovery`
  l'autorise ; sinon `run-init` echoue ;
- si `run-capture` echoue, `run-init` echoue ou ouvre la HumanGate prevue par
  policy ; v1 ne delegue pas `implementation` sans `RunCaptureArtifact` valide ;
- une task annulee ecrit un `task-record.json` terminal `cancelled` si possible ;
- une task qui a produit des fichiers partiels sans checkpoint terminal valide
  ne produit aucune preuve autoritative ;
- au retry, les fichiers partiels sont ignores ou mis en quarantaine avant
  relance ;
- aucune sortie partielle n'est projetee dans `WorkflowState`.

La cancellation utilise les primitives runtime disponibles (`io.signal`,
timeouts Turnlock, ecritures atomiques). Elle n'introduit pas un second
scheduler ou un second systeme de lock propre a `/go`.

**Joins fail-closed.** Un bootstrap join est un point ou le chemin principal
exige qu'une bootstrap branch ait produit un resultat valide. Si un join ne peut
pas prouver ses inputs, il echoue ferme. Il ne continue pas sur une inference
libre :

```text
project-discovery-finalize requires:
  - WorkSession
  - RepositoryDiscoveryDraft or permission to rerun discovery from worktree

implementation delegation requires:
  - WorkSession
  - ProjectDiscovery
  - RunCaptureArtifact
```

---

## 2. Entree : `BootstrapState`

Avant `run-init`, le parent process fournit a Turnlock un `BootstrapState`
minimal. Ce bootstrap state contient seulement les inputs que le parent process
connait deja, sans aucune discovery Git.

### 2.1 Structure

```ts
type BootstrapState = {
  schema: "go.bootstrap-state.v1";
  invocationDirectory: string;
  policy: WorkflowPolicy;
  captureContext: CaptureContext;
};
```

Exemple conceptuel avant `run-init` :

```jsonc
{
  "schemaVersion": "<turnlock-state-schema-version>",
  "runId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "orchestratorName": "go",
  "currentPhase": "run-init",
  "data": {
    "schema": "go.bootstrap-state.v1",
    "invocationDirectory": "<session-cwd>",
    "policy": {
      "schema": "go.workflow-policy.v1",
      "...": "<policy-fields>"
    },
    "captureContext": {
      "schema": "go.capture-context.v1",
      "sessionRef": "<session-id-or-path>",
      "promptAtGo": "le prompt exact tape par l'utilisateur",
      "sessionExcerpt": "extrait de la session jusqu'au prompt"
    }
  }
}
```

### 2.2 `WorkflowPolicy`

Le parent process ou la configuration `/go` fournit un `WorkflowPolicy` qui
fige les decisions ne devant pas etre improvisees par une bootstrap task :

- adoption ou refus du dirty state initial ;
- rerun autorise ou non de la discovery depuis le worktree ;
- comportement si aucune gate fiable n'est detectee ;
- comportement des delegations agentiques et remediations ;
- obligation de `RunCaptureArtifact` pour les reviews ;
- conditions de packaging et de publication ;
- comportement de retention des runs incomplets.

`run-init` valide seulement la forme de cette policy et la recopie dans
`WorkflowState`. Il ne choisit pas les modes de policy et ne les modifie pas.
La validation de forme inclut les invariants minimaux pour un hash JCS stable :
champs obligatoires presents, schemas connus, valeurs enum reconnues, et
absence de champs non declares.

### 2.3 `CaptureContext`

Le parent process fournit les preuves de session :

```ts
type CaptureContext = {
  schema: "go.capture-context.v1";
  sessionRef: string;
  promptAtGo: string;
  sessionExcerpt: string;
};
```

La bootstrap task `run-capture` lit ces inputs pour produire le
`RunCaptureArtifact`. `run-init` ne modifie pas le `CaptureContext`, il le
transmet tel quel.

---

## 3. Sortie : `WorkflowState` et delegation

`run-init` produit le premier `WorkflowState` complet, que Turnlock persiste
par transition atomique en remplacement du `BootstrapState`.

### 3.1 Structure du `WorkflowState` initial

Exemple conceptuel apres le snapshot stable emis par `run-init` :

```jsonc
{
  "schemaVersion": "<turnlock-state-schema-version>",
  "runId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "orchestratorName": "go",
  "currentPhase": "run-init",
  "pendingDelegation": {
    "//": "conceptuel, Turnlock-owned",
    "label": "implementation",
    "kind": "prompt",
    "resumeAt": "implementation-settlement",
    "manifestPath": "delegations/implementation-0.json",
    "attempt": 0
  },
  "data": {
    "schema": "go.workflow-state.v1",
    "runId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    "runInit": {
      "schema": "go.run-init.v1",
      "runId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      "repoCapture": {
        "schema": "go.repo-capture.v1",
        "invocationDirectory": "<session-cwd>",
        "canonicalRepositoryRoot": "<canonical-repository-root>",
        "projectRoot": "<optional-project-root>",
        "symlinkResolved": true,
        "resolvedAt": "2026-07-12T14:30:00.000Z"
      },
      "repoCaptureHash": "sha256:<canonical-repo-capture-hash>",
      "workflowPolicyHash": "sha256:<canonical-workflow-policy-hash>",
      "captureContextHash": "sha256:<canonical-capture-context-hash>",
      "turnlockRun": {
        "runId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
        "runDirRef": "<go-run-root>/runs/01ARZ3NDEKTSV4RRFFQ69G5FAV",
        "stateFileRef": "state.json",
        "eventsRef": "events.ndjson"
      },
      "artefactRootRef": "artefactRoot/",
      "workflowLogRootRef": "logs/workflow/",
      "worktreeRootReservedPath": "worktree/",
      "ownershipMarkerRef": "artefactRoot/run-init-ownership.json",
      "initializedAt": "2026-07-12T14:30:00.000Z"
    },
    "policy": {
      "schema": "go.workflow-policy.v1",
      "dirtyState": {
        "mode": "require-clean",
        "adoptionRequiresPatchEvidence": true,
        "adoptionRequiresWorktreeReplay": true
      },
      "discovery": {
        "allowSourceCheckoutDraft": true,
        "allowWorktreeRerun": true,
        "noReliableGateBehavior": "human-gate"
      },
      "gates": {
        "requiredKinds": ["lint", "typecheck", "tests"],
        "allowOptionalGateFailure": true
      },
      "delegation": {
        "implementationBlockedBehavior": "human-gate",
        "allowAutomaticRemediation": true,
        "remediationApproval": "human"
      },
      "review": {
        "requireRunCaptureForPrePackageReview": true,
        "requireRunCaptureForPrCiReview": true,
        "unclearIntentBehavior": "human-gate",
        "blockingMajorFindingBehavior": "human-gate"
      },
      "packaging": {
        "requireCleanWorktreeForPackaging": true,
        "allowPublishPr": true,
        "requirePackageReconstructionProof": true
      },
      "retention": {
        "incompleteRunBehavior": "resume",
        "staleRuntimeLockBehavior": "turnlock-policy"
      }
    },
    "repository": {
      "repositoryRoot": "<canonical-repository-root>",
      "projectRoot": "<optional-project-root>",
      "worktreeProjectRoot": "<optional-worktree-relative-path>",
      "provider": "github",
      "remoteName": "origin",
      "defaultTargetBranch": "main"
    },
    "currentStage": "implementation",
    "bootstrapTasks": [
      {
        "task": "run-capture",
        "status": "passed",
        "businessArtifactIds": ["run-capture:<id>"],
        "requiredBefore": ["implementation", "pre-package-review", "pr-ci-review"]
      },
      {
        "task": "repo-discovery-draft",
        "status": "passed",
        "businessArtifactIds": ["repository-discovery-draft:<id>"],
        "requiredBefore": ["project-discovery-finalize"]
      },
      {
        "task": "workspace-setup",
        "status": "passed",
        "businessArtifactIds": ["work-session:<id>"],
        "requiredBefore": ["project-discovery-finalize"]
      },
      {
        "task": "project-discovery-finalize",
        "status": "passed",
        "businessArtifactIds": ["project-discovery:<id>"],
        "requiredBefore": ["implementation"]
      }
    ],
    "snapshots": [],
    "executionRecords": [],
    "businessArtifacts": [],
    "checks": [],
    "findings": [],
    "humanGates": [],
    "remediations": [],
    "branches": [],
    "commits": [],
    "pullRequests": [],
    "mergeTracking": []
  }
}
```

`currentStage` vaut `"implementation"`, car le prochain travail externe est la
delegation agentique. Les travaux de demarrage sont suivis par `bootstrapTasks`,
pas par `currentStage`.

`currentPhase` est un pointeur Turnlock vers la prochaine phase runtime stable.
Pendant une delegation, `currentPhase` peut rester sur la phase qui a emis la
delegation ; l'autorite de reprise vit alors dans `pendingDelegation` et son
`resumeAt`.

Le champ `repository` est initialise depuis le `RepoCapture`. Il
n'est pas encore une preuve Git autoritative. `workspace-setup` le verifie, ou
echoue ferme.

Tout ce qui suit `run-init` est une mutation tracee de ce payload initial.

### 3.2 Surface d'audit

`run-init` ne produit pas de `StageOutput`, car ce n'est pas un stage. La
reussite de `run-init` est prouvee par quatre elements :

- le snapshot stable Turnlock qui remplace `BootstrapState` par
  `WorkflowState` dans `StateFile<RuntimeState>` ;
- `RunInitRecord` dans `WorkflowState.runInit` ;
- `RunInitOwnershipMarker` pour les refs reservees par `/go` ;
- `pendingDelegation` Turnlock pour `label: "implementation"` et
  `resumeAt: "implementation-settlement"`.

Les erreurs de `run-init` sont exposees par la transition Turnlock echouee, les
events runtime et, si possible, une evidence d'audit sous une ref de
quarantaine ou de diagnostic controlee par Turnlock. Elles ne doivent pas etre
maquillees en erreur de stage.

### 3.3 Projection atomique

`run-init` doit etre atomique du point de vue du workflow : soit Turnlock a
persiste un snapshot stable contenant `WorkflowState` et la delegation
`implementation`, soit aucune sortie de bootstrap task ne devient autoritative.

Sequence normative :

```text
Turnlock creates runtime envelope
Turnlock persists StateFile<RuntimeState> with BootstrapState
Turnlock dispatches run-init
run-init reads BootstrapState
run-init resolves RepoCapture from invocationDirectory
run-init validates WorkflowPolicy shape from BootstrapState
run-init hashes canonical launch inputs
run-init creates or reserves /go artefact refs
run-init reserves worktreeRoot path
run-init writes or verifies ownership marker
run-init starts bootstrap branches
run-init runs workspace-setup
run-init runs or finalizes repo discovery
run-init joins project-discovery-finalize
run-init joins run-capture
run-init prepares implementation delegation input
run-init returns io.delegate(label=implementation, resumeAt=implementation-settlement)
Turnlock validates state schema
Turnlock atomically writes StateFile<RuntimeState> with WorkflowState and
pendingDelegation
Turnlock emits delegation protocol and exits
```

Regles :

- `state.json` est ecrit atomiquement par Turnlock ;
- `run-init` ne publie pas de marqueur de completion separe ;
- le snapshot stable Turnlock est l'unique preuve que `run-init` a reussi ;
- apres un snapshot stable, `state.data.schema` vaut `"go.workflow-state.v1"` ;
- une bootstrap task refuse de produire une evidence autoritative si
  `state.data.runInit` est absent ou invalide ;
- la reprise apres delegation passe par `pendingDelegation.resumeAt`, pas par
  une phase startup intermediaire ;
- les fichiers temporaires ou incomplets de Turnlock ne sont jamais
  autoritatifs pour `/go`.

---

## 4. Contrat Turnlock

### 4.1 `runId`

`runId` est l'identifiant unique du run Turnlock. `/go` ne genere pas un second
identifiant. `WorkflowState.runId` doit etre identique a `StateFile.runId`.

Il sert de namespace a tout ce qui appartient au workflow : bootstrap tasks,
stages, artefacts metier, evidence files, logs, branches de travail, commits,
pull requests.

Forme normative : un ULID Crockford base32 de 26 caracteres, genere par
Turnlock quand le parent process ne fournit pas `--run-id`.

```text
01ARZ3NDEKTSV4RRFFQ69G5FAV
```

Le profil `/go` exige que Turnlock valide `runId` avant de creer `runDir`. En
mode initial :

- le comportement nominal est de laisser Turnlock generer le `runId` ;
- si un parent process fournit explicitement `--run-id`, cette valeur doit
  deja matcher le format `/^[0-9A-HJKMNP-TV-Z]{26}$/` ;
- un `--run-id` externe non conforme est refuse avant la creation de `runDir` ;
- si `run-init` observe un `StateFile.runId` non conforme, il echoue ferme.

Invariants :

- `runId` est genere une seule fois par Turnlock ;
- `runId` est immuable apres creation ;
- tout artefact durable `/go` reference le meme `runId` ;
- deux runs simultanes ne peuvent pas partager le meme `runId` ;
- `runId` est directement utilisable dans les chemins locaux, refs Git et
  namespaces distants ;
- `/go` ne definit pas de `runSlug` parallele a `runId`.

### 4.2 `runDir`

`runDir` est cree par Turnlock avant `run-init`. `/go` le reference comme racine
runtime, mais ne le cree pas et ne le verrouille pas.

Il doit etre hors du repo cible pour que les artefacts, logs et etats internes
ne rendent jamais le repo dirty. Le parent process utilise un `runDirRoot`
generique (ex: `~/.go-runs/`) garanti hors de tout repo projet.

`run-init` verifie par containment path que `runDir` n'est pas sous le repo
cible fraichement resolu. Si cette verification echoue, `run-init` echoue
ferme ; il ne tente pas de deplacer `runDir`.

Disposition locale normative :

```text
<go-run-root>/runs/<runId>/
├── state.json
├── events.ndjson
├── artefactRoot/
├── worktree/        (chemin reserve ; checkout cree par workspace-setup)
├── logs/
│   ├── turnlock.log
│   └── stages/
└── .lock
```

Les implementations peuvent remplacer certains chemins par des references vers
un stockage distant, mais `runDir` reste le conteneur logique du run.
Proprietes preservees : isolation entre runs, evidence hors worktree, reprise
possible apres interruption, chemins derivables depuis `runId`.

`state.json`, `events.ndjson`, le lock runtime et les logs Turnlock sont
proprietes de Turnlock. `artefactRoot/`, `worktree/` et les sous-dossiers de
preuves sont des references metier `/go`.

### 4.3 `artefactRoot`

`artefactRoot` est le dossier ou les preuves du run sont ecrites, distinct du
worktree.

Disposition normative :

```text
runDir/artefactRoot/
├── run-init-ownership.json
├── startup/
│   ├── run-capture/
│   │   ├── task-record.json
│   │   ├── output.json
│   │   ├── prompt-at-go.txt
│   │   └── session-excerpt.md
│   ├── workspace-setup/
│   │   ├── task-record.json
│   │   ├── work-session.json
│   │   └── evidence/
│   ├── repo-discovery-draft/
│   │   ├── task-record.json
│   │   └── evidence/
│   └── project-discovery-finalize/
│       ├── task-record.json
│       ├── project-discovery.json
│       └── evidence/
├── implementation/
│   ├── output.json
│   └── evidence/
├── mechanical-gates/
│   ├── output.json
│   └── evidence/
└── ...
```

Regles :

- `artefactRoot` est hors worktree — les artefacts ne doivent pas apparaitre
  dans `git status`, `trackedWorktreeHash`, ou les diffs ;
- `run-init` cree l'unique `artefactRoot` du run (avec primitive exclusive ou
  adoption sur ownership marker valide du meme `runId`) ;
- chaque workflow unit ecrit dans son propre sous-dossier ;
- les evidence files restent sous un dossier `evidence/` ou explicitement
  references par l'artefact metier ;
- un sous-dossier d'artefact n'est jamais reutilise silencieusement entre deux
  executions distinctes ;
- les references d'evidence sont verifiees avant projection dans
  `WorkflowState`.

Les bootstrap tasks internes publient un `task-record.json` terminal par ecriture
atomique seulement quand leur resultat est complet, schema-valide et verifie
contre les inputs stables du run.

Une implementation peut remplacer `artefactRoot` par une reference equivalente
(bucket, store distant) avec les memes garanties. Les refs distantes doivent
etre namespaced par `runId`.

### 4.4 Lock, horloge, logger

**Lock.** Turnlock possede le lock exclusif (`<runDir>/.lock`) qui empeche deux
processus de piloter le meme run. `/go` ne cree pas un second lock.

**Horloge.** Turnlock fournit l'horloge de reference du run. Tous les
timestamps (`createdAt`, `startedAt`, `endedAt`, timestamps d'evidence et de
logs) utilisent cette source.

**Logger.** Turnlock fournit le logger runtime. `run-init` peut reserver un
sous-dossier de logs metier (`workflowLogRootRef`), mais ne cree pas un second
logger autoritatif. Tous les messages incluent `runId`. Les traces
distribuees, si necessaires, passent par Turnlock ou une primitive externe
comme OpenTelemetry, pas par un second systeme de tracing `/go`.

`run-init` applique la regle des primitives externes definie dans
[`external-primitives.md`](../standards/external-primitives.md) : il ne definit
pas un second runtime de lock, journal, retry, resume, logger, horloge ou
persistance atomique. Turnlock est la primitive autoritative.

`ProviderConfig` est une configuration statique fournie a l'installation de
`/go` et non une primitive runtime. Contrat dans
[`provider-config-validation.md`](./provider-config-validation.md).

---

## 5. Fiabilite

### 5.1 Checkpoints internes de startup

Les bootstrap tasks internes publient des checkpoints sous
`artefactRoot/startup/<task>/task-record.json`. Ces checkpoints sont des
preuves de reprise pour `run-init`, pas une seconde source de verite.

Forme normative :

```ts
type BootstrapTaskCheckpoint = {
  schema: "go.startup-task-checkpoint.v1";
  runId: string;
  task:
    | "run-capture"
    | "repo-discovery-draft"
    | "workspace-setup"
    | "project-discovery-finalize";
  status: "passed" | "failed" | "errored" | "cancelled";
  inputHash: string;
  repoCaptureHash: string;
  workflowPolicyHash: string;
  captureContextHash: string;
  businessArtifactIds: string[];
  evidenceRefs: string[];
  startedAt: string;
  endedAt: string;
};
```

Regles :

- `task-record.json` est ecrit atomiquement ;
- aucun `task-record.json` non terminal n'est autoritatif ;
- `inputHash` couvre les inputs exacts de la bootstrap task ;
- `repoCaptureHash` et `workflowPolicyHash` doivent matcher le
  `RunInitRecord` courant ;
- `runId` doit matcher `StateFile.runId` ;
- chaque `businessArtifactId` pointe vers un artefact JSON schema-valide ;
- chaque `evidenceRef` reste sous l'`artefactRoot` du run ;
- un fichier temporaire, partiel, illisible ou schema-invalide est ignore ou
  mis en quarantaine, jamais adopte silencieusement.

Sur retry de `run-init` :

- checkpoint terminal valide et hashes compatibles :
  - Pour `workspace-setup` : deleguer systematiquement la tache avec
    `skipSetup: true` pour verifier l'etat physique du depot Git
    (reparer/pruner si necessaire).
  - Pour les autres bootstrap tasks : adopter directement.
- checkpoint absent : relancer la bootstrap task ;
- checkpoint partiel ou temporaire : ignorer ou mettre en quarantaine, puis
  relancer si la task est idempotente ;
- checkpoint terminal `failed` ou `errored` : fail-closed, sauf policy
  explicite de relance ;
- checkpoint valide mais artefact metier manquant ou invalide : fail-closed ;
- checkpoint valide mais ownership, containment ou hashes incompatibles :
  fail-closed.

### 5.2 Idempotence et retry

`run-init` est idempotent dans le perimetre d'un meme `runId`, jamais entre
deux invocations `/go` distinctes.

```text
new /go invocation → new Turnlock runId → new /go run
retry or resume      → same Turnlock runId → same WorkflowState or fail-closed
```

Inputs stables : `StateFile.runId`, `RepoCapture` (resolu depuis le
CWD), `WorkflowPolicy`, `CaptureContext`, refs runtime Turnlock, configuration
de stockage.

`run-init` calcule des hashes JCS pour les inputs semantiques selon
[`canonical-hashing.md`](../standards/canonical-hashing.md) :

```text
repoCaptureHash  = canonicalHash(RepoCapture)
workflowPolicyHash = canonicalHash(WorkflowPolicy)
captureContextHash = canonicalHash(CaptureContext)
```

Ces hashes sont stockes dans `RunInitRecord` et `RunInitOwnershipMarker`.

**Ownership marker.** Le `RunInitOwnershipMarker` est publie atomiquement (par
creation exclusive ou temp-file + rename). Il embarque le `TurnlockRunRef`
complet. Un retry ne peut adopter une ref existante que si `runId`,
`TurnlockRunRef`, les refs et les hashes correspondent.

Regles de retry :

- si `state.data.runInit` existe deja, que les hashes matchent et que le
  marker est valide : retourner l'etat deja initialise ;
- si `state.data.runInit` existe mais hashes differents : echoue ferme ;
- si `state.data.runInit` existe mais marker absent/invalide : echoue ferme ;
- si `artefactRootRef` existe avec un ownership marker d'un autre `runId` :
  echoue ferme ;
- si `artefactRootRef` existe sans ownership marker verifiable : echoue ferme
  ou quarantaine explicite ;
- si `worktreeRootReservedPath` existe comme checkout Git physique : adoption
  depend du diagnostic de `workspace-setup` avec `skipSetup: true` (branche, lien
  `.git`, `baseHeadSha`) ; si invalide, nettoye et recree ;
- si `worktreeRootReservedPath` existe comme placeholder vide reference par
  l'ownership marker du meme `runId` : adoption possible ;
- si une ref reservee sort du namespace du run apres resolution canonique :
  echoue ferme.

Regles de temps :

- `initializedAt` est choisi une seule fois pour un run initialise ;
- un retry apres publication stable reutilise `initializedAt` ;
- si un marker autoritatif existe avant publication stable, le retry reutilise
  le `createdAt` du marker comme `initializedAt` ;
- les timestamps ne servent jamais a decider de l'appartenance au run.

### 5.3 Resume et crash recovery

Turnlock classe l'etat runtime avant de relancer. `/go` classe ensuite le
payload `WorkflowState`.

Cas normatifs :

- `StateFile` absent : nouveau run ou erreur de resume selon l'appelant ;
- `StateFile` invalide : Turnlock echoue ferme avant `/go` ;
- schema `StateFile` inconnu : Turnlock echoue ferme ou exige migration ;
- lock runtime actif vivant : Turnlock refuse ou attend selon sa policy ;
- lock runtime stale : Turnlock gere la reprise et l'audit selon sa policy ;
- `StateFile` valide, schema `"go.bootstrap-state.v1"` : reprise a `run-init`
  si `currentPhase` le permet ;
- `StateFile` valide, schema `"go.workflow-state.v1"`, `runInit` valide, sans
  delegation pending : reprise depuis `bootstrapTasks`, `currentStage` et
  artefacts deja projetes ;
- `StateFile` valide, `pendingDelegation.label` vaut `"implementation"` :
  Turnlock reprend a `pendingDelegation.resumeAt` ;
- `StateFile` valide mais payload `/go` absent ou schema inconnu : echec ferme
  ou migration explicite.

Chaque bootstrap branch doit pouvoir etre reprise independamment (non demarree,
en cours, terminee avec artefact valide, terminee avec artefact invalide,
echouee). Cette information vit dans les records de bootstrap task et les
`WorkflowExecutionRecord`.

*Note de securite sur la reconstruction du worktree* : La reconstruction ou restauration du worktree physique apres la finalisation de `run-init` (par exemple suite a la perte ou suppression accidentelle du dossier du worktree en cours d'implementation) releve de la responsabilite de l'orchestrateur ou du runtime Turnlock lors du resume de la phase correspondante. La bootstrap task `workspace-setup` ne doit en aucun cas etre re-invoquee en dehors de la phase `run-init` pour regenerer ou valider l'etat du worktree en cours d'implementation, afin d'eviter toute destruction accidentelle de modifications de code actives.

### 5.4 Retention

`run-init` ne supprime pas silencieusement les donnees d'un run existant.
Turnlock reste responsable de la retention runtime globale.

Si un vieux `runDir`, un lock stale, ou un `StateFile` incomplet est detecte,
Turnlock ou l'appelant choisit une action explicite : reprendre, quarantaine,
echec avec instruction de nettoyage, ou policy de retention. Un nouveau `/go`
ne reutilise jamais un `runId` existant.

---

## 6. Regles et frontieres

### 6.1 Non-responsabilites

Le noyau bootstrap de `run-init` ne doit pas :

- analyser l'intention utilisateur ;
- resumer le prompt `/go` ;
- extraire des contraintes ou criteres d'acceptation ;
- resoudre les specs applicables ;
- inventer ou modifier la policy du run ;
- detecter la branche par defaut ;
- creer le `StateFile` Turnlock ;
- ecrire atomiquement `state.json` ;
- creer le lock runtime Turnlock ;
- creer l'horloge ou le logger runtime ;
- modifier le repo cible ;
- lancer des tests, builds, installs ou commandes metier.

### 6.2 Path containment

Tous les chemins ou references locaux produits par `run-init` doivent etre
valides avant publication.

Regles :

- `runDir` fourni par Turnlock ne doit pas etre sous le repo cible ;
- `artefactRoot` ne doit pas etre sous le worktree ;
- `workflowLogRootRef`, s'il existe, ne doit pas etre sous le worktree ;
- `worktreeRootReservedPath` doit etre sous le namespace du run ;
- les chemins resolus ne doivent pas sortir de leur racine via `..` ou symlink ;
- aucune bootstrap task ne peut fournir un chemin absolu qui remplace une racine
  reservee par `run-init`.

Les checks de containment s'appliquent aux chemins locaux apres resolution
canonique. Pour le stockage distant : chaque ref est sous le namespace du
`runId`, les refs opaques sont stockees dans l'ownership marker et verifiees au
retry, et aucune ref n'est derivee d'un input utilisateur brut sans validation.

### 6.3 Regles de securite

- Aucune bootstrap branch ne peut ecrire dans le worktree d'une autre branche.
- Les artefacts de demarrage s'ecrivent hors worktree.
- Les commandes de discovery ne doivent pas installer d'outils.
- Les commandes de discovery ne doivent pas executer les tests lourds.
- Les joins doivent verifier les chemins et hashes avant projection.
- Les reviews ne peuvent pas se passer de `RunCaptureArtifact`.

---

## 7. Resume visuel

```text
Turnlock runtime envelope
│
├─ StateFile<RuntimeState>
├─ runDir
│  ├─ state.json
│  ├─ events.ndjson
│  └─ logs/
├─ runtime lock
├─ runtime clock
└─ runtime logger

/go run-init payload
│
├─ runId from StateFile
├─ BootstrapState input
│  ├─ invocationDirectory
│  ├─ WorkflowPolicy
│  └─ CaptureContext
├─ RepoCapture (resolu)
├─ TurnlockRunRef
├─ artefactRootRef
├─ ownershipMarkerRef
├─ worktreeRootReservedPath
├─ WorkflowState initial data
└─ bootstrapTasks initial records
```

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
