# PR CI Review — Phase canonique du pipeline `/go`

Review de PR côté CI. Dernière gate avant merge.

---

## Responsabilités

- Réexécuter les gates mécaniques (lint, typecheck, tests) sur le diff réellement poussé.
- Réexécuter la review structurée selon [`ideal-review.md`](../review/ideal-review.md).
- Produire des `ReviewFinding` comparables à ceux de `pre-pr-review`.
- C'est la gate **autoritative** de merge : si elle échoue, la PR ne merge pas.

## Relation avec `pre-pr-review`

`pre-pr-review` tourne avant le push, sur le worktree local. `pr-ci-review`
tourne après le push, côté CI, sur le diff réel. Les deux utilisent la même
matrice de review (voir [`go-pipeline-contract.md`](../pipeline/go-pipeline-contract.md)).
