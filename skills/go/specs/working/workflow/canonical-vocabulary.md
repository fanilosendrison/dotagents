# Vocabulaire canonique du workflow `/go`

Ce document fixe les mots que les specs `/go` doivent utiliser. Son objectif est
d'éviter de mélanger le récit fonctionnel du workflow, les phases exécutables
Turnlock, les délégations agentiques, et le contrat de sortie du stage harness.

---

## 1. Principe

Le workflow `/go` distingue trois niveaux.

Avant ces niveaux, le parent process produit un **launch context**. Ce n'est
pas une unite Turnlock : c'est l'input resolu qui indique quel repo et quel
sous-perimetre projet le run cible.

Le premier niveau est le **startup**. Il amorce le run : identifiant, lock,
artefacts, capture de session, worktree prive et discovery projet.

Le deuxieme niveau est le **stage**. Il décrit ce que le workflow fait du point
de vue produit : implémenter, vérifier, reviewer, corriger, publier.

Le troisieme niveau est la **phase Turnlock**. Elle décrit l'unité atomique,
persistée, reprenable et validable qui exécute une partie mécanique du stage.

Une startup task ou un stage peut contenir plusieurs phases Turnlock. Un stage
peut aussi contenir une délégation agentique, mais cette délégation doit
toujours être encadrée par des phases Turnlock déterministes avant et après.

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
aux phases Turnlock internes.

Un stage appartient au chemin metier principal. Les travaux de demarrage ne sont
pas des stages.

### Startup

Le startup est l'amorcage mecanique du run `/go`.

Il repond a la question : **quelles preuves et ressources doivent exister avant
que le workflow metier commence ?**

Turnlock cree l'enveloppe runtime :

- `StateFile<WorkflowState>` ;
- `runId` ;
- `runDir` ;
- lock runtime ;
- horloges et logger runtime ;
- ecritures atomiques de `state.json`.

`run-init` initialise dans `WorkflowState` :

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
- startup task records initiaux.

`run-init` est idempotent seulement dans le perimetre d'un meme `runId`
Turnlock. Un retry doit reutiliser les refs deja prouvees par l'ownership
marker, ou echouer ferme.

Le startup n'est pas un stage.

### Startup task

Une startup task est un travail d'amorcage lance apres `run-init`.

Exemples :

- `run-capture`
- `workspace-setup`
- `repo-discovery-draft`
- `project-discovery-finalize`

Une startup task repond a la question :
**quel travail preparatoire peut avancer sans bloquer le worktree prive ?**

Elle doit toujours avoir :

- un espace d'artefacts reserve par `run-init` ;
- un artefact metier typé ou un `StageOutput` validable ;
- aucun acces en ecriture au `WorkflowState` ;
- un point de join explicite ;
- un comportement fail-closed si le join ne peut pas prouver l'artefact.

### Startup branch

Une startup branch est une startup task qui peut avancer en parallele d'autres
startup tasks.

Exemples :

- `run-capture`
- `repo-discovery-draft`
- `workspace-setup`

### Startup join

Un startup join est une startup task qui synchronise des resultats de startup
avant le premier stage metier.

Exemples :

- `project-discovery-finalize` joint `workspace-setup` et
  `repo-discovery-draft` ;

Un startup join ne reinterprete pas librement une sortie manquante. Il valide un
artefact, relance une operation autorisee, ouvre une HumanGate, ou echoue
ferme.

### Phase Turnlock

Une phase Turnlock est une unité mécanique, persistée, reprenable et validable.

Exemples :

- `prepare-input`
- `run-preflight`
- `create-artefact-dir`
- `delegate-agent`
- `wait-human-gate`
- `collect-snapshot`
- `validate-json`
- `persist-state`
- `decide-transition`

Une phase Turnlock répond à la question : **quelle action atomique peut être
reprise sans ambiguïté après interruption ?**

### Délégation

Une délégation est un trou contrôlé dans un stage où un agent non déterministe
travaille.

La délégation n'est jamais autoritaire par elle-même. Elle produit des fichiers,
des artefacts ou une proposition. Les phases Turnlock suivantes collectent,
valident, normalisent et persistent le résultat.

Une délégation doit toujours avoir :

- un input structuré ;
- un périmètre explicite ;
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

Phases Turnlock internes typiques :

```text
validate-implementation-inputs
prepare-implementation-artefacts
delegate-implementation-agent
collect-agent-result
collect-change-snapshot
validate-implementation-output
persist-stage-output
decide-next-stage
```

Le stage est donc bien un stage `/go`, mais son coeur de travail est une
délégation agentique.

---

## 4. Exemple : `review-remediation`

Stage :

```text
review-remediation
```

Phases Turnlock internes typiques :

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
pas confondues. Elles appartiennent à le même stage, mais pas au même
phase Turnlock.

---

## 5. Règles de rédaction des specs

- Utiliser **startup** pour parler de l'amorcage du run avant le premier stage
  metier.
- Utiliser **startup task**, **startup branch** et **startup join** pour les
  travaux de demarrage hors stages.
- Utiliser **stage** pour parler du workflow metier humain.
- Utiliser **phase Turnlock** pour parler de reprise, atomicité, retry et
  persistance mécanique.
- Utiliser **délégation** pour tout travail agentique non déterministe.
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
- Ne jamais faire ecrire une startup branch directement dans `WorkflowState`;
  la projection passe par une transition Turnlock deterministe.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
