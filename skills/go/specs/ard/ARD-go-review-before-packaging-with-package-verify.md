---
id: ARD-GO-REVIEW-BEFORE-PACKAGING-WITH-PACKAGE-VERIFY
type: ard
version: "1.0.0"
scope: go-workflow/review-packaging
status: active
supersedes: []
superseded_by: []
---

# ARD - Review globale avant packaging, vérification après packaging

VegaCorp - July 2026

---

## Contexte

Deux ordres étaient possibles :

1. découper le diff en paquets, puis reviewer les paquets ;
2. reviewer le changement global, puis découper le diff validé.

Le workflow `/go` est conçu pour laisser l'agent produire d'abord un résultat
cohérent à partir de la demande et des specs. Forcer le packaging trop tôt
risque de déplacer l'attention vers la forme Git avant d'avoir validé le fond.

Mais découper après review introduit un autre risque : le split peut créer des
branches ou stacks qui ne compilent pas seules, perdent un contexte, ou
déclarent mal leurs dépendances.

---

## Décision

Le workflow adopte l'ordre suivant :

```text
implementation
-> review globale
-> remediation
-> final-change-snapshot
-> package-plan
-> package-verify
-> publish
```

La review globale avant packaging est conservée.

`package-verify` devient obligatoire avant publication.

---

## Conséquences

- L'agent implémente un résultat complet avant le découpage Git.
- Les reviewers locaux jugent la cohérence globale.
- Le packaging doit prouver la reconstruction exacte du diff final.
- Les paquets doivent être valides indépendamment ou selon leur stack déclarée.
- `commit-push-pr` ne reste pas un stage monolithique ; il est remplacé par
  `package-plan`, `package-verify`, `branch-materialize`, `commit-package`, et
  `publish-pr`.

---

## Alternatives rejetées

### Packaging avant review

Rejeté comme modèle par défaut : il rend le workflow moins naturel pour l'agent
et force une structure PR avant validation du résultat global.

### Review globale sans vérification post-split

Rejeté : la review du diff final ne prouve pas que les branches partielles ou
stacked PRs sont valides.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
