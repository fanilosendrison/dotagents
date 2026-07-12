---
id: ADR-GO-STAGES-VS-TURNLOCK-PHASES
type: ard
version: "1.0.0"
scope: go-workflow
status: active
supersedes: []
superseded_by: []
---

# ARD - Séparer stages et phases Turnlock

VegaCorp - July 2026

---

## Contexte

Les premières specs `/go` utilisaient le mot "phase" pour désigner à la fois :

- une étape lisible du workflow logiciel ;
- une phase atomique de reprise Turnlock ;
- une délégation agentique ;
- une exécution standalone via stage harness.

Cette ambiguïté rendait les documents difficiles à implémenter : un stage
comme `implementation` n'a pas la même nature qu'un check `typecheck`, mais les
deux étaient listées au même niveau.

---

## Décision

Le workflow `/go` adopte quatre termes canoniques :

- **stage** : étape métier du workflow ;
- **phase Turnlock** : unité atomique, persistée, reprenable ;
- **délégation** : travail agentique non déterministe encadré ;
- **stage harness** : contrat `StageInput -> StageOutput`.

Un stage peut contenir plusieurs phases Turnlock et plusieurs délégations. Une
délégation n'est jamais autoritaire tant qu'une phase Turnlock mécanique ne l'a
pas validée.

---

## Conséquences

- Les docs workflow parlent de stages.
- Les futurs wrappers Turnlock spécifient les phases internes.
- Les stages agentiques comme `implementation` restent valides, mais leur coeur
  est explicitement une délégation.
- Les HumanGates sont des phases Turnlock de décision, pas des stages de
  mutation.

---

## Alternatives rejetées

### Tout appeler phase

Rejeté : cela masque la différence entre check déterministe, délégation
agentique, et phase Turnlock de reprise.

### Tout modéliser directement en phases Turnlock

Rejeté : cela rend le workflow illisible pour les specs produit. Les humains
ont besoin de stages stables.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
