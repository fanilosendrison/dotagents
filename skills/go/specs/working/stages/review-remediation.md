---
okf_version: "1.0"
kind: "RuntimeArtifact"
format: "cubits-design-doc"
workspace: "go"
date: "2026-07-17"
step_id: 0
id: CDD-GO-REVIEW-REMEDIATION
version: "1.0.0"
scope: stages
status: active
consumers: [agent-generator]
superseded_by: []
---

# Stage `review-remediation`

`review-remediation` traite les findings ouverts issus de `pre-package-review`
ou `pr-ci-review`.

---

## 1. Objectif

Transformer des findings ouverts en décisions traçables :

- appliquer ;
- dismiss ;
- defer ;
- abort.

---

## 2. Principe

La décision et la mutation sont séparées.

La HumanGate décide. Une délégation séparée applique les corrections approuvées.

---

## 3. Inputs

- `WorkflowState.findings` projeté depuis des `ReviewFindingsArtifact` validés
- dernier `ChangeSnapshot`
- policy de remediation
- décisions humaines précédentes

---

## 4. Outputs

- `HumanGate[]`
- `RemediationAttempt[]`
- findings mis à jour
- nouveau snapshot si une correction est appliquée

---

## 5. Actions

### `apply`

Appliquer une correction via délégation agentique. Retour obligatoire à
`change-snapshot`.

### `dismiss`

Marquer le finding comme faux positif ou non applicable avec justification.

### `defer`

Autorisé seulement pour `Major` non bloquant, `Minor`, ou `Notable`, selon
`WorkflowPolicy.review`.

### `abort`

Arrêter le run.

---

## 6. Règles

- Un `Critical` ne peut pas être deferred silencieusement.
- Un dismissal sans justification est invalide.
- Une correction qui ne change rien doit être enregistrée comme `no-change`.
- Toute correction invalide les gates précédentes.

---

## 7. Operations internes typiques

```text
load-open-findings
classify-required-decisions
open-human-gates
wait-human-or-policy-decision
delegate-remediation-if-approved
collect-remediation-snapshot
persist-remediation-attempt
decide-next-transition
```

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
