# Vocabulaire canonique du workflow `/go`

Ce document fixe les mots que les specs `/go` doivent utiliser. Son objectif est
d'éviter de mélanger le récit fonctionnel du workflow, les phases exécutables
Turnlock, les délégations agentiques, et le contrat de sortie du stage harness.

---

## 1. Principe

Le workflow `/go` distingue quatre niveaux.

Avant ces niveaux, le parent process produit un **launch context**. Ce n'est
pas une unite Turnlock : c'est l'input resolu qui indique quel repo et quel
sous-perimetre projet le run cible.

Le premier niveau est la **phase Turnlock**. Elle décrit l'unité runtime
persistée, reprenable et bornée par un `transition`, une `delegation`, un
`done` ou un `fail`.

Le deuxieme niveau est le **startup**. Il amorce le run : identifiant, lock,
artefacts, capture de session, worktree prive et discovery projet. Dans `/go`,
le startup est realise a l'interieur de la phase Turnlock `run-init`.

Le troisieme niveau est le **stage**. Il décrit ce que le workflow fait du point
de vue produit : implémenter, vérifier, reviewer, corriger, publier.

Le quatrieme niveau est la **délégation**. Elle décrit le travail externe,
agentique ou LLM, que Turnlock ne rend pas déterministe mais qu'il encadre par
des snapshots stables avant et apres.

Une phase Turnlock peut executer plusieurs startup tasks ou plusieurs operations
mecaniques avant de s'arreter sur une delegation. Une startup task n'est pas une
phase Turnlock separee. Un stage peut etre realise par une delegation, mais
cette delegation doit toujours avoir une phase Turnlock de reprise qui collecte,
valide et projette le resultat.

---

## 2. Termes normatifs

### Launch context

Le launch context est produit par le parent process avant `run-init`.

Il repond a la question : **quel repo Git et quel sous-perimetre projet ce run
`/go` cible-t-il ?**

Il contient notamment :

- repertoire d'invocation ;
- chemins actifs ;
- racine Git canonique cible ;
- sous-projet optionnel ;
- hints provider et branche cible ;
- information de resolution des symlinks.

Le launch context n'est pas une startup task, pas un stage et pas une phase
Turnlock. `run-init` le stocke. `workspace-setup` le verifie.

### Stage

Un stage est une étape lisible par un humain dans le workflow `/go`.

Exemples :

- `implementation`
- `mechanical-gates`
- `pre-package-review`
- `review-remediation`
- `package-plan`
- `publish-pr`
- `pr-ci-review`

Un stage répond à la question : **quel travail est accompli dans le
cycle logiciel ?**

Il ne garantit pas à lui seul l'atomicité de reprise. Cette atomicité appartient
aux phases Turnlock qui le dispatchent, le reprennent ou projettent ses
résultats.

Un stage appartient au chemin metier principal. Les travaux de demarrage ne sont
pas des stages.

### Startup

Le startup est l'amorcage mecanique du run `/go`.

Il repond a la question : **quelles preuves et ressources doivent exister avant
que le workflow metier commence ?**

Turnlock cree l'enveloppe runtime :

- `StateFile<GoRuntimeState>` ;
- `GoBootstrapState` initial ;
- `runId` ;
- `runDir` ;
- lock runtime ;
- horloges et logger runtime ;
- ecritures atomiques de `state.json`.

`run-init` lit `GoBootstrapState`, publie `WorkflowState`, execute le
bootstrap/onboarding, puis s'arrete sur la delegation `implementation` :

- `runId` ;
- `RepositoryLaunchContext` ;
- `WorkflowPolicy` ;
- hashes JCS des inputs JSON de lancement ;
- reference vers le run Turnlock ;
- `artefactRoot` ;
- marqueur d'ownership de `run-init` ;
- chemin de worktree reserve, sans checkout Git ;
- etat initial minimal ;
- schema/version de l'etat ;
- startup task records ;
- `WorkSession` ;
- `ProjectDiscovery` ;
- delegation `implementation` avec `resumeAt: "implementation-settlement"`.

`run-init` est idempotent seulement dans le perimetre d'un meme `runId`
Turnlock. Un retry doit reutiliser les refs deja prouvees par l'ownership
marker, ou echouer ferme.

`run-init` est la premiere phase de l'orchestrateur Turnlock configure pour
`/go`, mais elle est implementee par le consommateur `/go`. Elle n'est pas une
primitive generique fournie par Turnlock et elle n'est pas obligatoire pour tous
les orchestrateurs Turnlock.

Le startup n'est pas un stage. Les travaux `run-capture`, `workspace-setup`,
`repo-discovery-draft` et `project-discovery-finalize` sont des sous-taches de
la phase Turnlock `run-init`, pas des phases Turnlock separees.

### Startup task

Une startup task est un travail d'amorcage execute a l'interieur de `run-init`.

Exemples :

- `run-capture`
- `workspace-setup`
- `repo-discovery-draft`
- `project-discovery-finalize`

Une startup task repond a la question :
**quel travail preparatoire peut avancer sans bloquer inutilement le reste du
bootstrap ?**

Elle doit toujours avoir :

- un espace d'artefacts reserve par `run-init` ;
- un checkpoint terminal `task-record.json` ecrit atomiquement ;
- un artefact metier typé ou un `StageOutput` validable ;
- aucune ecriture concurrente directe dans `WorkflowState` ;
- un point de join explicite ;
- un comportement fail-closed si le join ne peut pas prouver l'artefact.

`run-init` peut projeter les resultats valides de ces tasks dans le
`WorkflowState` qu'il passe a Turnlock au moment de la delegation. Une startup
task ne publie jamais seule une transition Turnlock.

### Startup branch

Une startup branch est une startup task qui peut avancer en parallele d'autres
startup tasks a l'interieur de `run-init`.

Exemples :

- `run-capture`
- `repo-discovery-draft`
- `workspace-setup`

### Startup join

Un startup join est une startup task qui synchronise des resultats de startup
avant la delegation `implementation`.

Exemples :

- `project-discovery-finalize` joint `workspace-setup` et
  `repo-discovery-draft` ;

Un startup join ne reinterprete pas librement une sortie manquante. Il valide un
artefact, relance une operation autorisee, ouvre une HumanGate, ou echoue
ferme.

### Phase Turnlock

Une phase Turnlock est une unité mécanique, persistée, reprenable et validable.
Elle peut executer plusieurs operations deterministes avant de retourner un
`PhaseResult`.

Exemples :

- `run-init`
- `implementation-settlement`
- `pre-package-review-dispatch`
- `pre-package-review-settlement`
- `package-and-publish`

Une phase Turnlock répond à la question : **quel segment mécanique peut avancer
jusqu'au prochain point stable sans ambiguïté après interruption ?**

Une phase Turnlock s'arrete en appelant exactement un resultat Turnlock :
`io.transition`, `io.delegate`, `io.delegateBatch`, `io.done` ou `io.fail`.

### Délégation

Une délégation est un trou contrôlé où un agent, un skill ou un appel LLM non
déterministe travaille hors du process Turnlock.

La délégation n'est jamais autoritaire par elle-même. Elle produit des fichiers,
des artefacts ou une proposition. Les phases Turnlock suivantes collectent,
valident, normalisent et persistent le résultat.

Une délégation doit toujours avoir :

- un input structuré ;
- un périmètre explicite ;
- un `label` stable, par exemple `implementation` ;
- une phase de reprise `resumeAt`, par exemple `implementation-settlement` ;
- un artefact de sortie attendu ;
- une validation déterministe après retour ;
- un snapshot de repo si elle peut modifier le worktree.

### Stage harness

Le stage harness est le contrat d'exécution d'un stage standalone :

```ts
runStage(stageFn, input) -> StageOutput
```

Il ne remplace pas Turnlock. Il fournit l'enveloppe d'exécution canonique d'un
stage :
`artefactDir/output.json`, evidence refs, erreurs, `headShaAfter`,
`trackedWorktreeHash`, et `worktreeClean`.

Turnlock enveloppe des stages conformes à ce contrat pour obtenir la reprise,
les retries, les gates humaines, et la persistance de `WorkflowState`.

### Artefact métier typé

Un artefact métier typé est un JSON validé par schéma, référencé depuis une
stage, puis projeté par Turnlock dans `WorkflowState`.

Exemples :

- `RunCaptureArtifact`
- `RepositoryDiscoveryDraft`
- `ReviewFindingsArtifact`
- `ReviewReportArtifact`
- `PackagePlan`
- `PackageVerification`
- `ChangeSnapshot`
- `WorkSession`
- `ProjectDiscovery`

Un artefact métier typé répond à la question : **quel résultat métier durable la
stage a-t-il produit ?**

Il ne remplace pas `StageOutput`. `StageOutput` dit si le stage s'est exécuté
correctement et où sont ses preuves. L'artefact métier typé porte le payload
structuré que les stages suivants consomment.

### Check mécanique

Un check mécanique est une opération déterministe dont la décision dépend d'un
résultat mesurable : lint, typecheck, tests, build, scan secret, validation de
schéma, preuve de reconstruction.

Un check mécanique ne délègue pas à un agent pour décider de son résultat. Il
peut déléguer une correction après échec, mais la revalidation reste mécanique.

### Finding

Un finding est un résultat structuré de review ou de check sémantique.

Un finding bloquant doit fournir une preuve : sortie d'outil, reproduction,
citation de spec, comparaison avant/après, ou invariant durable violé.

Un `ReviewFinding` n'est pas un `StageError`. Il possède un cycle de vie
(`open`, `fixed`, `dismissed`, `deferred`) et vit dans un artefact métier typé.
`StageError` reste réservé aux diagnostics d'exécution du stage.

### HumanGate

Une HumanGate est une phase Turnlock de décision, pas un stage de mutation.

Elle attend une décision explicite ou une policy autorisée. Si la décision est
`apply`, un stage séparé applique les changements approuvés.

---

## 3. Exemple : `implementation`

Stage :

```text
implementation
```

Dans le demarrage nominal, `implementation` est le label de delegation emis par
la phase Turnlock `run-init`, pas le nom de la phase Turnlock suivante.

Phase Turnlock qui emet la delegation :

```text
run-init
  validates bootstrap/onboarding
  prepares implementation delegation input
  delegates label: implementation
  resumeAt: implementation-settlement
```

Phase Turnlock de reprise :

```text
implementation-settlement
  consumes pending delegation result
  validates implementation evidence
  captures or routes to ChangeSnapshot
  decides next mechanical segment
```

Le stage est donc bien un stage metier `/go`, mais son coeur de travail est une
délégation agentique. Le nom du stage et le nom de la phase Turnlock ne doivent
pas etre confondus.

---

## 4. Exemple : `review-remediation`

Stage :

```text
review-remediation
```

Segments Turnlock typiques :

```text
classify-open-findings
open-human-gate-if-needed
wait-human-decision
delegate-remediation-agent-if-approved
collect-remediation-snapshot
persist-remediation-attempt
decide-return-to-gates
```

La décision humaine, la délégation agentique, et la mutation du worktree ne sont
pas confondues. Elles appartiennent au meme stage logique, mais pas
necessairement a la meme phase Turnlock.

---

## 5. Règles de rédaction des specs

- Utiliser **startup** pour parler de l'amorcage du run porte par la phase
  Turnlock `run-init`.
- Utiliser **startup task**, **startup branch** et **startup join** pour les
  sous-operations de demarrage internes a `run-init`.
- Utiliser **stage** pour parler du workflow metier humain.
- Utiliser **phase Turnlock** pour parler de reprise, atomicité, retry et
  persistance mécanique.
- Utiliser **délégation** pour tout travail agentique non déterministe.
- Utiliser **label de delegation** pour nommer le travail externe, par exemple
  `implementation`.
- Utiliser **resumeAt** pour nommer la phase Turnlock qui reprendra apres le
  travail externe, par exemple `implementation-settlement`.
- Utiliser **stage harness** uniquement pour le contrat `StageInput ->
  StageOutput`.
- Utiliser **artefact métier typé** pour les payloads JSON durables produits par
  une startup task ou un stage et consommés par les unites suivantes.
- Ne jamais utiliser `StageOutput.errors` comme canal principal d'un payload
  métier complexe tel que `ReviewFinding[]`.
- Valider les artefacts métier typés avant de les projeter dans
  `WorkflowState`.
- Ne jamais dire qu'une délégation est autoritaire tant qu'un état mécanique ne
  l'a pas validée.
- Ne jamais faire porter une décision humaine par un stage de mutation : la
  décision est une HumanGate, la mutation est une délégation ou un check
  séparé.
- Ne jamais confondre capture mecanique et analyse semantique : `run-capture`
  fige des preuves, la review interprete l'intention.
- Ne jamais appeler `run-capture`, `workspace-setup`,
  `repo-discovery-draft` ou `project-discovery-finalize` des stages.
- Ne jamais appeler `run-capture`, `workspace-setup`,
  `repo-discovery-draft` ou `project-discovery-finalize` des phases Turnlock
  separees du workflow `/go`; ce sont des startup tasks internes a `run-init`.
- Ne jamais faire ecrire une startup branch directement dans `WorkflowState`;
  la projection passe par le snapshot stable que `run-init` remet a Turnlock.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
