---
id: ARD-GO-WORKFLOW-NOT-PIPELINE
type: ard
version: "1.0.0"
scope: go-workflow
status: active
supersedes: []
superseded_by: []
---

# ARD — `workflow`, pas `pipeline`

VegaCorp - July 2026

---

## Contexte

Les specs `/go` utilisaient le mot `pipeline` pour désigner l'ensemble du cycle
`/go`. Or le `/go` n'est pas un flux linéaire unidirectionnel.

Il contient :

- des **boucles** (review-remediation → change-snapshot → mechanical-gates →
  review) ;
- des **gates** (HumanGate interrompt le flux, attend une décision externe) ;
- des **branches conditionnelles** (package-verify échoue → retour à
  package-plan) ;
- de la **concurrence** (plusieurs runs parallèles sur des worktrees physiques
  distincts).

`Pipeline` suggère un graphe orienté acyclique, ce qui ne correspond pas à la
réalité. De plus, `pipeline` entre en collision avec le pipeline UNIX
(`bun orchestrator.ts | bun bridge.ts`) qui est un détail d'implémentation du
consommateur Turnlock, pas un concept produit.

---

## Décision

Le terme `workflow` remplace `pipeline` dans toutes les specs `/go`.

`PipelineState` (le type Turnlock) **n'est pas renommé** — c'est un nom de type
interne à Turnlock, pas un concept produit exposé à l'utilisateur.

---

## Conséquences

- Dossier `working/pipeline/` → `working/workflow/`.
- Fichier `pipeline-artifacts.md` → `workflow-artifacts.md`.
- Toutes les références textuelles "pipeline `/go`" → "workflow `/go`".
- Frontmatter `scope: go-pipeline/*` → `scope: go-workflow/*` dans les ARDs.
- `CONTEXT.md` et tous les liens croisés mis à jour.

---

## Alternatives rejetées

### Garder `pipeline`

Rejeté : le terme est trompeur pour un graphe avec boucles, gates et
concurrence. Il crée une confusion avec le pipeline UNIX du consommateur
Turnlock.

### `orchestration`

Rejeté : c'est le terme Turnlock. Le workflow `/go` est consommateur de
l'orchestration Turnlock, pas synonyme.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
