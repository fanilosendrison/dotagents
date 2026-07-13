# Stages de packaging et publication

Ce document remplace l'ancienne stage monolithique `commit-push-pr` par cinq
stages plus petites :

- `package-plan`
- `package-verify`
- `branch-materialize`
- `commit-package`
- `publish-pr`

---

## 1. Principe

Le workflow valide d'abord le changement global final. Ensuite seulement il le
découpe en PRs.

Ce choix est volontaire : l'agent implémente un résultat cohérent avant que le
workflow impose une forme Git reviewable.

La contrepartie est obligatoire : le split doit être vérifié avant publication.

`package-plan` et `package-verify` doivent utiliser les primitives Git
standardisees decrites dans
[`external-primitives.md`](../standards/external-primitives.md). Le workflow peut
decider quels paquets existent, mais il ne doit pas parser, appliquer ou
comparer des patchs avec une implementation maison quand Git sait le faire.

---

## 2. `package-plan`

### Objectif de package-plan

Découper le diff final en paquets logiques.

### Input de package-plan

- `final-change-snapshot`
- `baseHeadSha`
- diff final validé
- findings résolus ou acceptés

### Output de package-plan

`PackagePlan`

### Règles de package-plan

- Chaque fichier modifié est assigné à au moins un paquet.
- Les chevauchements sont explicites et justifiés.
- Les dépendances entre paquets sont déclarées.
- Les paquets inséparables expliquent pourquoi un split plus fin serait faux.
- Le plan indique les branches cibles.

---

## 3. `package-verify`

### Objectif de package-verify

Prouver que le découpage est publiable.

`package-verify` reste une preuve locale. Il verifie que les paquets
reconstruisent le diff final et que leurs etats intermediaires sont valides
selon le scope declare.

Il ne voit pas encore la PR publiee, la CI provider, le drift de base distante,
les conflits de merge, ni le diff affiche par le provider. Ces risques
appartiennent a `pr-ci-review`.

### Checks requis de package-verify

- Reconstruction du diff final à partir des paquets.
- Hash reconstruit identique au hash original.
- Ordre topologique valide.
- Chaque paquet indépendant peut être appliqué depuis sa base.
- Chaque paquet dépendant peut être appliqué sur sa base de stack.
- Les checks mécaniques requis passent pour chaque branche ou stack selon le
  scope.

La reconstruction doit etre prouvee avec des artefacts produits ou valides par
Git, par exemple `git diff --binary --full-index`, `git apply --check`,
`git apply`, `git patch-id --stable`, `git merge-tree` ou `git range-diff`
selon le cas. Les hashes de patch portent sur la primitive Git choisie, pas sur
un format de diff invente par `/go`.

### Failure behavior de package-verify

Si la reconstruction ne matche pas, le workflow retourne à `package-plan`.

Si un paquet ne compile pas seul alors qu'il est marqué indépendant, le plan est
invalide.

Les diagnostics de packaging destinés à la boucle de remediation sont écrits
dans un `ReviewFindingsArtifact` avec `stage: "package-verify"` et
`dimension: "packaging"`. `PackageVerification` ne contient qu'une référence à
cet artefact.

---

## 4. `branch-materialize`

### Objectif de branch-materialize

Créer les branches PR depuis leurs bases déclarées et appliquer les paquets.

### Règles de branch-materialize

- Créer uniquement des branches `pr/<runId>/<slug>`.
- Ne jamais partir de `work/<runId>` directement.
- Appliquer les paquets depuis les artefacts vérifiés.
- Refuser une branche cible qui existe déjà avec une PR ouverte.

---

## 5. `commit-package`

### Objectif de commit-package

Créer les commits atomiques de chaque paquet.

### Règles de commit-package

- Utiliser Conventional Commits.
- Passer par le chemin Git de confiance.
- Ne jamais lancer `git commit` brut depuis l'agent.
- Ne jamais utiliser `BYPASS_GIT_ENFORCER=1`.

Ce stage est le seul stage `/go` autorisé à créer des commits.

---

## 6. `publish-pr`

### Objectif de publish-pr

Push les branches PR et ouvrir les pull requests.

### Règles de publish-pr

- Push uniquement `pr/<runId>/<slug>`.
- Ne pas push `work/<runId>` dans le flux nominal.
- Chaque PR référence :
  - `runId`;
  - package ids ;
  - preuve de reconstruction ;
  - gates passées ;
  - findings résolus, dismissés ou différés ;
  - HumanGates appliquées.

`publish-pr` ne rend pas une PR mergeable. Il materialise la proposition chez
le provider. La premiere gate autoritative sur cette realite publiee est
`pr-ci-review`.

---

## 7. Stacked PRs

Un paquet dépendant cible la branche du paquet dont il dépend.

```text
main
  -> pr/<runId>/base-package
       -> pr/<runId>/dependent-package
```

Après merge d'une PR de base, les PRs dépendantes doivent être observées,
retargetées ou rebasées selon l'état réel du provider, puis repasser par
`pr-ci-review`.

---

## 8. Operations internes typiques

```text
package-plan:
  load-final-snapshot
  delegate-package-planner
  validate-package-plan-schema
  persist-package-plan

package-verify:
  reconstruct-diff
  verify-package-branches
  run-scoped-mechanical-gates
  persist-package-verification

branch-materialize:
  create-pr-branches
  apply-package-diffs
  collect-branch-snapshots

commit-package:
  format-commit-messages
  request-trusted-git-mutation
  create-commits
  record-commit-shas

publish-pr:
  push-pr-branches
  create-pull-requests
  record-pr-urls
  trigger-pr-ci-review
```

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
