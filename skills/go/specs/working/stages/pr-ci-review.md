# Stage `pr-ci-review`

`pr-ci-review` est la gate autoritative avant merge. Elle s'exécute sur le diff
réellement poussé, pas sur le worktree local brut.

---

## 1. Objectif

Rejouer les gates mécaniques et la review structurée sur les branches PR
publiées.

---

## 2. Inputs

- `PullRequestRecord`
- branche head réelle
- branche base réelle
- package ids
- artefacts de `package-verify`
- policy du repository

---

## 3. Responsabilités

- Lire l'état réel de la PR.
- Vérifier que la base et la head correspondent au `PipelineState`.
- Rejouer les checks mécaniques requis.
- Rejouer les dimensions pertinentes de review.
- Détecter drift, retarget, merge conflict, ou CI failure.
- Produire un `ReviewFindingsArtifact` comparable à celui de
  `pre-package-review`.

---

## 4. Relation à la review locale

`pre-package-review` valide le changement global final avant packaging.

`pr-ci-review` valide le diff publié dans sa forme réelle.

Les deux sont nécessaires. La première protège la cohérence sémantique du
changement. La seconde protège la branche cible contre un split invalide, un
drift provider, une CI différente, ou un rebase nécessaire.

---

## 5. Outcomes

```ts
type PrCiReviewOutcome =
  | { status: "passed" }
  | { status: "failed"; reviewFindingsArtifactId?: string }
  | { status: "needs-rebase"; reason: string }
  | { status: "errored"; reason: string };
```

Les findings eux-mêmes ne sont pas encodés dans l'outcome. Ils sont validés dans
un artefact métier typé, puis projetés dans `PipelineState.findings`.

---

## 6. Phases Turnlock typiques

```text
load-pr-record
fetch-provider-state
validate-pr-identity
run-ci-mechanical-gates
run-structured-review
persist-pr-ci-review-output
decide-mergeability
```

---

## 7. Failure behavior

- CI failed : `failed`.
- Finding bloquant : `failed`.
- Base drift non traité : `needs-rebase`.
- Provider inaccessible : `errored`.
- PR fermée hors workflow : HumanGate ou abort selon policy.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
