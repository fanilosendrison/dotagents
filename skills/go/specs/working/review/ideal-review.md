# Review idéale dans `/go`

La review `/go` ne cherche pas une absence totale de remarques. Elle cherche
l'absence de risque bloquant prouvé.

---

## 1. Objectif

Produire un `ReviewFindingsArtifact` contenant des `ReviewFinding[]` structurés
qui permettent une transition mécanique :

- corriger ;
- dismiss avec justification ;
- defer si autorisé ;
- abort.

---

## 2. Dimensions

La review couvre les dimensions suivantes :

- correctness ;
- robustness ;
- security ;
- spec-conformance ;
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

---

## 3. Sévérités

### Critical

Bug, faille, corruption, régression, breaking change non documenté, test
mensonger, échec mécanique, ou violation d'un invariant durable.

Un finding critical doit fournir une preuve.

### Major

Risque significatif. Il bloque seulement si `blocksPipeline` vaut `true`.

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

La review écrit ses findings dans un artefact métier typé :

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

Les transitions de pipeline lisent les findings après validation et projection
dans `PipelineState.findings`.

---

## 6. Boucle de remediation

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

Le pipeline sort de la boucle quand il n'y a plus de `Critical` ouvert ni de
`Major` bloquant ouvert.

---

## 7. Relation au packaging

`pre-package-review` review le changement global.

`package-verify` vérifie le découpage.

`pr-ci-review` review le diff publié.

Ces trois niveaux ne se remplacent pas. Ils protègent des risques différents.

---

VegaCorp - `/go` Pipeline - "Reliability precedes intelligence."
