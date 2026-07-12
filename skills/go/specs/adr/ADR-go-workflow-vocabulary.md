---
id: ADR-GO-WORKFLOW-VOCABULARY
type: ard
version: "1.1.0"
scope: go-workflow
status: active
supersedes: []
superseded_by: []
---

# ADR — vocabulaire `workflow`

VegaCorp - July 2026

---

## Contexte

Les specs `/go` utilisaient auparavant une terminologie de flux lineaire pour
designer l'ensemble du cycle `/go`. Or le `/go` n'est pas un flux lineaire
unidirectionnel.

Il contient :

- des **boucles** (review-remediation → change-snapshot → mechanical-gates →
  review) ;
- des **gates** (HumanGate interrompt le flux, attend une décision externe) ;
- des **branches conditionnelles** (package-verify échoue → retour à
  package-plan) ;
- de la **concurrence** (plusieurs runs parallèles sur des worktrees physiques
  distincts).

Le terme ancien suggere un graphe oriente acyclique, ce qui ne correspond pas a
la realite. Il entre aussi en collision avec les flux shell du consommateur
Turnlock, qui sont des details d'implementation et pas des concepts produit.

---

## Décision

Le terme `workflow` est le terme canonique pour le cycle `/go`.

L'etat metier `/go` s'appelle `WorkflowState`.

Turnlock ne definit pas `WorkflowState`. Turnlock persiste un
`StateFile<State>` generique. Pour `/go`, la relation normative est :

```ts
StateFile<WorkflowState>
```

`WorkflowState` est donc le payload metier `/go` stocke dans `StateFile.data`.

---

## Conséquences

- `WorkflowState` est le payload metier `/go` persiste dans
  `StateFile.data`.
- `WorkflowStage` nomme les stages metier du workflow `/go`.
- `blocksWorkflow` est le flag de blocage expose par les findings.
- `go.workflow-state.v1` est le schema canonique de l'etat metier `/go`.
- Dossier de conception actif : `working/workflow/`.
- Fichier d'artefacts actif : `workflow-artifacts.md`.
- `CONTEXT.md` et tous les liens croisés mis à jour.

---

## Alternatives rejetées

### Garder l'ancien vocabulaire

Rejete : le terme est trompeur pour un graphe avec boucles, gates et
concurrence. Il cree une confusion avec les flux shell du consommateur Turnlock.

### `orchestration`

Rejeté : c'est le terme Turnlock. Le workflow `/go` est consommateur de
l'orchestration Turnlock, pas synonyme.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
