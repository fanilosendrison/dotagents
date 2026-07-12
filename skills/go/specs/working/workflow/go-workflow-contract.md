# Contrat du workflow `/go`

Ce document définit le contrat central du workflow `/go` après séparation entre
**stages**, **phases Turnlock**, **délégations**, et **stage
harness**.

Documents compagnons :

- [`canonical-vocabulary.md`](./canonical-vocabulary.md) - vocabulaire normatif.
- [`software-design-workflow.md`](./software-design-workflow.md) - récit complet
  du cycle `/go`.
- [`launch-context.md`](../startup/launch-context.md) - contexte parent resolu
  avant `run-init`.
- [`run-init.md`](../startup/run-init.md) - startup du run, startup branches
  et joins fail-closed.
- [`multi-agent-concurrency.md`](./multi-agent-concurrency.md) - isolation et
  concurrence multi-run.
- [`workflow-artifacts.md`](../artifacts/workflow-artifacts.md) - types JSON
  partagés.
- [`stage-harness/`](../../briefs/stage-harness/) - contrat d'exécution d'une
  stage standalone.

---

## 1. Objectif

`/go` transforme une demande utilisateur en un ensemble de PRs publiables, en
préservant quatre propriétés :

- base Git figée ;
- travail agentique isolé ;
- gates mécaniques reproductibles ;
- publication en paquets vérifiés.

Le workflow doit échouer fermé dès qu'il ne peut plus prouver l'état courant.

---

## 2. Invariants globaux

### 2.1 State-authoritative

`WorkflowState` est la source de vérité de l'avancement. Les logs, messages
agentiques et commentaires PR sont dérivés.

Turnlock persiste cet etat comme `StateFile<WorkflowState>`. Turnlock fournit
l'enveloppe durable ; `/go` fournit le payload metier stocke dans
`StateFile.data`.

### 2.2 Policy-authoritative

Les decisions dites "selon policy" doivent etre lues dans
`WorkflowState.policy`. Une startup task ou un stage ne doit pas inventer une
policy locale pendant son execution.

La policy durable couvre notamment :

- dirty state ;
- correction des hints parent ;
- discovery et rerun depuis le worktree ;
- gates requises ;
- delegation agentique et remediation ;
- review et HumanGates ;
- packaging et publication ;
- retention des runs incomplets.

### 2.3 WorkflowExecutionRecord-as-execution-envelope

Chaque workflow unit qui produit un artefact durable produit aussi un
`WorkflowExecutionRecord`.

Chaque stage standalone produit un `StageOutput` canonique via le stage harness.
Ce `StageOutput` est l'enveloppe d'exécution du stage : statut, evidence refs,
erreurs de stage, champs Git canoniques et chemin de l'`output.json`.

Une startup task peut utiliser le stage harness, ou produire une enveloppe de
startup equivalente. Cela ne la transforme pas en stage metier.

Le payload métier durable d'une startup task ou d'un stage complexe vit dans
des artefacts métier typés, validés par Turnlock avant projection dans
`WorkflowState`.

### 2.4 Workspace physique exclusif

Chaque run `/go` travaille dans un worktree Git physique privé. Une simple
branche dans le checkout courant ne suffit pas pour la cible du workflow.

### 2.5 Fail-closed

Absence d'artefact, JSON invalide, schéma invalide, finding bloquant ouvert,
preuve de reconstruction absente, ou état Git ambigu arrêtent le workflow.

### 2.6 JSON-only entre unites de workflow

Tout artefact échangé entre startup tasks, stages et reviews est du JSON
validable ou une evidence ref pointant vers un fichier sous `artefactDir`.

### 2.7 Typed business artifacts

Un résultat métier structuré consommé par un stage suivant doit être porté par
un artefact métier typé. `StageOutput.errors` ne doit pas devenir un canal
générique pour des payloads riches.

Cas normatif : `pre-package-review` et `pr-ci-review` produisent des
`ReviewFinding[]` dans un `ReviewFindingsArtifact`. Le `StageOutput` de review
peut être `passed` même si cet artefact contient des findings `Critical` ou
`Major` bloquants. La transition suivante lit les findings projetés dans
`WorkflowState`, pas un échec d'exécution du stage.

### 2.8 No hidden judgment

Une transition dépend d'un statut, d'un booléen, d'un hash, d'un compteur, d'une
HumanGate, d'un artefact métier typé validé, ou d'un finding structuré. Elle ne
dépend jamais d'une phrase libre.

### 2.9 Toute mutation invalide les gates

Après toute délégation qui modifie le worktree, les checks précédents ne sont
plus autoritaires. Le workflow revient à `change-snapshot`, puis aux gates
requises.

### 2.10 Review globale avant packaging, vérification après packaging

Le workflow review le résultat global final avant de le découper. Le découpage
ne peut toutefois pas être publié sans `package-verify`, car le split peut créer
des états intermédiaires invalides.

### 2.11 Startup branches sans ecriture concurrente d'etat

Le startup peut lancer des startup branches de demarrage, mais ces branches
ne modifient pas directement `WorkflowState`.

Chaque branche produit des artefacts, evidence refs et un
`WorkflowExecutionRecord` sous l'`artefactRoot` du run. Turnlock projette
ensuite les artefacts valides dans `WorkflowState` via une transition
deterministe.

### 2.12 Capture mecanique, analyse semantique tardive

La capture du moment `/go` est mecanique. Elle fige des references, extraits et
hashes.

L'analyse de l'intention utilisateur appartient aux stages de review, quand le
diff reel, les gates, les specs et les snapshots sont disponibles.

---

## 3. Sévérités canoniques

Les findings utilisent exactement :

- `Critical`
- `Major`
- `Minor`
- `Notable`

Les erreurs de stage utilisent les sévérités du stage harness :

- `blocking`
- `major`
- `minor`

Mapping :

- `blocking` -> `Critical`
- `major` -> `Major`
- `minor` -> `Minor`

`Notable` n'est pas une sévérité de `StageError`. Un finding notable conservé
comme preuve de stage doit être encodé comme finding, ou comme `minor` avec
contexte explicite.

---

## 4. Startup et stages canoniques

### 4.1 `run-init`

`run-init` n'est pas un stage metier. C'est le startup mecanique du run.

Avant `run-init`, le parent process resout un `RepositoryLaunchContext` :
repo Git cible, chemins actifs, sous-projet optionnel, symlinks et hints de
provider ou branche cible. Si ce contexte est absent ou ambigu, `/go` echoue
avant Turnlock.

Turnlock cree `StateFile<WorkflowState>`, `runDir`, lock runtime, horloges,
logger et ecritures atomiques. `run-init` initialise `state.data` :
`WorkflowState.runInit`, `artefactRoot`, chemin de worktree reserve et
`startupTasks` initiales.

Il ne decouvre pas le repo, ne cree pas l'enveloppe runtime Turnlock, et ne
cree pas le checkout Git physique. Ces responsabilites appartiennent
respectivement au parent process, a Turnlock et a `workspace-setup`.

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

Les sous-sections `4.1.x` ne sont pas des stages canoniques. Elles decrivent le
startup du run.

#### 4.1.1 `run-capture`

Fige le prompt `/go`, une reference de session, un extrait minimal de session
et leurs hashes.

Cette startup branch ne modifie pas le repo cible, ne lit pas le worktree, et
ne produit aucune interpretation semantique.

#### 4.1.2 `workspace-setup`

Crée le worktree Git physique privé du run, enregistre `WorkSession`, et fixe
`baseHeadSha`.

Cette startup task est la frontière de départ de toutes les preuves de diff.

#### 4.1.3 `repo-discovery-draft`

Inspecte le checkout source en lecture seule pour detecter manifestes,
lockfiles, scripts, configs et capacites provider candidates.

Cette startup branch produit un brouillon non autoritatif. Elle peut s'executer
en parallele de `workspace-setup`.

#### 4.1.4 `project-discovery-finalize`

Détecte les commandes et capacités du repo : package manager, lint, typecheck,
tests, build, scans disponibles, conventions Git et provider.

Ce startup join finalise le brouillon de discovery contre le worktree prive, ou
relance la discovery depuis `worktreeRoot` si le brouillon ne peut pas etre
prouve.

Ce join produit le `ProjectDiscovery` autoritatif et la matrice de gates
mecaniques à executer.

### 4.2 `implementation`

Délègue le travail de création ou modification à l'agent principal, à partir du
contexte de session courant, du worktree prive, des specs disponibles et du
`ProjectDiscovery`.

Le stage est sémantique et encadré par Turnlock, mais son coeur est agentique.

### 4.3 `change-snapshot`

Capture le diff courant, le périmètre des fichiers modifiés, `StageOutput`, et
les hashes canoniques après une mutation.

Ce stage rend le travail agentique vérifiable par les gates suivantes.

### 4.4 `conduct-settled`

Vérifie les traces de processus après mutation : secrets, fichiers temporaires,
permissions dangereuses, staging area, debug persistants.

### 4.5 `mechanical-gates`

Exécute les checks mécaniques ordonnés pour le repo : format, lint, typecheck,
tests, build, scans, generated drift, API compat si disponibles.

Ce stage peut contenir plusieurs `CheckRun`.

### 4.6 `pre-package-review`

Review hybride du résultat global final avant découpage en paquets.

Ce stage lit `RunCaptureArtifact`, l'extrait de session gele, les specs
applicables, le diff final et les gates mecaniques. Il produit un
`ReviewReportArtifact` detaille et un `ReviewFindingsArtifact` contenant des
`ReviewFinding[]` structurés.

Objet reviewé :

- le worktree prive du run ;
- le dernier `ChangeSnapshot` global ;
- le diff complet entre `baseHeadSha` et l'etat final local ;
- les gates mecaniques locales executees sur ce snapshot.

Question autoritative :

```text
Le changement complet, avant decoupage Git, implemente-t-il l'intention
utilisateur et respecte-t-il les specs ?
```

Ce stage ne prouve pas que les futures PRs publiees seront valides. Il ne voit
pas encore les branches PR finales, la CI provider, le drift de base distante,
les conflits de merge, ni les effets du split en paquets.

Elle cherche zéro risque bloquant, pas zéro remarque.

### 4.7 `review-remediation`

Résout les findings ouverts via HumanGate, dismissal justifié, defer autorisé,
ou délégation de correction.

Toute correction retourne à `change-snapshot`.

### 4.8 `final-change-snapshot`

Capture l'état final validé qui servira d'entrée au packaging.

Le hash de cet état devient la référence contre laquelle le split doit prouver
sa reconstruction.

### 4.9 `package-plan`

Découpe le diff final en paquets logiques de PR, avec dépendances, branches
cibles, et preuve de reconstruction attendue.

### 4.10 `package-verify`

Vérifie que les paquets reconstruisent exactement le diff final et que chaque
branche ou stack intermédiaire est mécaniquement valide selon son scope.

Ce stage est obligatoire parce que la review globale ne prouve pas la
validité des états partiels.

### 4.11 `branch-materialize`

Crée les branches `pr/<run-id>/<slug>` depuis leur base déclarée et applique les
paquets vérifiés.

### 4.12 `commit-package`

Crée les commits atomiques pour chaque paquet via le chemin Git de confiance.

Ce stage est le seul stage autorisé à produire des commits.

### 4.13 `publish-pr`

Push les branches PR autorisées et ouvre les PRs avec les artefacts de preuve.

### 4.14 `pr-ci-review`

Rejoue les gates mécaniques et la review structurée sur le diff réellement
poussé. Ce stage consomme aussi `RunCaptureArtifact` pour verifier que le diff
publie reste conforme a l'intention gelee. C'est la gate autoritative avant
merge.

Objet reviewé :

- la PR publiee chez le provider ;
- la branche head distante ;
- la branche base distante ;
- le diff provider reel ;
- les resultats CI et checks provider ;
- les paquets materialises, commits et metadata de publication.

Question autoritative :

```text
Ce qui est reellement sur le point d'etre merge correspond-il encore au
changement valide, dans une PR saine et mergeable ?
```

Ce stage ne remplace pas `pre-package-review`. Il protege contre les risques
introduits apres la review globale : split invalide, commit manquant, push
incorrect, drift de base, CI distante differente, conflit de merge ou diff PR
qui ne correspond plus aux artefacts locaux.

### 4.15 `post-merge-tracking`

Suit les merges, retarget/rebase les PRs dépendantes, enregistre les statuts, et
nettoie les branches quand les preuves nécessaires sont conservées.

---

## 5. Règles de transition

`run-init` est une initialisation mecanique obligatoire, pas un stage metier. Il
stocke le `RepositoryLaunchContext` fourni par le parent process dans
`WorkflowState`, puis initialise les refs `/go` : `artefactRoot`, chemin de
worktree reserve et startup task records. L'enveloppe runtime est fournie par
Turnlock.

Apres `run-init`, le demarrage nominal est parallele :

```text
run-init
├─ run-capture
├─ repo-discovery-draft
└─ workspace-setup
```

Le startup joint ensuite les branches necessaires avant le premier stage
metier :

```text
project-discovery-finalize
-> implementation
-> change-snapshot
-> conduct-settled
-> mechanical-gates
-> pre-package-review
-> review-remediation
-> final-change-snapshot
-> package-plan
-> package-verify
-> branch-materialize
-> commit-package
-> publish-pr
-> pr-ci-review
-> post-merge-tracking
```

`project-discovery-finalize` exige `WorkSession` et soit un `RepositoryDiscoveryDraft`
valide, soit l'autorisation de relancer la discovery depuis `worktreeRoot`.

`pre-package-review` exige un `RunCaptureArtifact` valide. `run-capture` peut
donc s'executer en parallele des autres startup tasks, mais son absence bloque
la review.

`review-remediation` peut retourner à `change-snapshot`.

`mechanical-gates` peut déléguer des corrections, mais toute correction retourne
à `change-snapshot`.

`package-verify` peut retourner à `package-plan` si le découpage est invalide.

`pr-ci-review` peut retourner à une remediation de PR ou ouvrir une HumanGate.

---

## 6. Règles de terminaison locale

Le workflow peut passer à `package-plan` seulement si :

- `RunCaptureArtifact` est valide et ses hashes correspondent aux evidences ;
- `conduct-settled` est `passed` ;
- toutes les gates mécaniques requises sont `passed` ;
- aucun finding `Critical` n'est `open` ;
- aucun finding `Major` avec `blocksWorkflow: true` n'est `open` ;
- toutes les HumanGates requises ont une décision et une justification ;
- le dernier `trackedWorktreeHash` correspond à l'état final reviewé ;
- `worktreeClean` est compatible avec `WorkflowPolicy.packaging`.

Le workflow peut passer à `publish-pr` seulement si :

- `package-plan` est validé ;
- `package-verify` a prouvé la reconstruction ;
- les branches matérialisées correspondent aux paquets ;
- les commits ont été créés via le chemin de confiance ;
- aucun paquet ne possède une dépendance implicite non déclarée.

---

## 7. Règles de preuve

Un finding bloquant doit contenir au moins une preuve :

- sortie d'outil déterministe ;
- reproduction minimale ;
- citation d'une spec, NIB ou contrat public ;
- comparaison avant/après ;
- chemin de données ou de contrôle démontré ;
- invariant durable violé.

Un finding sans preuve peut être `Minor` ou `Notable`, mais ne peut pas être
`Critical`.

---

## 8. Relation à Turnlock

Turnlock porte la mécanique :

- `StateFile<WorkflowState>` ;
- etats atomiques ;
- persistance de `state.json` ;
- reprise ;
- retry ;
- fallback ;
- loop detection ;
- HumanGate ;
- délégations encadrées.

Le workflow `/go` porte la sémantique :

- quelles startup tasks et quels stages existent ;
- quelles preuves sont exigées ;
- quelles transitions sont valides ;
- quels artefacts sont produits ;
- quand une publication est autorisée.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
