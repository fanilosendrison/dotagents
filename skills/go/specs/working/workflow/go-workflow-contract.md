# Contrat du workflow `/go`

Ce document définit le contrat central du workflow `/go` après séparation entre
**stages**, **phases Turnlock**, **délégations**, et **stage
harness**.

Documents compagnons :

- [`canonical-vocabulary.md`](./canonical-vocabulary.md) - vocabulaire normatif.
- [`software-design-workflow.md`](./software-design-workflow.md) - récit complet
  du cycle `/go`.
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

`PipelineState` est la source de vérité de l'avancement. Les logs, messages
agentiques et commentaires PR sont dérivés.

### 2.2 StageOutput-as-execution-envelope

Chaque stage standalone produit un `StageOutput` canonique via le stage harness.
Ce `StageOutput` est l'enveloppe d'exécution du stage : statut, evidence refs,
erreurs de stage, champs Git canoniques et chemin de l'`output.json`.

Le payload métier durable d'un stage complexe vit dans des artefacts métier
typés, validés par Turnlock avant projection dans `PipelineState`.

### 2.3 Workspace physique exclusif

Chaque run `/go` travaille dans un worktree Git physique privé. Une simple
branche dans le checkout courant ne suffit pas pour la cible du workflow.

### 2.4 Fail-closed

Absence d'artefact, JSON invalide, schéma invalide, finding bloquant ouvert,
preuve de reconstruction absente, ou état Git ambigu arrêtent le workflow.

### 2.5 JSON-only entre stages

Tout artefact échangé entre stages est du JSON validable ou une evidence ref
pointant vers un fichier sous `artefactDir`.

### 2.6 Typed business artifacts

Un résultat métier structuré consommé par un stage suivant doit être porté par
un artefact métier typé. `StageOutput.errors` ne doit pas devenir un canal
générique pour des payloads riches.

Cas normatif : `pre-package-review` et `pr-ci-review` produisent des
`ReviewFinding[]` dans un `ReviewFindingsArtifact`. Le `StageOutput` de review
peut être `passed` même si cet artefact contient des findings `Critical` ou
`Major` bloquants. La transition suivante lit les findings projetés dans
`PipelineState`, pas un échec d'exécution du stage.

### 2.7 No hidden judgment

Une transition dépend d'un statut, d'un booléen, d'un hash, d'un compteur, d'une
HumanGate, d'un artefact métier typé validé, ou d'un finding structuré. Elle ne
dépend jamais d'une phrase libre.

### 2.8 Toute mutation invalide les gates

Après toute délégation qui modifie le worktree, les checks précédents ne sont
plus autoritaires. Le workflow revient à `change-snapshot`, puis aux gates
requises.

### 2.9 Review globale avant packaging, vérification après packaging

Le workflow review le résultat global final avant de le découper. Le découpage
ne peut toutefois pas être publié sans `package-verify`, car le split peut créer
des états intermédiaires invalides.

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

## 4. Stages canoniques

### 4.1 `intake`

Fige la demande utilisateur, les specs applicables, les contraintes, les
critères d'acceptation, et le mode d'autorisation.

Ce stage ne modifie pas le repo cible.

### 4.2 `workspace-setup`

Crée le worktree Git physique privé du run, enregistre `WorkSession`, et fixe
`baseHeadSha`.

Ce stage est la frontière de départ de toutes les preuves de diff.

### 4.3 `project-discovery`

Détecte les commandes et capacités du repo : package manager, lint, typecheck,
tests, build, scans disponibles, conventions Git et provider.

Ce stage produit une matrice de gates mécaniques à exécuter.

### 4.4 `implementation`

Délègue le travail de création ou modification à l'agent principal, à partir de
la demande et des specs.

Le stage est sémantique et encadrée par Turnlock, mais son coeur est agentique.

### 4.5 `change-snapshot`

Capture le diff courant, le périmètre des fichiers modifiés, `StageOutput`, et
les hashes canoniques après une mutation.

Ce stage rend le travail agentique vérifiable par les gates suivantes.

### 4.6 `conduct-settled`

Vérifie les traces de processus après mutation : secrets, fichiers temporaires,
permissions dangereuses, staging area, debug persistants.

### 4.7 `mechanical-gates`

Exécute les checks mécaniques ordonnés pour le repo : format, lint, typecheck,
tests, build, scans, generated drift, API compat si disponibles.

Ce stage peut contenir plusieurs `CheckRun`.

### 4.8 `pre-package-review`

Review hybride du résultat global final avant découpage en paquets. Ce stage produit
un `ReviewFindingsArtifact` contenant des `ReviewFinding[]` structurés.

Elle cherche zéro risque bloquant, pas zéro remarque.

### 4.9 `review-remediation`

Résout les findings ouverts via HumanGate, dismissal justifié, defer autorisé,
ou délégation de correction.

Toute correction retourne à `change-snapshot`.

### 4.10 `final-change-snapshot`

Capture l'état final validé qui servira d'entrée au packaging.

Le hash de cet état devient la référence contre laquelle le split doit prouver
sa reconstruction.

### 4.11 `package-plan`

Découpe le diff final en paquets logiques de PR, avec dépendances, branches
cibles, et preuve de reconstruction attendue.

### 4.12 `package-verify`

Vérifie que les paquets reconstruisent exactement le diff final et que chaque
branche ou stack intermédiaire est mécaniquement valide selon son scope.

Ce stage est obligatoire parce que la review globale ne prouve pas la
validité des états partiels.

### 4.13 `branch-materialize`

Crée les branches `pr/<run-id>/<slug>` depuis leur base déclarée et applique les
paquets vérifiés.

### 4.14 `commit-package`

Crée les commits atomiques pour chaque paquet via le chemin Git de confiance.

Ce stage est la seule stage autorisée à produire des commits.

### 4.15 `publish-pr`

Push les branches PR autorisées et ouvre les PRs avec les artefacts de preuve.

### 4.16 `pr-ci-review`

Rejoue les gates mécaniques et la review structurée sur le diff réellement
poussé. C'est la gate autoritative avant merge.

### 4.17 `post-merge-tracking`

Suit les merges, retarget/rebase les PRs dépendantes, enregistre les statuts, et
nettoie les branches quand les preuves nécessaires sont conservées.

---

## 5. Règles de transition

Le chemin nominal est :

```text
intake
-> workspace-setup
-> project-discovery
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

`review-remediation` peut retourner à `change-snapshot`.

`mechanical-gates` peut déléguer des corrections, mais toute correction retourne
à `change-snapshot`.

`package-verify` peut retourner à `package-plan` si le découpage est invalide.

`pr-ci-review` peut retourner à une remediation de PR ou ouvrir une HumanGate.

---

## 6. Règles de terminaison locale

Le workflow peut passer à `package-plan` seulement si :

- `conduct-settled` est `passed` ;
- toutes les gates mécaniques requises sont `passed` ;
- aucun finding `Critical` n'est `open` ;
- aucun finding `Major` avec `blocksPipeline: true` n'est `open` ;
- toutes les HumanGates requises ont une décision et une justification ;
- le dernier `trackedWorktreeHash` correspond à l'état final reviewé ;
- `worktreeClean` est compatible avec la policy de packaging.

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

- états atomiques ;
- persistance de `PipelineState`;
- reprise ;
- retry ;
- fallback ;
- loop detection ;
- HumanGate ;
- délégations encadrées.

Le workflow `/go` porte la sémantique :

- quelles stages existent ;
- quelles preuves sont exigées ;
- quelles transitions sont valides ;
- quels artefacts sont produits ;
- quand une publication est autorisée.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
