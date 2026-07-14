# Review idéale dans `/go`

La review `/go` ne cherche pas une absence totale de remarques. Elle cherche
l'absence de risque bloquant prouvé.

---

## 1. Objectif

Produire deux artefacts complementaires :

- un `ReviewReportArtifact` detaille pour l'audit humain ;
- un `ReviewFindingsArtifact` contenant des `ReviewFinding[]` structurés.

Les findings permettent une transition mécanique :

- corriger ;
- dismiss avec justification ;
- defer si autorisé ;
- abort.

Le rapport peut contenir une narration riche. Les transitions du workflow ne
lisent que les findings structures, les statuts, les hashes et les preuves.

`ReviewFinding` est une decision metier du workflow. Il ne remplace pas les
formats standards de diagnostics code-level. Quand un outil fournit SARIF ou un
format equivalent, la sortie standard doit etre conservee comme evidence et
seulement projetee en finding apres validation. Voir
[`external-primitives.md`](../standards/external-primitives.md).

---

## 2. Dimensions

La review couvre les dimensions suivantes :

- correctness ;
- intent-conformance ;
- robustness ;
- security ;
- spec-conformance ;
- scope-control ;
- backward-compatibility ;
- build-ci-reproducibility ;
- tests-substance ;
- tests-coverage ;
- interface ;
- observability ;
- structure ;
- simplicity ;
- compliance-supply-chain ;
- ai-artifact-detection ;
- agent-conduct ;
- packaging.

`intent-conformance` repond a la question : le diff implemente-t-il ce qui a
ete demande ?

`scope-control` repond a la question : le diff evite-t-il les changements hors
perimetre et respecte-t-il les non-goals explicites ?

---

## 3. Sévérités

### Critical

Bug, faille, corruption, régression, breaking change non documenté, test
mensonger, échec mécanique, ou violation d'un invariant durable.

Un finding critical doit fournir une preuve.

### Major

Risque significatif. Il bloque seulement si `blocksWorkflow` vaut `true`.

### Minor

Amélioration utile mais non bloquante.

### Notable

Observation notable mais non bloquante. Ne bloque jamais.

---

## 4. Preuve obligatoire

Un finding bloquant doit contenir au moins une preuve :

- sortie d'outil ;
- reproduction minimale ;
- citation de spec ;
- comparaison avant/après ;
- chemin de données ou de contrôle ;
- invariant violé.

Sans preuve, un finding ne peut pas être `Critical`.

---

## 5. Artefact de sortie

La review ecrit d'abord un rapport detaille :

```ts
type ReviewReportArtifact = {
  schema: "go.review-report.v1";
  id: string;
  stage: "pre-package-review" | "pr-ci-review";
  stageOutputId: string;
  runCaptureId: string;
  reviewedSnapshotId?: string;
  reviewedPullRequestNumber?: number;
  intentCoverage: IntentCoverageRecord[];
  specConformance: SpecConformanceRecord[];
  scopeAssessment: ScopeAssessment;
  engineeringAssessment: EngineeringAssessment;
  findingArtifactId: string;
  narrativeSummaryRef: string;
};
```

Elle écrit aussi ses findings dans un artefact métier typé :

```ts
type ReviewFindingsArtifact = {
  schema: "go.review-findings.v1";
  id: string;
  stage: "pre-package-review" | "pr-ci-review";
  stageOutputId: string;
  findings: ReviewFinding[];
};
```

Le `StageOutput` du stage de review reste une enveloppe d'exécution. Si la
review s'est correctement exécutée et que l'artefact est valide, le
`StageOutput.status` peut être `passed` même quand l'artefact contient des
findings `Critical` ou `Major` bloquants.

Les transitions du workflow lisent les findings après validation et projection
dans `WorkflowState.findings`.

---

## 6. Inputs normatifs

Une review semantique ne peut pas s'executer sans :

- `RunCaptureArtifact` ;
- `promptAtGoRef` et `sessionRef` valides ;
- hash verifie du prompt ;
- dernier `ChangeSnapshot` applicable ;
- diff ou PR diff reel ;
- `ProjectDiscovery` finalise ;
- resultats des gates mecaniques requises ;
- specs, NIB, ADR ou contrats publics applicables au repo.

La review consulte `sessionRef` pour acceder au contexte complet de la session.
Le workflow doit rester reviewable avec les preuves capturees meme quand la
session source est indisponible.

---

## 7. Deux objets de review differents

`pre-package-review` et `pr-ci-review` utilisent les memes dimensions de review,
mais elles ne reviewent pas le meme objet.

### 7.1 `pre-package-review`

Objet reviewe :

- changement global final dans le worktree prive ;
- dernier `ChangeSnapshot` local ;
- diff complet avant packaging ;
- gates mecaniques locales executees sur ce snapshot.

Ce stage repond a :

```text
Le changement complet est-il correct, conforme a l'intention, conforme aux
specs, suffisamment teste, et sans scope creep ?
```

Il protege la coherence semantique du changement avant que le diff soit decoupe
en paquets Git.

Il ne peut pas prouver :

- qu'une PR partielle compile seule ;
- que le split en paquets est valide ;
- que le provider acceptera la branche ;
- que la CI distante passera ;
- que la branche base distante n'a pas bouge ;
- que le diff affiche dans la PR correspond au diff local.

### 7.2 `pr-ci-review`

Objet reviewe :

- PR publiee chez le provider ;
- branche head distante ;
- branche base distante ;
- diff provider reel ;
- commits materiels publies ;
- resultats CI et checks provider.

Ce stage repond a :

```text
La PR publiee est-elle une representation exacte, valide et mergeable du
changement approuve ?
```

Il protege la branche cible contre les risques introduits apres la review
globale :

- split invalide ;
- paquet incomplet ;
- commit manquant ;
- push incorrect ;
- base drift ;
- conflit de merge ;
- CI distante differente ;
- diff provider inattendu.

Il ne remplace pas `pre-package-review`, parce qu'une PR publiee peut etre
techniquement mergeable tout en ne repondant pas correctement a l'intention
globale. La coherence semantique du changement complet doit etre jugee avant le
packaging.

---

## 8. Prompts de review split

La review doit separer au moins deux passes.

### 8.1 Intent conformance review

Cette passe lit :

- prompt `/go` gele ;
- `sessionRef` pour le contexte complet de session ;
- diff reel ;
- explicit non-goals si presents dans le contexte de session ;
- specs citees par l'utilisateur ou directement necessaires pour juger la
  demande.

Elle produit :

- `IntentCoverageRecord[]` ;
- findings `intent-conformance` ;
- findings `scope-control`.

Prompt canonique :

```text
You are the intent-conformance reviewer for a /go workflow run.

Authoritative inputs:
1. RunCaptureArtifact and the full session context accessible via sessionRef.
2. The real diff or PR diff under review.
3. Applicable specs only when they constrain the requested behavior.

Task:
Determine whether the diff implements the frozen user intent, without missing
required behavior and without adding unrelated scope.

Rules:
- Do not invent requirements absent from the session context or specs.
- Treat explicit non-goals as binding.
- If intent is unclear, produce an "unclear" report item and a structured
  finding when that uncertainty can block publication.
- Every blocking concern must become a ReviewFinding.
- Narrative text is evidence for humans, never workflow authority.
```

### 8.2 Engineering and spec review

Cette passe lit :

- diff reel ;
- specs applicables ;
- gates mecaniques ;
- `ProjectDiscovery` ;
- snapshots ;
- packaging metadata si le stage est `pr-ci-review` ou `package-verify`.

Elle produit :

- `SpecConformanceRecord[]` ;
- `EngineeringAssessment` ;
- findings `correctness`, `robustness`, `security`, `spec-conformance`,
  `backward-compatibility`, `tests-*`, `structure`, `simplicity`,
  `packaging`.

Prompt canonique :

```text
You are the engineering reviewer for a /go workflow run.

Authoritative inputs:
1. The real diff or PR diff under review.
2. Applicable specs, NIBs, ADRs and public contracts.
3. Mechanical gate results and evidence.
4. ProjectDiscovery and snapshots.

Task:
Determine whether the implementation is correct, robust, compatible,
well-tested, structurally appropriate, and compliant with the applicable specs.

Rules:
- Cite exact specs or evidence for blocking findings.
- A Critical finding requires concrete evidence.
- Mechanical gates are evidence, not a substitute for semantic review.
- Do not fail the workflow for style preferences unless they violate a durable
  invariant or project spec.
- Every blocking concern must become a ReviewFinding.
```

Les deux passes peuvent tourner en parallele dans le stage de review si elles
consomment les memes inputs geles et ecrivent des evidences intermediaires
separees. Leurs findings sont fusionnes dans un seul `ReviewFindingsArtifact`.

---

## 9. Boucle de remediation

```text
review
  -> findings ouverts
  -> HumanGate ou policy
  -> apply / dismiss / defer / abort
  -> si apply: délégation de correction
  -> change-snapshot
  -> conduct-settled
  -> mechanical-gates
  -> review
```

Le workflow sort de la boucle quand il n'y a plus de `Critical` ouvert ni de
`Major` bloquant ouvert.

---

## 10. Relation au packaging

`pre-package-review` review le changement global complet.

`package-verify` vérifie le découpage en paquets et la reconstruction du diff.

`pr-ci-review` review le diff publie reel et l'etat provider de la PR.

Ces trois niveaux ne se remplacent pas. Ils protègent des risques différents.

```text
pre-package-review
  -> "le changement complet est bon"

package-verify
  -> "le split reconstruit le changement complet"

pr-ci-review
  -> "la PR publiee represente encore un changement bon et mergeable"
```

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
