# Vocabulaire canonique du pipeline `/go`

Ce document fixe les mots que les specs `/go` doivent utiliser. Son objectif est
d'éviter de mélanger le récit fonctionnel du pipeline, les phases exécutables
Turnlock, les délégations agentiques, et le contrat de sortie du stage harness.

---

## 1. Principe

Le pipeline `/go` a deux couches distinctes.

La première couche est le **stage**. Il décrit ce que le pipeline fait du point
de vue produit : préparer le workspace, implémenter, vérifier, reviewer,
corriger, publier.

La deuxième couche est la **phase Turnlock**. Elle décrit l'unité atomique,
persistée, reprenable et validable qui exécute une partie mécanique du stage.

Un stage peut contenir plusieurs phases Turnlock. Un stage peut aussi contenir
une délégation agentique, mais cette délégation doit toujours être encadrée par
des phases Turnlock déterministes avant et après.

---

## 2. Termes normatifs

### Stage

Un stage est une étape lisible par un humain dans le workflow `/go`.

Exemples :

- `workspace-setup`
- `implementation`
- `mechanical-gates`
- `pre-package-review`
- `review-remediation`
- `package-and-publish`
- `pr-ci-review`

Un stage répond à la question : **quel travail est accompli dans le
cycle logiciel ?**

Il ne garantit pas à lui seul l'atomicité de reprise. Cette atomicité appartient
aux phases Turnlock internes.

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
les retries, les gates humaines, et la persistance de `PipelineState`.

### Artefact métier typé

Un artefact métier typé est un JSON validé par schéma, référencé depuis une
stage, puis projeté par Turnlock dans `PipelineState`.

Exemples :

- `ReviewFindingsArtifact`
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

- Utiliser **stage** pour parler du workflow humain.
- Utiliser **phase Turnlock** pour parler de reprise, atomicité, retry et
  persistance mécanique.
- Utiliser **délégation** pour tout travail agentique non déterministe.
- Utiliser **stage harness** uniquement pour le contrat `StageInput ->
  StageOutput`.
- Utiliser **artefact métier typé** pour les payloads JSON durables produits par
  un stage et consommés par les stages suivants.
- Ne jamais utiliser `StageOutput.errors` comme canal principal d'un payload
  métier complexe tel que `ReviewFinding[]`.
- Valider les artefacts métier typés avant de les projeter dans
  `PipelineState`.
- Ne jamais dire qu'une délégation est autoritaire tant qu'un état mécanique ne
  l'a pas validée.
- Ne jamais faire porter une décision humaine par un stage de mutation : la
  décision est une HumanGate, la mutation est une délégation ou un check
  séparé.

---

VegaCorp - `/go` Pipeline - "Reliability precedes intelligence."
