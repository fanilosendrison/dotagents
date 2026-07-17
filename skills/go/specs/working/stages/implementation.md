---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cubits-design-doc"
workspace: "go"
date: "2026-07-17"
step_id: 0
id: CDD-GO-IMPLEMENTATION
version: "1.0.0"
scope: stages
status: active
consumers: [agent-generator]
superseded_by: []
---

# Stage `implementation`

`implementation` est le stage logique qui délègue la création du changement à
un agent. Dans le chemin nominal, il est lance par la phase Turnlock `run-init`
via une delegation `label: "implementation"` et repris par
`implementation-settlement`.

---

## 1. Nature du stage

`implementation` est un stage valide, mais pas un check mécanique.

Son contour est déterministe :

- valider les inputs ;
- préparer les artefacts ;
- déléguer ;
- reprendre dans `implementation-settlement` ;
- collecter et valider les evidences ;
- router vers `change-snapshot`, HumanGate, remediation ou fail-closed.

Son coeur est non déterministe : l'agent raisonne, édite, teste, itère.

---

## 2. Inputs

- `WorkSession`
- contexte de session courant fourni par le parent process
- prompt utilisateur associe au `/go`
- specs disponibles ou explicitement referencees (`NIB-S`, `NIB-M`, `NIB-T`,
  DC, ADR)
- `ProjectDiscovery`
- contraintes d'autorisation
- `RunCaptureArtifact` si deja projete dans `WorkflowState`

`implementation` ne depend pas d'une analyse d'intention prealable. L'agent
d'implementation est lance dans le contexte de la session qui a declenche
`/go`.

---

## 3. Outputs

Evidence JSON :

```ts
type ImplementationEvidence = {
  runCaptureRef?: string;
  sessionContextRef?: string;
  consumedSpecRefs: string[];
  changedFiles: ChangedFile[];
  summary: string;
  exploratoryChecks: string[];
};
```

Les checks exploratoires lancés par l'agent ne sont pas autoritaires. Les gates
officielles s'exécutent après `change-snapshot`.

---

## 4. Règles

- L'agent travaille uniquement dans le worktree du run.
- L'agent ne publie pas de commit.
- L'agent ne push pas.
- L'agent ne modifie pas les artefacts d'autres runs.
- L'agent peut lancer des commandes exploratoires, mais leur succès ne remplace
  pas `mechanical-gates`.
- Si le stage consomme des NIB, il doit respecter RED/GREEN quand applicable.
- Le stage ne doit pas inventer un artefact semantique durable pour justifier
  son travail. L'analyse de conformite a l'intention appartient a la review.

---

## 5. Segments Turnlock typiques

```text
run-init
  validate implementation inputs
  prepare implementation artefacts
  delegate label: implementation
  resumeAt: implementation-settlement

implementation-settlement
  consume implementation result
  validate implementation evidence
  verify worktree still belongs to run
  route to change-snapshot, HumanGate, remediation, or fail
```

---

## 6. Failure modes

- Agent bloqué : `failed` ou HumanGate selon
  `WorkflowPolicy.delegation.implementationBlockedBehavior`.
- Output agentique invalide : `errored`.
- Mutation hors worktree : `failed`.
- Specs contradictoires : HumanGate ou `failed`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
