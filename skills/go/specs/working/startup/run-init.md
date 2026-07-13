# Phase Turnlock `run-init` et bootstrap/onboarding `/go`

Ce document definit comment la phase Turnlock `run-init` amorce un run `/go`,
execute les travaux de bootstrap/onboarding, et s'arrete sur la premiere
delegation agentique.

Le principe central est simple : le startup n'est pas un stage metier et les
travaux de startup ne sont pas des phases Turnlock separees. Ils sont des
startup tasks internes a `run-init`.

Les startup branches peuvent s'executer en parallele a l'interieur de
`run-init`. Elles produisent des artefacts, mais elles ne deviennent
autoritaires qu'au moment ou `run-init` les valide et les projette dans le
`WorkflowState` donne a Turnlock avec la delegation `implementation`.

---

## 1. Objectif

Le startup doit accomplir trois travaux independants :

- capturer les preuves du moment `/go` ;
- preparer le worktree Git prive ;
- decouvrir les commandes et capacites du repo.

Ces travaux n'ont pas les memes dependances. Les executer strictement en serie
rendrait le workflow plus lent sans ajouter de securite.

La phase `run-init` doit ensuite joindre ce qui est necessaire au premier travail
agentique, preparer l'input de delegation, puis appeler :

```text
io.delegate(
  { label: "implementation", ... },
  "implementation-settlement",
  workflowState
)
```

---

## 2. `run-init`

`run-init` est la premiere phase de l'orchestrateur Turnlock configure pour
`/go`.

Cela signifie que Turnlock l'execute, la reprend, la verrouille et persiste sa
transition comme une phase runtime. Son implementation appartient pourtant au
consommateur `/go`, pas au runtime Turnlock.

`run-init` n'est pas :

- une primitive generique fournie par Turnlock ;
- un stage metier `/go` ;
- une startup task parallele ;
- une phase obligatoire pour tous les orchestrateurs Turnlock.

Elle est obligatoire seulement pour le workflow `/go`, parce que `/go` doit
transformer `GoBootstrapState` en `WorkflowState`, executer le
bootstrap/onboarding, puis emettre la premiere delegation agentique.

Si plusieurs workflows Turnlock finissent par partager ce pattern bootstrap,
Turnlock pourra fournir une primitive generique de bootstrap. Tant que ce
pattern n'est prouve que par `/go`, il reste implemente cote `/go`.

Turnlock a deja cree l'enveloppe runtime avant que `run-init` s'execute :

- `StateFile<GoRuntimeState>` contenant un `GoBootstrapState` ;
- `runId` ULID valide ;
- `runDir` ;
- lock runtime exclusif ;
- ecriture atomique de `state.json` ;
- logger, horloges et journal d'events runtime.

`GoRuntimeState` est l'union durable :

```ts
type GoRuntimeState = GoBootstrapState | WorkflowState;
```

`run-init` initialise ou reserve ce qui appartient au workflow `/go` :

- `runId` fourni par Turnlock ;
- `RepositoryLaunchContext` lu depuis `GoBootstrapState` ;
- `WorkflowPolicy` lu depuis `GoBootstrapState` ;
- hashes JCS du `RepositoryLaunchContext` et du `WorkflowPolicy` ;
- reference vers l'enveloppe Turnlock ;
- `artefactRoot` ou reference equivalente ;
- chemin de worktree reserve ;
- `WorkflowState` initial ;
- startup task records ;
- resultats valides des startup tasks requises avant implementation ;
- input de delegation `implementation`.

Aucune startup branch ne demarre avant que `run-init` ait reserve ses refs
d'ecriture, car aucune startup branch ne doit inventer son propre emplacement
d'ecriture ou son propre identifiant.

`run-init` doit etre atomique du point de vue du workflow : soit Turnlock a
persiste un snapshot stable contenant `WorkflowState` et la delegation
`implementation`, soit aucune sortie de startup task ne devient autoritative.

### 2.1 `RepositoryLaunchContext`

Avant `run-init`, le parent process doit resoudre un
`RepositoryLaunchContext`.

Ce contexte contient :

- le repertoire d'invocation de la session ;
- les chemins actifs qui ont servi a choisir la cible ;
- la racine Git canonique cible ;
- le sous-perimetre projet optionnel ;
- les hints provider et branche cible ;
- l'information indiquant si un symlink gateway a ete resolu.

Le contrat detaille vit dans
[`launch-context.md`](./launch-context.md).

Le parent process stocke ce contexte dans `GoBootstrapState`. `run-init` le
valide en forme, le hash, puis le recopie dans `WorkflowState`, mais ne le
verifie pas contre Git. Il ne doit pas appeler `git rev-parse`, choisir entre
`main` et `master`, suivre des symlinks, ou corriger un repo cible.

Si `RepositoryLaunchContext` est absent, incomplet ou mal forme, `run-init`
echoue avant que les startup tasks internes ne puissent produire une evidence
autoritative.

`workspace-setup` est la premiere startup task qui verifie ce contexte contre
le repo Git reel.

#### 2.1.1 `WorkflowPolicy`

Avant `run-init`, le parent process ou la configuration `/go` doit aussi fournir
un `WorkflowPolicy`.

Cette policy fige les decisions qui ne doivent pas etre improvisees par une
startup task :

- adoption ou refus du dirty state initial ;
- correction autorisee ou non des hints parent ;
- rerun autorise ou non de la discovery depuis le worktree ;
- comportement si aucune gate fiable n'est detectee ;
- comportement des delegations agentiques et remediations ;
- obligation de `RunCaptureArtifact` pour les reviews ;
- conditions de packaging et de publication ;
- comportement de retention des runs incomplets.

Le parent process stocke cette policy dans `GoBootstrapState`. `run-init` valide
seulement sa forme et la recopie dans `WorkflowState`. Il ne choisit pas les
modes de policy et ne les modifie pas.

La validation de forme inclut les invariants minimaux necessaires a un hash JCS
stable : champs obligatoires presents, schemas connus, valeurs enum reconnues,
timestamps deja materialises, chemins deja resolus par le parent process, et
absence de champs non declares. Elle n'inclut pas la verification Git, la
discovery repo ou la correction des hints parent.

### 2.2 `runId`

`runId` est l'identifiant unique du run Turnlock. `/go` ne genere pas un second
identifiant. `WorkflowState.runId` doit etre identique a `StateFile.runId`.

Il sert de namespace a tout ce qui appartient au workflow :

- startup tasks ;
- stages ;
- artefacts metier ;
- evidence files ;
- logs ;
- branches de travail ;
- commits ;
- pull requests.

Forme normative pour `/go` :

```text
01ARZ3NDEKTSV4RRFFQ69G5FAV
```

Cette forme est le `runId` Turnlock nominal : un ULID Crockford base32 de 26
caracteres, genere par Turnlock quand le parent process ne fournit pas
`--run-id`.

Le profil `/go` exige que Turnlock valide `runId` avant de creer `runDir`. Cette
validation est une precondition de l'enveloppe runtime, pas une responsabilite
de `run-init`. En mode initial :

- le comportement nominal est de laisser Turnlock generer le `runId` ;
- si un parent process fournit explicitement `--run-id`, cette valeur doit
  deja matcher le format ULID Turnlock
  `/^[0-9A-HJKMNP-TV-Z]{26}$/` ;
- un `--run-id` externe non conforme doit etre refuse avant la creation de
  `runDir`, sans tentative de slugification ni de correction implicite ;
- si `run-init` observe malgre tout un `StateFile.runId` non conforme, il echoue
  ferme et signale une violation du profil runtime `/go`.

Les invariants sont :

- `runId` est genere une seule fois par Turnlock ;
- `runId` est immuable apres creation ;
- tout artefact durable `/go` reference le meme `runId` ;
- deux runs simultanes ne peuvent pas partager le meme `runId` ;
- `runId` est directement utilisable dans les chemins locaux, refs Git et
  namespaces distants du workflow `/go`, parce que `/go` exige le format ULID
  Turnlock ;
- `/go` ne definit pas de `runSlug` parallele a `runId`.

### 2.3 `runDir`

`runDir` est cree par Turnlock avant `run-init`. `/go` le reference comme racine
runtime, mais ne le cree pas et ne le verrouille pas.

Il doit etre hors du repo cible pour que les artefacts, logs et etats internes
ne rendent jamais le repo dirty.

Cette garantie est fournie avant le lancement de Turnlock : le parent process
doit configurer `runDirRoot` hors de `RepositoryLaunchContext.canonicalRepositoryRoot`.
`run-init` verifie ensuite par containment path que `runDir` n'est pas sous le
repo cible. Si cette verification echoue, `run-init` echoue ferme ; il ne tente
pas de deplacer `runDir`.

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
un stockage distant, mais `runDir` reste le conteneur logique du run. Les
references doivent conserver les memes proprietes :

- isolation entre runs ;
- evidence hors worktree ;
- reprise possible apres interruption ;
- chemins ou references derivables depuis `runId`.

`state.json`, `events.ndjson`, le lock runtime et les logs Turnlock sont
proprietes de Turnlock. `artefactRoot/`, `worktree/` et les sous-dossiers de
preuves sont des references metier `/go` placees sous ou a cote de cette
enveloppe runtime selon la configuration de stockage du run.

### 2.4 Frontieres de responsabilite

`run-init` initialise le payload `/go`, orchestre le bootstrap/onboarding
interne, puis delegue l'implementation. Il ne cree pas l'enveloppe runtime
Turnlock.

Responsabilites du parent process avant Turnlock :

- resoudre `RepositoryLaunchContext` ;
- fournir `WorkflowPolicy` ;
- configurer `runDirRoot` hors du repo cible ;
- ne pas fournir de `--run-id` externe sauf s'il est deja un ULID valide ;
- fournir `GoBootstrapState` comme `initialState` du run Turnlock.

Responsabilites de Turnlock avant `run-init` :

- creer `runDir` ;
- acquerir le lock runtime exclusif ;
- creer ou charger `StateFile<GoRuntimeState>` ;
- fournir `StateFile.runId` ;
- garantir que `StateFile.runId` respecte le format ULID du profil `/go` ;
- fournir les horloges runtime ;
- fournir le logger runtime ;
- fournir le journal d'events runtime ;
- persister les transitions stables par ecriture atomique de `state.json`.

Responsabilites de `run-init` :

- lire `GoBootstrapState` ;
- valider la forme du `RepositoryLaunchContext` parent ;
- valider la forme du `WorkflowPolicy` du run ;
- calculer et stocker les hashes JCS de ces inputs ;
- enregistrer une reference vers le run Turnlock ;
- verifier que `runDir` est hors du repo cible ;
- creer l'unique `artefactRoot` du run ;
- reserver ou referencer `workflowLogRoot` si le workflow a besoin de logs
  metier separes ;
- reserver `worktreeRoot` comme chemin logique du run ;
- ecrire ou verifier le marqueur d'ownership de `run-init` ;
- initialiser `startupTasks` ;
- executer ou coordonner les startup tasks internes ;
- joindre `workspace-setup` et `repo-discovery-draft` via
  `project-discovery-finalize` ;
- projeter les artefacts de startup valides dans `WorkflowState` ;
- preparer l'input de delegation agentique ;
- retourner a Turnlock une delegation `implementation` avec
  `resumeAt: "implementation-settlement"` et un `WorkflowState` complet en
  remplacement du `GoBootstrapState`.

Responsabilites de `workspace-setup` :

- verifier que `canonicalRepositoryRoot` est un repo Git ;
- verifier ou corriger les hints parent selon
  `WorkflowPolicy.launchContextMismatch` ;
- verifier que le chemin `worktreeRoot` reserve est utilisable ;
- creer le checkout Git physique prive ;
- creer la branche `work/<runId>` ;
- ecrire son propre sous-dossier d'artefacts sous `artefactRoot` ;
- produire `WorkSession`.

`run-init` ne doit pas creer de checkout Git a `worktreeRoot`. Si
l'implementation Git exige que le dossier cible n'existe pas avant
`git worktree add`, `run-init` doit seulement persister le chemin reserve. Si
elle autorise un dossier vide, ce dossier reste un placeholder, pas un worktree
autoritatif.

La startup task interne `workspace-setup` est la seule partie de `run-init` qui
cree le checkout Git physique. Cette distinction est importante pour
l'idempotence : le bootstrap de `run-init` reserve un chemin, puis
`workspace-setup` materialise ce chemin en worktree prouve.

`run-init` applique la regle des primitives externes definie dans
[`external-primitives.md`](../workflow/external-primitives.md). Il ne doit pas
definir un second runtime de lock, journal, retry, resume, logger, horloge ou
persistance atomique, car Turnlock est la primitive autoritative pour ces
responsabilites.

#### 2.4.1 Surface d'audit de `run-init`

`run-init` ne produit pas de `StageOutput`, car ce n'est pas un stage. La phase
elle-meme est l'exception bootstrap au contrat general
`WorkflowExecutionRecord-as-execution-envelope`.

Les startup tasks internes peuvent produire des `WorkflowExecutionRecord` ou des
enveloppes equivalentes. Ces records ne prouvent pas la reussite de `run-init`
par eux-memes : ils deviennent autoritatifs seulement quand `run-init` les
valide et les projette dans le `WorkflowState` persiste par Turnlock au moment
de la delegation.

La reussite de `run-init` est prouvee par quatre elements :

- le snapshot stable Turnlock qui remplace `GoBootstrapState` par
  `WorkflowState` dans `StateFile<GoRuntimeState>` ;
- `RunInitRecord` dans `WorkflowState.runInit` ;
- `RunInitOwnershipMarker` pour les refs reservees par `/go` ;
- `pendingDelegation` Turnlock pour `label: "implementation"` et
  `resumeAt: "implementation-settlement"`.

Les erreurs de `run-init` sont exposees par la transition Turnlock echouee, les
events runtime et, si possible, une evidence d'audit sous une ref de quarantaine
ou de diagnostic controlee par Turnlock. Elles ne doivent pas etre maquillees en
erreur de stage.

### 2.5 Lock runtime Turnlock

Turnlock possede le lock exclusif qui empeche deux processus de piloter le meme
run en meme temps. `/go` ne cree pas un second lock pour `run-init`.

Exemple local :

```text
<go-run-root>/runs/<runId>/.lock
```

Le lock est un mutex de processus pour le run Turnlock. Ce n'est pas un lock Git
et ce n'est pas un artefact metier `/go`.

Si `/go` a besoin d'auditer le lock, il reference les events ou metadata
exposes par Turnlock. Il ne duplique pas l'autorite du lock dans
`WorkflowState`.

Ce lock empeche :

- la reprise concurrente du meme run ;
- la corruption croisee de `state.json` ;
- deux projections concurrentes dans `WorkflowState` ;
- deux mutations concurrentes du meme worktree prive ;
- deux publications concurrentes pour le meme package de changements.

### 2.6 `artefactRoot`

`artefactRoot` est le dossier ou les preuves du run sont ecrites. Il est
distinct du worktree.

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
│       ├── lint-output.txt
│       └── test-output.txt
└── ...
```

Regles normatives :

- `artefactRoot` est hors worktree — les artefacts ne doivent pas rendre le
  worktree dirty ni apparaitre dans `git status`, `trackedWorktreeHash`, ou
  les diffs. Le code modifiable et les preuves du run vivent dans des dossiers
  separes.
- `run-init` cree l'unique `artefactRoot` du run ;
- `artefactRoot` doit etre cree avec une primitive exclusive, ou adopte
  seulement avec un ownership marker valide du meme `runId` ;
- chaque workflow unit ecrit dans son propre sous-dossier ;
- chaque workflow unit cree seulement son propre sous-dossier ;
- les `output.json` restent sous le sous-dossier de leur unit ;
- les evidence files restent sous un dossier `evidence/` ou sous un fichier
  explicitement reference par l'artefact metier ;
- un sous-dossier d'artefact ne doit pas etre reutilise silencieusement entre
  deux executions distinctes ;
- les references d'evidence doivent etre verifiees avant projection dans
  `WorkflowState`.

Les startup tasks internes ecrivent leurs preuves sous
`artefactRoot/startup/<task>/`. Chaque task publie un `task-record.json`
terminal par ecriture atomique seulement quand son resultat est complet,
schema-valide et verifie contre les inputs stables du run.

Une implementation peut remplacer `artefactRoot` par une reference equivalente,
par exemple un bucket ou un store distant. Dans ce cas, les memes garanties
s'appliquent : isolation du run, evidence hors worktree, hashes verifiables et
reprise deterministe. Les refs distantes que `/go` construit doivent etre
namespaced par `runId`. Si le provider retourne un identifiant opaque, cet
identifiant doit etre stocke dans l'ownership marker et relu au retry ; il ne
remplace pas `runId` comme namespace logique du workflow.

### 2.7 Etat initial minimal

Turnlock demarre `/go` avec un `GoBootstrapState` minimal dans `StateFile.data`.
`run-init` produit ensuite le premier `WorkflowState` complet, et Turnlock le
persiste par transition atomique.

Exemple conceptuel avant `run-init` :

```jsonc
{
  "schemaVersion": "<turnlock-state-schema-version>",
  "runId": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "orchestratorName": "go",
  "currentPhase": "run-init",
  "data": {
    "schema": "go.bootstrap-state.v1",
    "launchContext": {
      "schema": "go.repository-launch-context.v1",
      "invocationDirectory": "<session-cwd>",
      "activePathRefs": ["<active-file-or-directory>"],
      "canonicalRepositoryRoot": "<canonical-repository-root>",
      "projectRoot": "<optional-project-root>",
      "providerHint": "github",
      "remoteNameHint": "origin",
      "defaultTargetBranchHint": "main",
      "resolutionSource": "active-path",
      "symlinkResolved": true,
      "resolvedAt": "2026-07-12T14:30:00.000Z"
    },
    "policy": {
      "schema": "go.workflow-policy.v1",
      "...": "<policy-fields>"
    }
  }
}
```

Exemple conceptuel apres le snapshot stable emis par `run-init` avec delegation
`implementation`.

Le bloc `pendingDelegation` ci-dessous illustre la responsabilite Turnlock. Sa
forme exacte est Turnlock-owned ; `/go` ne doit lire que le contrat public de
reprise fourni par Turnlock, pas dependra de champs internes non documentes.

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
      "launchContext": {
        "schema": "go.repository-launch-context.v1",
        "invocationDirectory": "<session-cwd>",
        "activePathRefs": ["<active-file-or-directory>"],
        "canonicalRepositoryRoot": "<canonical-repository-root>",
        "projectRoot": "<optional-project-root>",
        "providerHint": "github",
        "remoteNameHint": "origin",
        "defaultTargetBranchHint": "main",
        "resolutionSource": "active-path",
        "symlinkResolved": true,
        "resolvedAt": "2026-07-12T14:30:00.000Z"
      },
      "launchContextHash": "sha256:<canonical-launch-context-hash>",
      "workflowPolicyHash": "sha256:<canonical-workflow-policy-hash>",
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
      "launchContextMismatch": {
        "repositoryRootMismatch": "fail",
        "projectRootOutsideRepository": "fail",
        "defaultTargetBranchMismatch": "correct-and-record",
        "providerMismatch": "correct-and-record"
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
      "provider": "github",
      "remoteName": "origin",
      "defaultTargetBranch": "main"
    },
    "currentStage": "implementation",
    "startupTasks": [
      {
        "task": "run-capture",
        "status": "passed",
        "businessArtifactIds": ["run-capture:<id>"],
        "requiredBefore": [
          "implementation",
          "pre-package-review",
          "pr-ci-review"
        ]
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
delegation agentique `implementation`. Les travaux de demarrage sont suivis par
`startupTasks`, pas par `currentStage`.

`currentPhase` est un pointeur Turnlock vers la prochaine phase runtime stable.
Pendant une delegation Turnlock, `currentPhase` peut rester sur la phase qui a
emis la delegation ; l'autorite de reprise vit alors dans `pendingDelegation`
et son `resumeAt`. Il ne doit pas etre confondu avec
`WorkflowState.currentStage`.

Tout ce qui suit `run-init` est une mutation tracee de ce payload initial.

Le champ `repository` est initialise depuis le `RepositoryLaunchContext`. Il
n'est pas encore une preuve Git autoritative. `workspace-setup` le verifie,
corrige selon `WorkflowPolicy.launchContextMismatch`, ou echoue ferme.

### 2.8 Publication atomique

L'atomicite de `run-init` est portee par Turnlock. Aucune startup task ne peut
publier un resultat autoritatif tant que `run-init` n'a pas reserve les refs du
run et tant que Turnlock n'a pas persiste un snapshot stable contenant le
`WorkflowState` projete.

Sequence normative :

```text
Turnlock creates runtime envelope
Turnlock persists StateFile<GoRuntimeState> with GoBootstrapState
Turnlock dispatches run-init
run-init reads GoBootstrapState
run-init validates RepositoryLaunchContext shape from GoBootstrapState
run-init validates WorkflowPolicy shape from GoBootstrapState
run-init hashes canonical launch inputs
run-init creates or reserves /go artefact refs
run-init reserves worktreeRoot path
run-init writes or verifies ownership marker
run-init starts startup branches
run-init runs workspace-setup
run-init runs or finalizes repo discovery
run-init joins project-discovery-finalize
run-init joins run-capture
run-init prepares implementation delegation input
run-init returns io.delegate(label=implementation, resumeAt=implementation-settlement)
Turnlock validates state schema
Turnlock atomically writes StateFile<GoRuntimeState> with WorkflowState and
pendingDelegation
Turnlock emits delegation protocol and exits
```

Regles :

- `state.json` est ecrit atomiquement par Turnlock ;
- `run-init` ne publie pas de marqueur de completion separe ;
- le snapshot stable Turnlock est l'unique preuve que `run-init` a reussi ;
- apres un snapshot stable, `state.data.schema` vaut
  `"go.workflow-state.v1"` ;
- une startup task refuse de produire une evidence autoritative si
  `state.data.runInit` est absent ou invalide ;
- la reprise apres delegation passe par `pendingDelegation.resumeAt`, pas par
  une phase startup intermediaire ;
- les fichiers temporaires ou incomplets de Turnlock ne sont jamais
  autoritatifs pour `/go`.

#### 2.8.1 Checkpoints internes de startup

Les startup tasks internes de `run-init` publient des checkpoints sous
`artefactRoot/startup/<task>/task-record.json`.

Ces checkpoints sont des preuves de reprise pour `run-init`; ils ne sont pas une
seconde source de verite concurrente a `StateFile<GoRuntimeState>`.

Forme normative minimale :

```ts
type StartupTaskCheckpointRecord = {
  schema: "go.startup-task-checkpoint.v1";
  runId: string;
  task:
    | "run-capture"
    | "repo-discovery-draft"
    | "workspace-setup"
    | "project-discovery-finalize";
  status: "passed" | "failed" | "errored" | "cancelled";
  inputHash: string;
  launchContextHash: string;
  workflowPolicyHash: string;
  businessArtifactIds: string[];
  evidenceRefs: string[];
  startedAt: string;
  endedAt: string;
};
```

Regles :

- `task-record.json` est ecrit atomiquement ;
- aucun `task-record.json` non terminal n'est autoritatif ;
- `inputHash` couvre les inputs exacts de la startup task, pas seulement le
  nom de la task ;
- `launchContextHash` et `workflowPolicyHash` doivent matcher le
  `RunInitRecord` courant ;
- `runId` doit matcher `StateFile.runId` ;
- chaque `businessArtifactId` doit pointer vers un artefact JSON schema-valide ;
- chaque `evidenceRef` doit rester sous l'`artefactRoot` du run ;
- un fichier temporaire, partiel, illisible ou schema-invalide est ignore ou
  mis en quarantaine ; il n'est jamais adopte silencieusement.

Sur retry de `run-init` :

- checkpoint terminal valide et hashes compatibles : adopter ;
- checkpoint absent : relancer la startup task ;
- checkpoint partiel ou temporaire : ignorer ou mettre en quarantaine, puis
  relancer si la task est idempotente ;
- checkpoint terminal `failed` ou `errored` : reprendre la decision fail-closed,
  sauf si une policy explicite autorise une relance ;
- checkpoint valide mais artefact metier manquant ou invalide : fail-closed ;
- checkpoint valide mais ownership, containment ou hashes incompatibles :
  fail-closed.

#### 2.8.2 Idempotence et retry

`run-init` peut etre execute plusieurs fois pour le meme run Turnlock. Il ne
doit pourtant publier qu'un seul payload initialise pour un `runId` donne.

Modele normatif :

```text
new /go invocation
-> new Turnlock runId
-> new /go run

retry or resume of run-init
-> same Turnlock runId
-> same initialized WorkflowState or fail-closed
```

`run-init` est donc idempotent **dans le perimetre d'un meme `runId`**, mais il
n'est jamais idempotent entre deux invocations `/go` distinctes.

Inputs stables :

- `StateFile.runId` fourni par Turnlock ;
- `RepositoryLaunchContext` lu depuis `GoBootstrapState` ;
- `WorkflowPolicy` lu depuis `GoBootstrapState` ;
- refs runtime Turnlock ;
- configuration de stockage du run.

`run-init` doit calculer des hashes JCS pour les inputs semantiques qu'il
stocke, selon le profil JCS `/go` defini dans
[`canonical-hashing.md`](../workflow/canonical-hashing.md) :

```text
launchContextHash = canonicalHash(RepositoryLaunchContext)
workflowPolicyHash = canonicalHash(WorkflowPolicy)
```

Ces hashes sont stockes dans `RunInitRecord` et dans
`RunInitOwnershipMarker`.

Refs creees ou reservees par `run-init` :

- `artefactRootRef` ;
- `workflowLogRootRef`, si present ;
- `worktreeRootReservedPath` ;
- `ownershipMarkerRef`.

Ces refs doivent etre deterministes pour un meme `runId`, ou bien persistées
dans le `RunInitOwnershipMarker` avant tout effet de bord qui depend d'elles.
Un retry ne doit jamais regenerer aleatoirement une ref deja reservee.

Le `RunInitOwnershipMarker` doit etre publie atomiquement :

- en stockage local, par creation exclusive ou par temp file plus rename
  atomique dans le meme dossier ;
- en stockage distant, par une primitive conditionnelle equivalente, par exemple
  "create if absent" avec precondition de version ou d'existence ;
- jamais par overwrite silencieux d'un marker existant.

Un marker partiel, illisible, schema-invalide ou dont les hashes ne matchent pas
les inputs de resume n'est pas autoritatif.

Le marker doit embarquer le `TurnlockRunRef` complet (`runId`, `runDirRef`,
`stateFileRef`, `eventsRef` si present). Un retry qui trouve une ref existante
ne peut l'adopter que si ce `TurnlockRunRef`, les refs reservees et les hashes
correspondent au run courant.

Le `RunInitOwnershipMarker.createdAt` doit etre identique a
`RunInitRecord.initializedAt` pour un run publie. Si une implementation a besoin
de tracer un timestamp physique d'ecriture du marker, elle doit l'ecrire comme
metadata d'evidence non autoritative, pas comme timestamp metier distinct.

Regles de retry :

- si `state.data.runInit` existe deja, que les hashes matchent les inputs de
  resume, et que le `RunInitOwnershipMarker` reference est valide, `run-init`
  retourne l'etat deja initialise sans regenerer de refs ;
- si `state.data.runInit` existe deja mais que `launchContextHash` ou
  `workflowPolicyHash` differe, `run-init` echoue ferme ;
- si `state.data.runInit` existe deja mais que le marker reference est absent,
  illisible ou invalide, `run-init` echoue ferme ou demande une reparation
  explicite au runtime ; il ne doit pas continuer sur l'etat seul ;
- si un `RunInitOwnershipMarker` valide existe mais qu'aucune transition stable
  Turnlock ne contient `state.data.runInit`, `run-init` peut reprendre les refs
  du marker seulement si le `runId`, le `TurnlockRunRef`, les refs et les
  hashes matchent exactement les inputs de resume ; sinon il met les refs en
  quarantaine ou echoue ferme ;
- si `artefactRootRef` existe avec un `RunInitOwnershipMarker` valide pour le
  meme `runId`, les memes refs et les memes hashes, `run-init` l'adopte ;
- si `artefactRootRef` existe avec un ownership marker d'un autre `runId`,
  `run-init` echoue ferme ;
- si `artefactRootRef` existe sans ownership marker verifiable, `run-init`
  echoue ferme ou demande une quarantaine explicite au runtime ;
- si `worktreeRootReservedPath` existe deja comme checkout Git physique,
  `run-init` peut l'adopter seulement si le checkpoint `workspace-setup` est
  terminal et valide, si `WorkSession` reference exactement ce chemin, si la
  branche `work/<runId>` existe, si `baseHeadSha` et les hashes d'inputs
  matchent, et si l'ownership marker lie ce worktree au meme run ;
- si `worktreeRootReservedPath` existe deja comme checkout Git physique sans
  checkpoint `workspace-setup` adoptable, `run-init` echoue ferme ou met le
  chemin en quarantaine explicite ;
- si `worktreeRootReservedPath` existe comme placeholder vide et qu'il est
  prouvablement reference par l'ownership marker du meme `runId`, `run-init`
  peut l'adopter ;
- si une ref reservee sort du namespace du run apres resolution canonique,
  `run-init` echoue ferme.

Regles de temps :

- `initializedAt` est choisi une seule fois pour un run initialise ;
- un retry apres publication stable reutilise `initializedAt` ;
- un retry avant publication stable peut produire un nouveau timestamp seulement
  s'il ne reste aucun `RunInitOwnershipMarker` autoritatif ;
- si un marker autoritatif existe avant publication stable, le retry reutilise
  le `createdAt` du marker comme `initializedAt` ;
- les timestamps ne doivent jamais servir a decider qu'un chemin appartient au
  run.

Le marqueur d'ownership est une preuve d'idempotence, pas une seconde source de
verite. La publication stable reste la transition atomique Turnlock vers
`WorkflowState` dans `StateFile<GoRuntimeState>`.

### 2.9 Horloge du run

Turnlock fournit l'horloge de reference du run. `run-init` ne cree pas une
seconde horloge.

Le run doit avoir un `startedAt` stable, puis des timestamps derives ou emis de
maniere coherente pour :

- `createdAt` ;
- `startedAt` ;
- `endedAt` ;
- `capturedAt` ;
- timestamps d'evidence ;
- timestamps de logs.

Pseudo-code conceptuel :

```ts
const initializedAt = io.clock.nowWallIso();
```

L'objectif n'est pas de figer tous les timestamps a la meme valeur. L'objectif
est d'eviter des horodatages eparpilles et incomparables. Les records du run
doivent utiliser la source d'horloge Turnlock.

### 2.10 Logger du run

Turnlock fournit le logger runtime scope au run. `run-init` peut reserver un
sous-dossier de logs metier, mais ne cree pas un second logger autoritatif.

Tous les messages de Turnlock, startup tasks et stages doivent pouvoir etre
rattaches au meme `runId`.

Exemple :

```ts
runLogger.info("stage.started", { stage: "implementation", runId });
runLogger.error("stage.errored", { stage: "mechanical-gates", error });
```

Regles normatives :

- le logger ecrit sous `runDir/logs/` ou dans une reference equivalente ;
- les logs incluent `runId` ;
- les logs de stage incluent le nom de la workflow unit ;
- les logs ne remplacent jamais les artefacts et evidence files normatifs ;
- `workflowLogRootRef`, si present, est un espace de logs metier
  non-autoritatif ;
- les traces distribuees, si elles deviennent necessaires, doivent passer par
  Turnlock ou une primitive externe explicite comme OpenTelemetry, pas par un
  second systeme de tracing `/go` ;
- les stages ne doivent pas produire de traces dispersees impossibles a relier
  au run.

### 2.11 Resume et crash recovery

Turnlock classe l'etat runtime avant de relancer quoi que ce soit. `/go` classe
ensuite le payload `WorkflowState`.

Cas normatifs :

- `StateFile` absent : nouveau run ou erreur de resume selon l'appelant ;
- `StateFile` invalide : Turnlock echoue ferme avant `/go` ;
- schema `StateFile` inconnu : Turnlock echoue ferme ou exige migration
  explicite ;
- lock runtime actif vivant : Turnlock refuse ou attend selon sa policy ;
- lock runtime stale : Turnlock gere la reprise et l'audit selon sa policy ;
- `StateFile` valide dont `state.data.schema` vaut `"go.bootstrap-state.v1"` :
  reprise a `run-init` si `currentPhase` le permet ;
- `StateFile` valide dont `state.data.schema` vaut `"go.workflow-state.v1"` et
  dont `state.data.runInit` est valide, sans delegation pending : reprise depuis
  `startupTasks`, `currentStage` et artefacts deja projetes ;
- `StateFile` valide dont `state.data.schema` vaut `"go.workflow-state.v1"` et
  dont `pendingDelegation.label` vaut `"implementation"` : Turnlock reprend a
  `pendingDelegation.resumeAt`, normalement `implementation-settlement` ;
- `StateFile` valide mais payload `/go` absent, incomplet ou de schema inconnu :
  echec ferme ou migration explicite.

Si `/go` detecte une incoherence dans `WorkflowState`, il produit une evidence
d'audit sous `artefactRoot` ou dans les logs metier. Il ne reecrit pas les
garanties runtime de Turnlock.

### 2.12 Path containment

Tous les chemins ou references locaux produits par `run-init` doivent etre
valides avant publication.

Regles :

- `runDir` fourni par Turnlock ne doit pas etre sous le repo cible ;
- `artefactRoot` ne doit pas etre sous le worktree ;
- `workflowLogRootRef`, s'il existe, ne doit pas etre sous le worktree ;
- `worktreeRootReservedPath` doit etre sous le namespace du run ou dans un
  emplacement de worktrees explicitement reserve ;
- les chemins resolus ne doivent pas sortir de leur racine via `..` ou symlink ;
- aucune startup task ne peut fournir un chemin absolu qui remplace une racine
  reservee par `run-init`.

Les checks de containment s'appliquent aux chemins locaux apres resolution
canonique. Pour un stockage distant, l'implementation doit appliquer la meme
idee avec des prefixes places sous le namespace du `runId` :

- chaque ref distante construite par `/go` est sous le namespace du `runId` ;
- chaque ref distante opaque retournee par un provider est stockee dans
  l'ownership marker et verifiee au retry ;
- une ref distante ne peut pas etre derivee d'un input utilisateur brut sans
  validation de charset, longueur et segments interdits ;
- une ref distante ne peut pas pointer vers un prefixe partage par plusieurs
  runs sauf si le stockage fournit une isolation equivalent au namespace local ;
- les operations de retry doivent relire et verifier l'ownership marker avant
  d'adopter une ref distante existante.

### 2.13 Retention et nettoyage

`run-init` ne supprime pas silencieusement les donnees d'un run existant.
Turnlock reste responsable de la retention runtime globale.

Si un vieux `runDir`, un lock stale, ou un `StateFile` incomplet est detecte,
Turnlock ou l'appelant doit choisir une action explicite :

- reprendre le run si l'appelant demande un resume ;
- mettre le run incomplet en quarantaine ;
- echouer avec instruction de nettoyage manuel ;
- appliquer une policy de retention documentee.

Un nouveau `/go` ne reutilise jamais un `runId` existant.

### 2.14 Resume visuel

```text
Turnlock runtime envelope
│
├─ StateFile<GoRuntimeState>
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
├─ GoBootstrapState input
├─ RepositoryLaunchContext
├─ WorkflowPolicy
├─ TurnlockRunRef
├─ artefactRootRef
├─ ownershipMarkerRef
├─ worktreeRootReservedPath
├─ WorkflowState initial data
└─ startupTasks initial records
```

### 2.15 Non-responsabilites

`run-init` est purement mecanique. Son noyau bootstrap ne doit pas :

- analyser l'intention utilisateur ;
- resumer le prompt `/go` ;
- extraire des contraintes ou criteres d'acceptation ;
- resoudre les specs applicables ;
- inventer ou modifier la policy du run ;
- resoudre le repo cible ;
- verifier la racine Git ;
- detecter la branche par defaut ;
- suivre des symlinks ;
- creer le `StateFile` Turnlock ;
- ecrire atomiquement `state.json` ;
- creer le lock runtime Turnlock ;
- creer l'horloge ou le logger runtime ;
- modifier le repo cible ;
- lancer des tests, builds, installs ou commandes metier.

Ces responsabilites appartiennent aux startup tasks internes, aux stages du
workflow ou aux reviews. Par exemple, `workspace-setup` cree le worktree prive
comme sous-tache de `run-init`, et `project-discovery-finalize` produit le
`ProjectDiscovery` autoritatif comme startup join interne.

---

## 3. Graphe de demarrage

Dans `run-init`, le graphe nominal est :

```text
run-init
├─ run-capture
├─ repo-discovery-draft
└─ workspace-setup
       ↓
project-discovery-finalize
       ↓
join run-capture
       ↓
delegate implementation
       ↓ resumeAt
implementation-settlement
```

`run-capture` et `repo-discovery-draft` sont des startup branches. Elles
peuvent s'executer pendant que `workspace-setup` cree le worktree physique
prive.

`project-discovery-finalize` est le startup join entre `workspace-setup` et
`repo-discovery-draft`. Il produit le `ProjectDiscovery` autoritatif avant que
`run-init` ne puisse deleguer `implementation`.

`pre-package-review` et `pr-ci-review` sont les points de jonction qui exigent
`RunCaptureArtifact`.

Pour v1, `run-init` exige aussi un `RunCaptureArtifact` valide avant de deleguer
`implementation`. `run-capture` reste parallele aux autres startup branches, mais
il est joint avant la sortie de `run-init`.

---

## 4. Regle d'autorite

Une startup branch ne modifie pas directement `WorkflowState`.

Elle produit :

- un artefact metier typé ;
- des evidence refs ;
- un `WorkflowExecutionRecord` ;
- un `StageOutput` seulement si elle passe par le stage harness.

`run-init` applique ensuite une projection dans le `WorkflowState` qu'il remet a
Turnlock :

```text
validate artifact schema
validate evidence containment
validate hashes
project into WorkflowState
```

Cette regle evite les courses d'ecriture entre branches de demarrage.

---

## 5. Echecs paralleles et cancellation

`run-init` execute des startup branches en parallele, mais leur echec reste
fail-closed.

Regles normatives :

- si `workspace-setup` echoue, `run-init` annule les startup branches encore
  actives, attend leur terminaison controlee ou leur timeout court, puis
  echoue ;
- si `project-discovery-finalize` echoue, `run-init` annule les branches encore
  actives et echoue ;
- si `repo-discovery-draft` echoue, `project-discovery-finalize` peut relancer
  la discovery depuis `worktreeRoot` seulement si `WorkflowPolicy.discovery`
  l'autorise ; sinon `run-init` echoue ;
- si `run-capture` echoue, `run-init` echoue ou ouvre la HumanGate prevue par
  policy ; v1 ne delegue pas `implementation` sans `RunCaptureArtifact` valide ;
- une task annulee ecrit un `task-record.json` terminal `cancelled` si elle peut
  le faire sans masquer la cause racine ;
- une task qui a produit des fichiers partiels sans checkpoint terminal valide
  ne produit aucune preuve autoritative ;
- au retry, les fichiers partiels sont ignores ou mis en quarantaine avant
  relance ;
- aucune sortie partielle n'est projetee dans `WorkflowState`.

La cancellation doit utiliser les primitives runtime disponibles, notamment
`io.signal`, les timeouts Turnlock et les ecritures atomiques. Elle ne doit pas
introduire un second scheduler ou un second systeme de lock propre a `/go`.

---

## 6. Joins fail-closed

Un startup join est un point ou le chemin principal exige qu'une startup branch
ait produit un resultat valide.

Joins normatifs :

```text
project-discovery-finalize requires:
  - WorkSession
  - RepositoryDiscoveryDraft or permission to rerun discovery from worktree

implementation delegation requires:
  - WorkSession
  - ProjectDiscovery
  - RunCaptureArtifact

pre-package-review requires:
  - RunCaptureArtifact
  - final ChangeSnapshot
  - ProjectDiscovery
  - CheckRun results for required gates

pr-ci-review requires:
  - RunCaptureArtifact
  - PullRequestRecord
  - package verification evidence
  - provider state for the published PR
```

Si un join ne peut pas prouver ses inputs, il echoue ferme. Il ne continue pas
sur une inference libre.

---

## 7. `run-capture` ne bloque pas les autres branches

La delegation `implementation` n'a pas besoin de lire le `RunCaptureArtifact`
pour comprendre la demande. L'agent d'implementation est deja dans la session
qui a declenche `/go` et recoit le contexte du parent.

Le `RunCaptureArtifact` sert aux reviews et a l'audit :

- prouver quel prompt a declenche le run ;
- relire un extrait minimal de session ;
- comparer les hashes ;
- permettre a une review ulterieure de reconstruire l'intention.

`run-init` doit lancer `run-capture` des que les refs d'artefacts sont
disponibles. Pour v1, il ne delegue pas `implementation` tant que
`RunCaptureArtifact` n'est pas terminal, schema-valide, hash-verifie et projete
dans le `WorkflowState` remis a Turnlock.

Cette regle garde le parallelisme utile : `run-capture` ne bloque pas
`workspace-setup`, `repo-discovery-draft` ou `project-discovery-finalize`.
Elle bloque seulement la sortie finale de `run-init`.

Comme Turnlock termine le process apres `io.delegate`, v1 interdit de laisser
`run-capture` continuer comme simple tache in-process apres la delegation. Un
mode sidecar parent ou ensure-before-review pourra etre ajoute plus tard, mais
il n'est pas le comportement nominal de ce contrat.

---

## 8. `repo-discovery-draft` ne suffit pas

`repo-discovery-draft` peut lire le checkout source pendant que le worktree est
cree. Ce resultat n'est qu'un brouillon.

`project-discovery-finalize` doit ensuite verifier que les fichiers inspectes
correspondent au worktree prive :

```text
draft inspected package.json hash == worktree package.json hash
draft inspected lockfile hash == worktree lockfile hash
draft inspected config hash == worktree config hash
```

Si les hashes matchent, le draft peut etre finalise. Sinon,
`project-discovery-finalize` relance la discovery depuis `worktreeRoot` ou
echoue ferme selon `WorkflowPolicy.discovery`.

---

## 9. Etat et reprise

Chaque startup branch doit etre reprise independamment.

Un resume Turnlock doit pouvoir distinguer :

- startup branch non demarree ;
- startup branch en cours ;
- startup branch terminee avec artefact valide ;
- startup branch terminee avec artefact invalide ;
- startup branch echouee.

Cette information vit dans des records de startup task et dans les
`WorkflowExecutionRecord`. `WorkflowState.currentStage` represente le chemin
metier principal apres startup, pas toutes les branches actives.

---

## 10. Regles de securite

- Aucune startup branch ne peut ecrire dans le worktree d'une autre branche.
- Les artefacts de demarrage s'ecrivent hors worktree.
- Les commandes de discovery ne doivent pas installer d'outils.
- Les commandes de discovery ne doivent pas executer les tests lourds.
- Les joins doivent verifier les chemins et hashes avant projection.
- Les reviews ne peuvent pas se passer de `RunCaptureArtifact`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
