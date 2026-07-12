---
id: ADR-GO-STAGE-OUTPUT-ENVELOPE-AND-TYPED-BUSINESS-ARTIFACTS
type: ard
version: "1.0.0"
scope: go-workflow/artifacts
status: active
supersedes: []
superseded_by: []
---

# ARD - StageOutput enveloppe, artefacts métier typés

VegaCorp - July 2026

---

## Contexte

Le stage harness impose un contrat commun à toute stage standalone :

```ts
runStage(stageFn, input) -> StageOutput
```

Mais certaines stages produisent un résultat métier plus riche qu'un statut de
stage. Le cas critique est la review : `pre-package-review` et `pr-ci-review`
produisent des `ReviewFinding[]`.

Deux modèles étaient possibles :

- stocker les findings uniquement à côté du `StageOutput`, dans des evidence
  files, puis les lire par convention ;
- faire de `ReviewFinding` une extension de `StageError` et retourner les
  findings dans `StageOutput.errors`.

Le premier modèle rendait les findings trop implicites. Le second mélangeait une
erreur d'exécution figée avec une décision métier qui possède un cycle de vie.

---

## Décision

`StageOutput` est l'enveloppe d'exécution canonique d'un stage.

Les payloads métier durables sont des artefacts métier typés :

- JSON validé par schéma ;
- référencé depuis le record de stage ;
- validé par Turnlock ;
- projeté dans `WorkflowState`.

`ReviewFinding` ne dérive pas de `StageError`.

Les findings utilisent le canon de sévérité suivant :

- `Critical`
- `Major`
- `Minor`
- `Notable`

Les erreurs du stage harness conservent leur canon séparé :

- `blocking`
- `major`
- `minor`

Le mapping entre les deux existe seulement quand un diagnostic de stage doit
être résumé en finding :

- `blocking` -> `Critical`
- `major` -> `Major`
- `minor` -> `Minor`

---

## Conséquences

- Une review qui s'exécute correctement peut produire `StageOutput.status:
  "passed"` même si son artefact contient des findings `Critical`.
- Les transitions de workflow lisent les findings depuis `WorkflowState.findings`
  après validation du `ReviewFindingsArtifact`.
- `StageOutput.errors` reste réservé aux diagnostics d'exécution, de contrat, de
  validation, ou de persistance du stage.
- Les stages qui produisent des payloads riches doivent déclarer leur artefact
  métier typé.
- Turnlock devient responsable de valider ces artefacts avant mutation de
  `WorkflowState`.

---

## Alternatives rejetées

### Findings uniquement en evidence files conventionnels

Rejeté : le résultat principal de review serait invisible pour le modèle d'état
tant que le wrapper ne connaît pas une convention externe.

### ReviewFinding étend StageError

Rejeté : un finding n'est pas une erreur d'exécution. Il possède une identité,
une dimension, une recommandation, un statut de cycle de vie, et peut être fixé,
dismissé ou différé.

### Ajouter un champ générique `payload` à StageOutput

Rejeté pour le modèle canonique : cela rendrait le harness responsable de
payloads métier qu'il ne sait pas interpréter. Les artefacts typés gardent le
harness simple et déplacent la validation métier dans Turnlock.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
