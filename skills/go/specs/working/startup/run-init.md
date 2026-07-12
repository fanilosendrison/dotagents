# `run-init` et parallelisme de demarrage `/go`

Ce document definit comment `/go` lance plusieurs travaux de demarrage sans
transformer le workflow en sequence inutilement lente.

Le principe central est simple : le startup n'est pas un stage metier. C'est
l'amorcage mecanique du run.

Les startup branches peuvent produire des artefacts, mais elles ne deviennent
autoritaires qu'au moment ou Turnlock les valide et les projette dans
`WorkflowState`.

---

## 1. Objectif

Le startup doit accomplir trois travaux independants :

- capturer les preuves du moment `/go` ;
- preparer le worktree Git prive ;
- decouvrir les commandes et capacites du repo.

Ces travaux n'ont pas les memes dependances. Les executer strictement en serie
rendrait le workflow plus lent sans ajouter de securite.

---

## 2. `run-init`

`run-init` est obligatoire et bloquant. Ce n'est pas un stage metier du
workflow ; c'est l'initialisation mecanique du payload `/go` dans le run
Turnlock.

Turnlock a deja cree l'enveloppe runtime avant que `run-init` s'execute :

- `StateFile<WorkflowState>` ;
- `runDir` ;
- lock runtime exclusif ;
- ecriture atomique de `state.json` ;
- logger et horloges runtime.

`run-init` initialise ou reserve ce qui appartient au workflow `/go` :

- `runId` fourni par Turnlock ;
- `RepositoryLaunchContext` fourni par le parent process ;
- `WorkflowPolicy` fourni par le parent process ou la configuration `/go` ;
- hashes canoniques du `RepositoryLaunchContext` et du `WorkflowPolicy` ;
- reference vers l'enveloppe Turnlock ;
- `artefactRoot` ou reference equivalente ;
- chemin de worktree reserve, sans checkout Git ;
- `WorkflowState` initial ;
- startup task records initiaux.

Aucune startup branch ne demarre avant `run-init`, car aucune startup branch ne
doit inventer son propre emplacement d'ecriture ou son propre identifiant.

`run-init` doit etre atomique du point de vue du workflow : soit Turnlock a
persiste un `StateFile<WorkflowState>` dont `state.data.runInit` est complet,
soit aucune startup task ne peut commencer.

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

`run-init` stocke ce contexte dans `WorkflowState`, mais ne le verifie pas
contre Git. Il ne doit pas appeler `git rev-parse`, choisir entre `main` et
`master`, suivre des symlinks, ou corriger un repo cible.

Si `RepositoryLaunchContext` est absent, incomplet ou mal forme, `run-init`
echoue avant que Turnlock ne publie une transition stable vers les startup
tasks.

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

`run-init` valide seulement la forme de cette policy et la stocke dans
`WorkflowState`. Il ne choisit pas les modes de policy et ne les modifie pas.

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

Exemple de forme acceptable :

```text
go-20260712-a3f2b1
```

La forme exacte peut etre un identifiant date plus hash court, un UUID, ou un
autre format stable. Les invariants sont plus importants que le format :

- `runId` est genere une seule fois par Turnlock ;
- `runId` est immuable apres creation ;
- tout artefact durable `/go` reference le meme `runId` ;
- deux runs simultanes ne peuvent pas partager le meme `runId`.

### 2.3 `runDir`

`runDir` est cree par Turnlock avant `run-init`. `/go` le reference comme racine
runtime, mais ne le cree pas et ne le verrouille pas.

Il doit etre hors du repo cible pour que les artefacts, logs et etats internes
ne rendent jamais le repo dirty.

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

`run-init` initialise le payload `/go`, pas l'enveloppe runtime Turnlock et pas
le workspace Git operationnel.

Responsabilites de Turnlock avant `run-init` :

- creer `runDir` ;
- acquerir le lock runtime exclusif ;
- creer ou charger `StateFile<WorkflowState>` ;
- fournir `StateFile.runId` ;
- fournir les horloges runtime ;
- fournir le logger runtime ;
- persister les transitions stables par ecriture atomique de `state.json`.

Responsabilites de `run-init` :

- stocker le `RepositoryLaunchContext` parent ;
- stocker le `WorkflowPolicy` du run ;
- calculer et stocker les hashes canoniques de ces inputs ;
- enregistrer une reference vers le run Turnlock ;
- creer l'unique `artefactRoot` du run ;
- creer `workflowLogRoot` si le workflow a besoin de logs metier separes ;
- reserver `worktreeRoot` comme chemin logique du run ;
- ecrire ou verifier le marqueur d'ownership de `run-init` ;
- initialiser `startupTasks` ;
- retourner un `WorkflowState` complet a Turnlock.

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
├── run-capture/
│   ├── output.json
│   ├── prompt-at-go.txt
│   └── session-excerpt.md
├── workspace-setup/
│   ├── output.json
│   └── evidence/
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
- chaque workflow unit ecrit dans son propre sous-dossier ;
- chaque workflow unit cree seulement son propre sous-dossier ;
- les `output.json` restent sous le sous-dossier de leur unit ;
- les evidence files restent sous un dossier `evidence/` ou sous un fichier
  explicitement reference par l'artefact metier ;
- un sous-dossier d'artefact ne doit pas etre reutilise silencieusement entre
  deux executions distinctes ;
- les references d'evidence doivent etre verifiees avant projection dans
  `WorkflowState`.

Une implementation peut remplacer `artefactRoot` par une reference equivalente,
par exemple un bucket ou un store distant. Dans ce cas, les memes garanties
s'appliquent : isolation du run, evidence hors worktree, hashes verifiables et
reprise deterministe.

### 2.7 Etat initial minimal

`run-init` produit le squelette initial de `WorkflowState`. Turnlock le persiste
ensuite dans `StateFile.data`.

Exemple conceptuel :

```jsonc
{
  "schemaVersion": "<turnlock-state-schema-version>",
  "runId": "go-20260712-a3f2b1",
  "orchestratorName": "go",
  "currentPhase": "run-init",
  "data": {
    "schema": "go.workflow-state.v1",
    "runId": "go-20260712-a3f2b1",
    "runInit": {
      "schema": "go.run-init.v1",
      "runId": "go-20260712-a3f2b1",
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
        "runId": "go-20260712-a3f2b1",
        "runDirRef": "<go-run-root>/runs/go-20260712-a3f2b1",
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
    "currentStage": null,
    "startupTasks": [
      {
        "task": "run-capture",
        "status": "not-started",
        "businessArtifactIds": [],
        "requiredBefore": ["pre-package-review", "pr-ci-review"]
      },
      {
        "task": "repo-discovery-draft",
        "status": "not-started",
        "businessArtifactIds": [],
        "requiredBefore": ["project-discovery-finalize"]
      },
      {
        "task": "workspace-setup",
        "status": "not-started",
        "businessArtifactIds": [],
        "requiredBefore": ["project-discovery-finalize"]
      },
      {
        "task": "project-discovery-finalize",
        "status": "not-started",
        "businessArtifactIds": [],
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

`currentStage` vaut `null`, car le chemin metier principal n'a pas encore
commence. Les travaux de demarrage sont suivis par `startupTasks`, pas par
`currentStage`.

Tout ce qui suit `run-init` est une mutation tracee de ce payload initial.

Le champ `repository` est initialise depuis le `RepositoryLaunchContext`. Il
n'est pas encore une preuve Git autoritative. `workspace-setup` le verifie,
corrige selon `WorkflowPolicy.launchContextMismatch`, ou echoue ferme.

### 2.8 Publication atomique

L'atomicite de `run-init` est portee par Turnlock. Aucune startup task ne peut
demarrer tant que Turnlock n'a pas persiste une transition stable contenant le
`WorkflowState` initialise.

Sequence normative :

```text
Turnlock creates runtime envelope
Turnlock dispatches run-init
run-init validates RepositoryLaunchContext shape
run-init validates WorkflowPolicy shape
run-init hashes canonical launch inputs
run-init creates or reserves /go artefact refs
run-init reserves worktreeRoot path
run-init writes or verifies ownership marker
run-init returns initialized WorkflowState
Turnlock validates state schema
Turnlock atomically writes StateFile<WorkflowState>
Turnlock dispatches startup tasks
```

Regles :

- `state.json` est ecrit atomiquement par Turnlock ;
- `run-init` ne publie pas de marqueur de completion separe ;
- la transition stable Turnlock est l'unique preuve que `run-init` a reussi ;
- une startup task refuse de demarrer si `state.data.runInit` est absent ou
  invalide ;
- les fichiers temporaires ou incomplets de Turnlock ne sont jamais
  autoritatifs pour `/go`.

#### 2.8.1 Idempotence et retry

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
- `RepositoryLaunchContext` fourni par le parent process ;
- `WorkflowPolicy` fourni par le parent process ou la configuration `/go` ;
- refs runtime Turnlock ;
- configuration de stockage du run.

`run-init` doit calculer des hashes canoniques pour les inputs semantiques qu'il
stocke :

```text
launchContextHash = sha256(canonical-json(RepositoryLaunchContext))
workflowPolicyHash = sha256(canonical-json(WorkflowPolicy))
```

Ces hashes sont stockes dans `RunInitRecord` et dans
`RunInitOwnershipMarker`.

Refs creees ou reservees par `run-init` :

- `artefactRootRef` ;
- `workflowLogRootRef`, si present ;
- `worktreeRootReservedPath` ;
- `ownershipMarkerRef`.

Regles de retry :

- si `state.data.runInit` existe deja et que les hashes matchent les inputs de
  resume, `run-init` retourne l'etat deja initialise sans regenerer de refs ;
- si `state.data.runInit` existe deja mais que `launchContextHash` ou
  `workflowPolicyHash` differe, `run-init` echoue ferme ;
- si `artefactRootRef` existe avec un `RunInitOwnershipMarker` valide pour le
  meme `runId`, les memes refs et les memes hashes, `run-init` l'adopte ;
- si `artefactRootRef` existe avec un ownership marker d'un autre `runId`,
  `run-init` echoue ferme ;
- si `artefactRootRef` existe sans ownership marker verifiable, `run-init`
  echoue ferme ou demande une quarantaine explicite au runtime ;
- si `worktreeRootReservedPath` existe deja comme checkout Git physique,
  `run-init` echoue ferme, car seul `workspace-setup` cree le worktree ;
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
- les timestamps ne doivent jamais servir a decider qu'un chemin appartient au
  run.

Le marqueur d'ownership est une preuve d'idempotence, pas une seconde source de
verite. La publication stable reste la transition atomique Turnlock vers
`StateFile<WorkflowState>`.

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
- `StateFile` valide au niveau Turnlock mais payload `/go` absent ou incomplet :
  reprise a `run-init` ou echec ferme selon `currentPhase` ;
- `state.data.runInit` valide : reprise depuis `startupTasks`, `currentStage` et
  artefacts deja projetes.

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
idee avec des prefixes ou namespaces opaques.

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
├─ StateFile<WorkflowState>
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

`run-init` est purement mecanique. Il ne doit pas :

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
- inspecter le repo pour decouvrir ses commandes ;
- creer le worktree prive ;
- modifier le repo cible ;
- lancer des tests, builds, installs ou commandes metier.

Ces responsabilites appartiennent aux startup tasks, aux stages du workflow ou
aux reviews.

---

## 3. Graphe de demarrage

Apres `run-init`, le graphe nominal est :

```text
run-init
├─ run-capture
├─ repo-discovery-draft
└─ workspace-setup
       ↓
project-discovery-finalize
       ↓
implementation
```

`run-capture` et `repo-discovery-draft` sont des startup branches. Elles
peuvent s'executer pendant que `workspace-setup` cree le worktree physique
prive.

`project-discovery-finalize` est le startup join entre `workspace-setup` et
`repo-discovery-draft`. Il produit le `ProjectDiscovery` autoritatif.

`pre-package-review` et `pr-ci-review` sont les points de jonction qui exigent
`RunCaptureArtifact`.

---

## 4. Regle d'autorite

Une startup branch ne modifie pas directement `WorkflowState`.

Elle produit :

- un artefact metier typé ;
- des evidence refs ;
- un `WorkflowExecutionRecord` ;
- un `StageOutput` seulement si elle passe par le stage harness.

Turnlock applique ensuite une transition de projection :

```text
validate artifact schema
validate evidence containment
validate hashes
project into WorkflowState
```

Cette regle evite les courses d'ecriture entre branches de demarrage.

---

## 5. Joins fail-closed

Un startup join est un point ou le chemin principal exige qu'une startup branch
ait produit un resultat valide.

Joins normatifs :

```text
project-discovery-finalize requires:
  - WorkSession
  - RepositoryDiscoveryDraft or permission to rerun discovery from worktree

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

## 6. `run-capture` ne bloque pas l'implementation

`implementation` n'a pas besoin de lire le `RunCaptureArtifact` pour
comprendre la demande. L'agent d'implementation est deja dans la session qui a
declenche `/go` et recoit le contexte du parent.

Le `RunCaptureArtifact` sert aux reviews et a l'audit :

- prouver quel prompt a declenche le run ;
- relire un extrait minimal de session ;
- comparer les hashes ;
- permettre a une review ulterieure de reconstruire l'intention.

---

## 7. `repo-discovery-draft` ne suffit pas

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

## 8. Etat et reprise

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

## 9. Regles de securite

- Aucune startup branch ne peut ecrire dans le worktree d'une autre branche.
- Les artefacts de demarrage s'ecrivent hors worktree.
- Les commandes de discovery ne doivent pas installer d'outils.
- Les commandes de discovery ne doivent pas executer les tests lourds.
- Les joins doivent verifier les chemins et hashes avant projection.
- Les reviews ne peuvent pas se passer de `RunCaptureArtifact`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
