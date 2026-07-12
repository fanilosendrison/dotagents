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

Le pipeline valide d'abord le changement global final. Ensuite seulement il le
découpe en PRs.

Ce choix est volontaire : l'agent implémente un résultat cohérent avant que le
pipeline impose une forme Git reviewable.

La contrepartie est obligatoire : le split doit être vérifié avant publication.

---

## 2. `package-plan`

### Objectif

Découper le diff final en paquets logiques.

### Input

- `final-change-snapshot`
- `baseHeadSha`
- diff final validé
- findings résolus ou acceptés

### Output

`PackagePlan`

### Règles

- Chaque fichier modifié est assigné à au moins un paquet.
- Les chevauchements sont explicites et justifiés.
- Les dépendances entre paquets sont déclarées.
- Les paquets inséparables expliquent pourquoi un split plus fin serait faux.
- Le plan indique les branches cibles.

---

## 3. `package-verify`

### Objectif

Prouver que le découpage est publiable.

### Checks requis

- Reconstruction du diff final à partir des paquets.
- Hash reconstruit identique au hash original.
- Ordre topologique valide.
- Chaque paquet indépendant peut être appliqué depuis sa base.
- Chaque paquet dépendant peut être appliqué sur sa base de stack.
- Les checks mécaniques requis passent pour chaque branche ou stack selon le
  scope.

### Failure behavior

Si la reconstruction ne matche pas, le pipeline retourne à `package-plan`.

Si un paquet ne compile pas seul alors qu'il est marqué indépendant, le plan est
invalide.

Les diagnostics de packaging destinés à la boucle de remediation sont écrits
dans un `ReviewFindingsArtifact` avec `stage: "package-verify"` et
`dimension: "packaging"`. `PackageVerification` ne contient qu'une référence à
cet artefact.

---

## 4. `branch-materialize`

### Objectif

Créer les branches PR depuis leurs bases déclarées et appliquer les paquets.

### Règles

- Créer uniquement des branches `pr/<run-id>/<slug>`.
- Ne jamais partir de `work/<run-id>` directement.
- Appliquer les paquets depuis les artefacts vérifiés.
- Refuser une branche cible qui existe déjà avec une PR ouverte.

---

## 5. `commit-package`

### Objectif

Créer les commits atomiques de chaque paquet.

### Règles

- Utiliser Conventional Commits.
- Passer par le chemin Git de confiance.
- Ne jamais lancer `git commit` brut depuis l'agent.
- Ne jamais utiliser `BYPASS_GIT_ENFORCER=1`.

Ce stage est la seule stage `/go` autorisée à créer des commits.

---

## 6. `publish-pr`

### Objectif

Push les branches PR et ouvrir les pull requests.

### Règles

- Push uniquement `pr/<run-id>/<slug>`.
- Ne pas push `work/<run-id>` dans le flux nominal.
- Chaque PR référence :
  - `runId`;
  - package ids ;
  - preuve de reconstruction ;
  - gates passées ;
  - findings résolus, dismissés ou différés ;
  - HumanGates appliquées.

---

## 7. Stacked PRs

Un paquet dépendant cible la branche du paquet dont il dépend.

```text
main
  -> pr/<run-id>/base-package
       -> pr/<run-id>/dependent-package
```

Après merge d'une PR de base, les PRs dépendantes doivent être observées,
retargetées ou rebasées selon l'état réel du provider, puis repasser par
`pr-ci-review`.

---

## 8. Phases Turnlock typiques

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

VegaCorp - `/go` Pipeline - "Reliability precedes intelligence."
