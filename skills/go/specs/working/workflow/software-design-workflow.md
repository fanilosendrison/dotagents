# Workflow logiciel `/go`

Ce document décrit le cycle complet d'un `/go` dans le vocabulaire canonique :
stages, phases Turnlock, délégations, et stage harness.

---

## 1. Modèle mental

`/go` est un workflow déterministe qui encadre des moments non déterministes.

Le workflow ne crée pas le changement par lui-même. Il prépare, délègue,
collecte, valide, corrige, découpe, publie et revalide.

L'agent ne décide pas que son travail est acceptable. Il propose un changement.
Le workflow vérifie ce changement par des artefacts, des gates, des findings, et
des hashes.

---

## 2. Cycle nominal

```text
/go
  -> intake
  -> workspace-setup
  -> project-discovery
  -> implementation
  -> change-snapshot
  -> conduct-settled
  -> mechanical-gates
  -> pre-package-review
  -> review-remediation
  -> final-change-snapshot
  -> package-plan
  -> package-verify
  -> branch-materialize
  -> commit-package
  -> publish-pr
  -> pr-ci-review
  -> post-merge-tracking
```

Le cycle n'est pas linéaire dès qu'une correction est appliquée. Toute mutation
retourne à `change-snapshot`.

---

## 3. Pourquoi cet ordre

### `intake`

Le workflow commence par figer la demande. Sans cela, l'agent peut corriger un
problème différent de celui que le run est censé traiter.

`intake` collecte :

- prompt utilisateur ;
- specs applicables ;
- contraintes ;
- critères d'acceptation ;
- autorisations ;
- politique d'adoption du dirty state.

### `workspace-setup`

Le point de départ Git doit être figé avant toute mutation. Le workflow crée un
worktree physique privé pour éviter les collisions entre sessions et les dirty
states partagés.

### `project-discovery`

Le workflow ne doit pas inventer les commandes de check. Il détecte ce que le
repo expose réellement : package manager, scripts, lockfiles, conventions,
outils disponibles.

### `implementation`

L'implémentation est un stage agentique. Elle peut recevoir un
prompt, des NIB-S, NIB-M, NIB-T, des contrats de dépendance, ou des critères
d'acceptation.

Turnlock ne rend pas l'agent déterministe. Turnlock rend le contour de la
délégation déterministe.

### `change-snapshot`

Après l'agent, le workflow capture l'état réel. Ce snapshot est la frontière
entre création non déterministe et vérification déterministe.

### `conduct-settled`

Ce stage vérifie que l'agent n'a pas laissé de traces dangereuses : secrets,
fichiers temporaires, permissions, debug persistants, staging ambigu.

### `mechanical-gates`

Les checks mécaniques filtrent d'abord ce que les machines savent vérifier :
format, lint, typecheck, tests, build, scans et drift généré.

### `pre-package-review`

La review intervient avant packaging pour juger le résultat global final. C'est
volontaire : l'agent a produit un changement cohérent avant qu'on se préoccupe
de sa présentation Git.

### `review-remediation`

Si la review trouve des risques bloquants, le workflow demande une décision ou
délègue une correction approuvée. Toute correction invalide les checks
précédents.

### `package-plan`

Une fois le résultat global conforme, le workflow découpe le diff final en
paquets logiques.

### `package-verify`

Ce stage protège contre le danger introduit par le split : un paquet peut ne
pas compiler seul, dépendre implicitement d'un autre, ou perdre un contexte que
la review globale avait validé.

### `publish-pr` et `pr-ci-review`

La publication produit des PRs. La CI review rejoue les gates sur le diff réel
poussé et devient l'autorité de merge.

---

## 4. Boucles

### Boucle de correction mécanique

```text
mechanical-gates
  -> failure
  -> delegate-fix
  -> change-snapshot
  -> conduct-settled
  -> mechanical-gates
```

### Boucle de review

```text
pre-package-review
  -> findings
  -> review-remediation
  -> apply-remediation
  -> change-snapshot
  -> conduct-settled
  -> mechanical-gates
  -> pre-package-review
```

### Boucle de packaging

```text
package-plan
  -> package-verify
  -> split invalid
  -> package-plan
```

### Boucle PR/CI

```text
publish-pr
  -> pr-ci-review
  -> failure or rebase needed
  -> pr-remediation
  -> pr-ci-review
```

---

## 5. Critère d'arrêt de la review

La review ne cherche pas zéro remarque. Elle cherche zéro risque bloquant.

Le workflow avance si :

- aucun `Critical` n'est ouvert ;
- aucun `Major` bloquant n'est ouvert ;
- les dismissals sont justifiés ;
- les defers respectent la policy ;
- les gates mécaniques sont vertes sur le dernier snapshot.

Les findings `Minor` et `Notable` peuvent devenir backlog, mais ne bloquent
pas la publication.

---

## 6. Diff global puis packaging

Le modèle retenu est :

```text
implémenter le résultat complet
-> valider le résultat complet
-> découper le diff validé
-> vérifier que le split est valide
-> publier les PRs
```

Ce choix optimise la cohérence sémantique du changement. L'agent travaille
d'abord sur le problème réel, pas sur la forme Git finale.

La contrepartie est obligatoire : `package-verify` doit prouver que les PRs
créées à partir du diff final restent valides séparément ou en stack.

---

## 7. Relation au stage harness

Chaque stage standalone peut être exécuté par `runStage`.

Le stage harness garantit :

- création et validation de l'artefact directory ;
- validation du draft output ;
- evidence refs contenues ;
- référencement des artefacts métier typés produits par le stage ;
- collecte des champs Git canoniques ;
- écriture atomique de `output.json`.

Il ne garantit pas :

- reprise Turnlock ;
- décision humaine ;
- retry/fallback ;
- orchestration multi-stage ;
- validation métier cross-stage ;
- merge ou publication.

Les payloads métier complexes, comme les `ReviewFinding[]`, vivent dans des
artefacts métier typés. Le `StageOutput` indique si le stage s'est exécuté
correctement ; Turnlock valide ensuite les artefacts et les projette dans
`PipelineState`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
