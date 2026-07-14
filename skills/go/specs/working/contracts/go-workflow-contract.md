# Contrat du workflow `/go`

Ce document définit le contrat central du workflow `/go` après séparation entre
**stages**, **phases Turnlock**, **délégations**, et **stage
harness**.

Documents compagnons :

- [`canonical-vocabulary.md`](../standards/canonical-vocabulary.md) - vocabulaire normatif.
- [`canonical-hashing.md`](../standards/canonical-hashing.md) - profil `/go` de RFC 8785 /
  JCS pour les hashes JSON metier.
- [`external-primitives.md`](../standards/external-primitives.md) - standards, formats et
  outils a reutiliser au lieu de primitives maison.
- [`software-design-workflow.md`](../standards/software-design-workflow.md) - récit complet
  du cycle `/go`.
- [`repo-capture.md`](../run-init/repo-capture.md) - contexte parent resolu
  avant `run-init`.
- [`run-init.md`](../run-init/run-init.md) - phase Turnlock de
  bootstrap/onboarding, bootstrap tasks internes et premiere delegation.
- [`multi-agent-concurrency.md`](../standards/multi-agent-concurrency.md) - isolation et
  concurrence multi-run.
- [`workflow-artifacts.md`](../contracts/workflow-artifacts.md) - types JSON
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

`WorkflowState` est la source de vérité de l'avancement apres `run-init`. Les
logs, messages agentiques et commentaires PR sont dérivés.

Turnlock persiste le payload `/go` comme `StateFile<RuntimeState>`, ou
`RuntimeState = BootstrapState | WorkflowState`. Avant `run-init`,
`StateFile.data` contient `BootstrapState`. Apres le snapshot stable emis par
`run-init`, `StateFile.data` contient `WorkflowState`.

### 2.2 Policy-authoritative

Les decisions dites "selon policy" doivent etre lues dans
`WorkflowState.policy`. Une bootstrap task ou un stage ne doit pas inventer une
policy locale pendant son execution.

La policy durable couvre notamment :

- dirty state ;
- correction des hints parent ;
- discovery et rerun depuis le workspace ;
- gates requises ;
- delegation agentique et remediation ;
- review et HumanGates ;
- packaging et publication ;
- retention des runs incomplets.

### 2.3 Primitives externes avant implementations maison

Quand un format, protocole, outil ou standard maintenu existe pour un domaine,
`/go` doit l'utiliser ou l'envelopper au lieu d'en definir une variante maison.
Les primitives specifiques a `/go` sont limitees aux decisions metier du
workflow.

Les choix normatifs sont listes dans
[`external-primitives.md`](../standards/external-primitives.md).

### 2.4 JCS pour les hashes JSON metier

Les payloads JSON metier hashes par `/go` utilisent le profil JCS decrit dans
[`canonical-hashing.md`](../standards/canonical-hashing.md). `/go` ne definit pas une
canonicalisation JSON maison.

Les algorithmes non JSON, comme `trackedWorktreeHash`, hash de patch, hash de
diff ou SHAs Git, restent des algorithmes metier explicites.

### 2.5 WorkflowExecutionRecord-as-execution-envelope

Chaque workflow unit qui produit un artefact durable produit aussi un
`WorkflowExecutionRecord`.

`run-init` est l'exception bootstrap : sa reussite est prouvee par le snapshot
stable Turnlock qui remplace `BootstrapState` par `WorkflowState`, ajoute
`RunInitRecord` et `RunInitOwnershipMarker`, puis emet la delegation
`implementation` avec `resumeAt: "implementation-settlement"`.

Chaque stage standalone produit un `StageOutput` canonique via le stage harness.
Ce `StageOutput` est l'enveloppe d'exécution du stage : statut, evidence refs,
erreurs de stage, champs Git canoniques et chemin de l'`output.json`.

Une bootstrap task peut utiliser le stage harness, ou produire une enveloppe de
startup equivalente. Cela ne la transforme pas en stage metier.

Le payload métier durable d'une bootstrap task ou d'un stage complexe vit dans
des artefacts métier typés, validés par Turnlock avant projection dans
`WorkflowState`.

### 2.6 Workspace physique exclusif

Chaque run `/go` travaille dans un workspace Git physique privé. Une simple
branche dans le checkout courant ne suffit pas pour la cible du workflow.

La stratégie actuelle utilise `git worktree add` ; une stratégie future
pourra utiliser un clone en sandbox. Le contrat commun (workspace isolé,
artefacts hors workspace, baseHeadSha figé) est décrit dans
[workspace-setup.md](../run-init/workspace-setup.md).

Voir [ADR-go-workspace-agnostic-terminology.md](../adr/ADR-go-workspace-agnostic-terminology.md).

### 2.7 Run-init idempotent par `runId`

`run-init` peut etre rejoue par Turnlock pour le meme `runId`. Ce retry doit
produire le meme `WorkflowState` initialise ou echouer ferme.

Le retry ne doit jamais :

- creer un second `runId` ;
- changer `RepoCapture` ;
- changer `WorkflowPolicy` ;
- reutiliser un `artefactRoot` sans ownership marker valide ;
- transformer un `workspaceRootReservedPath` deja materialise en workspace
  autoritatif.

Deux invocations `/go` distinctes produisent deux runs distincts. L'idempotence
de `run-init` ne s'applique pas entre ces runs.

### 2.8 Fail-closed

Absence d'artefact, JSON invalide, schéma invalide, finding bloquant ouvert,
preuve de reconstruction absente, ou état Git ambigu arrêtent le workflow.

### 2.9 JSON-only entre unites de workflow

Tout artefact échangé entre bootstrap tasks, stages et reviews est du JSON
validable ou une evidence ref pointant vers un fichier sous `artefactDir`.

### 2.10 Typed business artifacts

Un résultat métier structuré consommé par un stage suivant doit être porté par
un artefact métier typé. `StageOutput.errors` ne doit pas devenir un canal
générique pour des payloads riches.

Cas normatif : `pre-package-review` et `pr-ci-review` produisent des
`ReviewFinding[]` dans un `ReviewFindingsArtifact`. Le `StageOutput` de review
peut être `passed` même si cet artefact contient des findings `Critical` ou
`Major` bloquants. La transition suivante lit les findings projetés dans
`WorkflowState`, pas un échec d'exécution du stage.

### 2.11 No hidden judgment

Une transition dépend d'un statut, d'un booléen, d'un hash, d'un compteur, d'une
HumanGate, d'un artefact métier typé validé, ou d'un finding structuré. Elle ne
dépend jamais d'une phrase libre.

### 2.12 Toute mutation invalide les gates

Après toute délégation qui modifie le workspace, les checks précédents ne sont
plus autoritaires. Le workflow revient à `change-snapshot`, puis aux gates
requises.

### 2.13 Review globale avant packaging, vérification après packaging

Le workflow review le résultat global final avant de le découper. Le découpage
ne peut toutefois pas être publié sans `package-verify`, car le split peut créer
des états intermédiaires invalides.

### 2.14 Startup branches sans ecriture concurrente d'etat

Le bootstrap lance des bootstrap branches de demarrage a l'interieur de `run-init`,
mais ces branches ne modifient pas directement `WorkflowState`.

Chaque branche produit des artefacts, evidence refs et un
`WorkflowExecutionRecord` sous l'`artefactRoot` du run. `run-init` projette
ensuite les artefacts valides dans le `WorkflowState` qu'il donne a Turnlock au
moment de la delegation `implementation`.

### 2.15 Capture mecanique, analyse semantique tardive

La capture du moment `/go` est mecanique. Elle fige une reference de session et
le hash du prompt.

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

`run-init` n'est pas un stage metier. C'est la premiere phase de l'orchestrateur
Turnlock configure pour `/go` et le startup mecanique du workflow `/go`.

Turnlock execute et persiste cette phase, mais ne l'implemente pas. Le code de
`run-init` appartient au consommateur `/go`. Cette phase n'est pas une primitive
generique de Turnlock et n'est pas obligatoire pour tous les orchestrateurs
Turnlock.

Au début de `run-init`, le contexte est résolu en `RepoCapture` : repo Git cible, sous-projet optionnel, et symlinks. Si ce contexte est absent ou si la résolution cible un répertoire "gateway" non-Git (identifié par la présence de dossiers sentinelles comme `.agents/`, `.codex/`, `.pi/`, `.gravity/` ou de fichiers sentinelles comme `AGENTS.md`, `SKILL.md`, `CODEX.md`, `GRAVITY.md` sans dépôt Git parent), `/go` échoue. Les chemins du répertoire d'invocation et de la racine Git doivent être comparés et résolus via `realpath` pour toute comparaison, vérification de sous-dossier (monorepo) ou assignation finale.

Turnlock cree `StateFile<RuntimeState>` contenant `BootstrapState`, `runDir`,
lock runtime, horloges, logger et ecritures atomiques. `run-init` remplace
`state.data` par `WorkflowState` initialise, execute le bootstrap/onboarding
interne, puis s'arrete sur une delegation agentique :

```text
delegate label: implementation
resumeAt: implementation-settlement
```

`run-init` ne cree pas l'enveloppe runtime Turnlock et ne resout pas le repo
cible. Ces responsabilites appartiennent respectivement a Turnlock et au parent
process. En revanche, les bootstrap tasks `dirty-state-capture`,
`workspace-setup`,
`repo-discovery-draft`, `project-discovery-finalize` et `run-capture` font bien
partie de la phase Turnlock `run-init`.

```text
run-init
│
├─ prerequisite-validation (séquentiel)
│       ↓
├─ repo-capture (sequentiel)
│       ↓
├─ dirty-state-capture (sequentiel, host-side only)
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

Les sous-sections `4.1.x` ne sont pas des stages canoniques et ne sont pas des
phases Turnlock separees. Elles decrivent les bootstrap tasks internes de
`run-init`.

#### 4.1.0 `dirty-state-capture`

Capture l'etat dirty du depot source avant toute creation de workspace.
Cette bootstrap task est host-side uniquement et produit un
`DirtyStateDiffArtifact` projete dans `RunInitRecord.dirtyStateDiff`.

#### 4.1.1 `run-capture`

Fige le prompt `/go`, une reference de session, et le hash du prompt.

Cette bootstrap branch ne modifie pas le repo cible, ne lit pas le workspace, et
ne produit aucune interpretation semantique. Pour v1, elle doit etre jointe
avant la delegation `implementation`.

#### 4.1.2 `workspace-setup`

Prépare le terrain isolé du run. En mode `execute` (nominal), elle crée le workspace Git physique privé, enregistre `WorkSession`, et fixe `baseHeadSha` (les dépôts sans commit / HEAD non né étant initialisés avec un premier commit vide pour établir `baseHeadSha` en toute sécurité). En mode `validate` (retry/resume), elle valide le workspace sans reconstruction (vérifiant uniquement les chemins d'intégrité) en utilisant un contrôle d'ancêtre (`git merge-base --is-ancestor`) au lieu de l'égalité stricte de HEAD, et en filtrant les vérifications porcelain sur les fichiers du patch d'adoption (via `git apply --numstat`).

> **Stratégie actuelle : Git Worktree.** Le pipeline interne utilise
> `git worktree add`. Le contrat commun (workspace isolé, invariants
> agnostiques) est décrit dans
> [workspace-setup.md](../run-init/workspace-setup.md). Une stratégie
> alternative (clone-in-sandbox) peut remplacer le pipeline sans modifier
> le contrat.

Cette bootstrap task est la frontière de départ de toutes les preuves de diff.

#### 4.1.3 `repo-discovery-draft`

Inspecte le dépôt source en lecture seule pour detecter manifestes,
lockfiles, scripts, configs et capacites provider candidates.

Cette bootstrap branch produit un brouillon non autoritatif. Elle peut s'executer
en parallele de `workspace-setup`.

#### 4.1.4 `project-discovery-finalize`

Détecte les commandes et capacités du repo : package manager, lint, typecheck,
tests, build, scans disponibles, conventions Git et provider.

Ce bootstrap join finalise le brouillon de discovery contre le workspace privé, ou
relance la discovery depuis `workspaceRoot` si le brouillon ne peut pas etre
prouve.

Ce join produit le `ProjectDiscovery` autoritatif et la matrice de gates
mecaniques à executer.

### 4.2 `implementation`

`implementation` est le label de delegation qui confie la création ou
modification à l'agent principal, à partir du contexte de session courant, du
workspace prive, des specs disponibles et du `ProjectDiscovery`.

Le stage est sémantique et encadré par Turnlock, mais son coeur est agentique.
Dans le chemin nominal, la delegation est emise par `run-init` et reprise par
`implementation-settlement`.

### 4.3 `implementation-settlement`

Consomme le resultat de la delegation `implementation`, verifie que les
evidences attendues existent, controle que le workspace privé est toujours le
workspace du run, puis route vers le prochain segment mecanique.

Cette phase ne juge pas encore la conformite semantique finale du changement.
Elle reconcilie seulement :

- le resultat JSON de delegation ;
- l'etat reel du workspace ;
- les fichiers modifies ;
- les evidences produites par l'agent ;
- les conditions necessaires pour capturer un snapshot.

Elle peut ensuite transitionner vers `change-snapshot`, ouvrir une HumanGate,
deleguer une remediation immediate autorisee, ou echouer ferme.

### 4.4 `change-snapshot`

Capture le diff courant, le périmètre des fichiers modifiés, `StageOutput`, et
les empreintes d'etat apres une mutation.

Ce stage rend le travail agentique vérifiable par les gates suivantes.

### 4.5 `conduct-settled`

Vérifie les traces de processus après mutation : secrets, fichiers temporaires,
permissions dangereuses, staging area, debug persistants.

### 4.6 `mechanical-gates`

Exécute les checks mécaniques ordonnés pour le repo : format, lint, typecheck,
tests, build, scans, generated drift, API compat si disponibles.

Ce stage peut contenir plusieurs `CheckRun`.

### 4.7 `pre-package-review`

Review hybride du résultat global final avant découpage en paquets.

Ce stage lit `RunCaptureArtifact`, le contexte de session via `sessionRef`, les
specs applicables, le diff final et les gates mecaniques. Il produit un
`ReviewReportArtifact` detaille et un `ReviewFindingsArtifact` contenant des
`ReviewFinding[]` structurés.

Objet reviewé :

- le workspace privé du run ;
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

### 4.8 `review-remediation`

Résout les findings ouverts via HumanGate, dismissal justifié, defer autorisé,
ou délégation de correction.

Toute correction retourne à `change-snapshot`.

### 4.9 `final-change-snapshot`

Capture l'état final validé qui servira d'entrée au packaging.

Le hash de cet état devient la référence contre laquelle le split doit prouver
sa reconstruction.

### 4.10 `package-plan`

Découpe le diff final en paquets logiques de PR, avec dépendances, branches
cibles, et preuve de reconstruction attendue.

### 4.11 `package-verify`

Vérifie que les paquets reconstruisent exactement le diff final et que chaque
branche ou stack intermédiaire est mécaniquement valide selon son scope.

Ce stage est obligatoire parce que la review globale ne prouve pas la
validité des états partiels.

### 4.12 `branch-materialize`

Crée les branches `pr/<runId>/<slug>` depuis leur base déclarée et applique les
paquets vérifiés.

### 4.13 `commit-package`

Crée les commits atomiques pour chaque paquet via le chemin Git de confiance.

Ce stage est le seul stage autorisé à produire des commits.

### 4.14 `publish-pr`

Push les branches PR autorisées et ouvre les PRs avec les artefacts de preuve.

### 4.15 `pr-ci-review`

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

### 4.16 `post-merge-tracking`

Suit les merges, retarget/rebase les PRs dépendantes, enregistre les statuts, et
nettoie les branches quand les preuves nécessaires sont conservées.

---

## 5. Règles de transition

`run-init` est une phase Turnlock mecanique obligatoire, pas un stage metier. Il
stocke le `RepoCapture` fourni par le parent process dans
`WorkflowState`, initialise les refs `/go`, execute le bootstrap/onboarding, puis
emet la delegation `implementation`. L'enveloppe runtime est fournie par
Turnlock. Lors de la reprise après interruption de `run-init`, la bootstrap task `workspace-setup` est ré-exécutée en mode `"validate"`. Toute reconstruction ou restauration ultérieure du workspace après la finalisation de `run-init` (en cours d'implémentation) est une responsabilité de niveau Turnlock ; `workspace-setup` ne doit pas être ré-invoquée dans les phases subséquentes.

Dans `run-init`, le demarrage nominal est :

```text
run-init
│
├─ prerequisite-validation (séquentiel)
│       ↓
├─ repo-capture (sequentiel)
│       ↓
├─ dirty-state-capture (sequentiel, host-side only)
│       │
│       ├─ run-capture (parallele)
│       ├─ workspace-setup (parallele)
│       └─ repo-discovery-draft (parallele)
```

Le bootstrap joint ensuite les branches necessaires avant la premiere delegation
agentique :

```text
project-discovery-finalize
-> join run-capture
-> delegate implementation
-> resumeAt implementation-settlement
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
valide, soit l'autorisation de relancer la discovery depuis `workspaceRoot`.

Pour v1, la delegation `implementation` exige aussi un `RunCaptureArtifact`
valide. `run-capture` peut s'executer en parallele des autres bootstrap tasks, mais
son absence bloque la sortie finale de `run-init`.

`implementation-settlement` exige un resultat de delegation `implementation`
valide et un workspace toujours rattache au run. Elle ne remplace pas
`change-snapshot` : elle decide seulement comment reprendre apres l'agent.

`pre-package-review` exige toujours un `RunCaptureArtifact` valide et projeté.

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

- `StateFile<RuntimeState>` ;
- etats atomiques ;
- persistance de `state.json` ;
- reprise ;
- retry ;
- fallback ;
- loop detection ;
- HumanGate ;
- délégations encadrées.

Le workflow `/go` porte la sémantique :

- quelles bootstrap tasks et quels stages existent ;
- quelles preuves sont exigées ;
- quelles transitions sont valides ;
- quels artefacts sont produits ;
- quand une publication est autorisée.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
