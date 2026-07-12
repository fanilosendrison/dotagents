# Stage `pr-ci-review`

`pr-ci-review` est la gate autoritative avant merge. Elle s'exécute sur le diff
réellement poussé, pas sur le worktree local brut.

---

## 1. Objectif

Rejouer les gates mécaniques et la review structurée sur les branches PR
publiées.

`pr-ci-review` ne review pas le worktree local. Elle review la realite publiee :
ce que le provider Git expose comme PR, head, base, diff et CI.

Cette realite doit etre lue via les APIs ou CLIs provider structurees. Le stage
ne doit pas scraper l'interface web du provider ni deduire l'etat CI depuis du
texte libre quand les checks, statuses, diffs ou commits sont disponibles sous
forme structuree. Voir
[`external-primitives.md`](../workflow/external-primitives.md).

---

## 2. Inputs

- `RunCaptureArtifact`
- `PullRequestRecord`
- branche head réelle
- branche base réelle
- package ids
- artefacts de `package-verify`
- policy du repository

---

## 3. Responsabilités

- Lire l'état réel de la PR.
- Vérifier que la base et la head correspondent au `WorkflowState`.
- Rejouer les checks mécaniques requis.
- Rejouer les dimensions pertinentes de review, dont `intent-conformance`,
  `scope-control` et `spec-conformance`.
- Détecter drift, retarget, merge conflict, ou CI failure.
- Produire un `ReviewReportArtifact` pour le diff publie.
- Produire un `ReviewFindingsArtifact` comparable à celui de
  `pre-package-review`.

---

## 4. Relation à la review locale

`pre-package-review` valide le changement global final avant packaging.

`pr-ci-review` valide le diff publié dans sa forme réelle.

Les deux sont nécessaires. La première protège la cohérence sémantique du
changement. La seconde protège la branche cible contre un split invalide, un
drift provider, une CI différente, ou un rebase nécessaire.

`pr-ci-review` relit `RunCaptureArtifact` pour verifier que le diff publie
reste conforme a l'intention gelee du run. Elle ne se contente pas de verifier
que la PR compile.

### 4.1 Difference d'objet

| Stage | Objet reviewe | Moment |
| ----- | ------------ | ------ |
| `pre-package-review` | diff global local | avant packaging |
| `pr-ci-review` | PR publiee reelle | apres publication |

`pre-package-review` juge la coherence du changement complet. Elle a le meilleur
contexte pour savoir si l'intention utilisateur est satisfaite avant que le diff
soit decoupe.

`pr-ci-review` juge la fidelite et la mergeability de ce qui a ete publie. Elle
a le meilleur contexte pour savoir si la PR distante correspond encore aux
artefacts valides et si elle peut entrer dans la branche cible.

### 4.2 Ce que `pr-ci-review` prouve

- La branche head distante correspond au `PullRequestRecord`.
- La branche base distante est la base attendue, ou le drift est detecte.
- Le diff provider correspond au paquet materialise.
- Les commits publies correspondent au plan de commit.
- Les checks CI requis sont verts ou leurs echecs sont structures.
- Les dimensions de review pertinentes restent satisfaites sur le diff publie.

### 4.3 Ce que `pr-ci-review` ne remplace pas

`pr-ci-review` ne doit pas devenir la premiere review semantique du changement.

Elle ne remplace pas `pre-package-review`, parce que :

- une PR peut etre techniquement mergeable mais incomplete par rapport a
  l'intention globale ;
- une PR issue d'un split peut etre correcte seule mais perdre la coherence du
  changement complet ;
- le provider ne sait pas pourquoi le run `/go` a ete lance ;
- les non-goals et contraintes de session doivent deja avoir ete confrontes au
  diff global.

---

## 5. Outcomes

```ts
type PrCiReviewOutcome =
  | { status: "passed" }
  | {
      status: "failed";
      reviewReportArtifactId?: string;
      reviewFindingsArtifactId?: string;
    }
  | { status: "needs-rebase"; reason: string }
  | { status: "errored"; reason: string };
```

Les findings eux-mêmes ne sont pas encodés dans l'outcome. Ils sont validés dans
un artefact métier typé, puis projetés dans `WorkflowState.findings`.

---

## 6. Phases Turnlock typiques

```text
load-pr-record
fetch-provider-state
validate-pr-identity
run-ci-mechanical-gates
run-intent-conformance-review
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
- PR fermée hors workflow : HumanGate ou abort selon `WorkflowPolicy.review`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
