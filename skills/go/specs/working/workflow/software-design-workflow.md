# Workflow logiciel `/go`

Ce document décrit le cycle complet d'un `/go` dans le vocabulaire canonique :
startup tasks, stages, phases Turnlock, délégations, et stage harness.

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
  -> run-init
     ├─ run-capture
     ├─ repo-discovery-draft
     └─ workspace-setup
          ↓
        project-discovery-finalize
          ↓
        join run-capture
          ↓
        delegate implementation
          ↓ resumeAt
        implementation-settlement
          ↓
        change-snapshot
          ↓
        conduct-settled
          ↓
        mechanical-gates
          ↓
        pre-package-review
          ↓
        review-remediation
          ↓
        final-change-snapshot
          ↓
        package-plan
          ↓
        package-verify
          ↓
        branch-materialize
          ↓
        commit-package
          ↓
        publish-pr
          ↓
        pr-ci-review
          ↓
        post-merge-tracking
```

Le cycle n'est pas linéaire dès qu'une correction est appliquée. Toute mutation
retourne à `change-snapshot`.

Avant le startup, le parent process resout le `RepositoryLaunchContext` : repo
Git cible, sous-projet optionnel, et symlinks. Si cette cible est absente ou ambigue, `/go` echoue avant
Turnlock.

Le demarrage n'est pas lineaire non plus. Ce n'est pas un stage : c'est le
startup du run porte par la phase Turnlock `run-init`. `run-capture`,
`repo-discovery-draft` et `workspace-setup` peuvent avancer en parallele a
l'interieur de `run-init`, tant qu'ils ne modifient pas directement
`WorkflowState`.

---

## 3. Pourquoi cet ordre

### Startup: `run-init`

Le workflow commence par une phase Turnlock de bootstrap/onboarding. Turnlock
cree l'enveloppe runtime : `StateFile<GoRuntimeState>` contenant
`GoBootstrapState`, `runId`, `runDir`, lock, logger, horloges et persistance
atomique.

`run-init` remplace ensuite `GoBootstrapState` par `WorkflowState` dans
`StateFile.data` : `RepositoryLaunchContext`, `WorkflowPolicy`, hashes JCS des
inputs JSON, `artefactRoot`, marqueur d'ownership, chemin de worktree reserve et
startup task records initiaux.

`run-init` stocke le `RepositoryLaunchContext`, mais ne le decouvre pas lui-meme
et ne cree pas l'enveloppe runtime Turnlock. Il orchestre ensuite les startup
tasks internes, dont `workspace-setup` pour materialiser le worktree et
`project-discovery-finalize` pour produire le `ProjectDiscovery` autoritatif.
Il delegue `implementation` seulement si le bootstrap/onboarding requis est
prouve.

Si Turnlock rejoue `run-init` pour le meme `runId`, le retry doit produire le
meme payload initialise ou echouer ferme. Cette idempotence ne traverse jamais
deux invocations `/go` distinctes.

Ce n'est pas une analyse de la demande. C'est la condition de securite qui
permet aux startup branches d'ecrire leurs preuves au bon endroit et a l'agent
de travailler dans le bon worktree.

### Startup branch: `run-capture`

`run-capture` fige le moment `/go` sans l'interpreter.

Il capture :

- une reference de session ;
- un extrait minimal gele de session ;
- le prompt exact du `/go` ;
- les hashes de contenu du prompt et de l'extrait.

Il ne resout pas les specs, ne deduit pas les contraintes et ne produit pas
d'artefact semantique precoce. Ces interpretations appartiennent aux reviews,
quand le diff reel existe.

### Startup task: `workspace-setup`

Le point de départ Git doit être figé avant toute mutation. Le workflow crée un
worktree physique privé pour éviter les collisions entre sessions et les dirty
states partagés.

`workspace-setup` ne depend pas de `run-capture`. Il peut avancer pendant que la
capture de session s'ecrit.

### Startup branch: `repo-discovery-draft`

Le workflow ne doit pas inventer les commandes de check. Une premiere discovery
peut lire le checkout source pendant que le worktree prive est cree :

- manifestes ;
- lockfiles ;
- scripts ;
- configs ;
- capacites provider.

Ce resultat est un brouillon non autoritatif. Il accelere le demarrage, mais ne
decide pas encore les gates.

### Startup join: `project-discovery-finalize`

`project-discovery-finalize` finalise la discovery contre le worktree prive.

Il verifie que les fichiers inspectes par `repo-discovery-draft` correspondent
au `worktreeRoot` issu de `WorkSession`. Si les hashes ne correspondent pas, il
relance la discovery depuis le worktree ou echoue ferme selon
`WorkflowPolicy.discovery`.

Le resultat autoritatif est `ProjectDiscovery`, qui fixe la matrice de gates
mecaniques.

### Delegation: `implementation`

L'implémentation est un stage agentique delegue. Elle peut recevoir un
prompt, le contexte de session courant, des NIB-S, NIB-M, NIB-T, des contrats
de dépendance, ou des consignes utilisateur.

Turnlock ne rend pas l'agent déterministe. Turnlock rend le contour de la
délégation déterministe.

Dans le chemin nominal, la delegation `implementation` est emise par `run-init`
avec `resumeAt: "implementation-settlement"`.

### `implementation-settlement`

Apres l'agent, Turnlock reprend dans `implementation-settlement`. Cette phase
consomme le resultat de delegation, verifie les evidences attendues, confirme
que le worktree prive est toujours celui du run, puis route vers
`change-snapshot`, une HumanGate, une remediation immediate autorisee, ou un
echec ferme.

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

La review intervient avant packaging pour juger le résultat global final.

Elle est le premier moment ou l'analyse d'intention est necessaire. La review
lit le `RunCaptureArtifact`, l'extrait de session gele, les specs applicables,
le diff final et les resultats de gates. Elle peut alors poser la question
utile :

```text
Ce diff implemente-t-il l'intention utilisateur,
sans oubli, sans debordement de scope,
et sans violation des specs applicables ?
```

C'est volontaire : l'agent a produit un changement cohérent avant qu'on se
préoccupe de sa présentation Git.

`pre-package-review` regarde le changement comme un tout. Elle ne raisonne pas
encore en PRs, commits ou branches publiees. Elle protege la coherence
semantique du resultat complet.

Exemples de risques que `pre-package-review` doit detecter :

- une partie de la demande utilisateur a ete oubliee ;
- un non-goal explicite a ete viole ;
- le diff ajoute un comportement hors scope ;
- une spec applicable est violee ;
- les tests locaux passent mais ne couvrent pas la substance du changement ;
- la structure globale du changement est fragile ou incompatible.

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

`pr-ci-review` regarde la realite publiee. Elle ne se contente pas de relire le
diff local valide : elle verifie ce que le provider expose vraiment comme PR.

Exemples de risques que `pr-ci-review` doit detecter :

- la branche distante ne correspond pas au paquet attendu ;
- une PR partielle issue du split ne compile pas seule ;
- la base distante a bouge depuis la validation locale ;
- la CI provider echoue alors que les gates locales passaient ;
- un rebase ou retarget est necessaire ;
- le diff affiche par le provider ne correspond plus aux artefacts locaux ;
- une dependance implicite entre paquets a echappe a `package-verify`.

En raccourci :

| Stage | Objet reviewe | Question principale |
| ----- | ------------ | ------------------- |
| `pre-package-review` | diff global local | Bon changement complet ? |
| `pr-ci-review` | PR publiee reelle | Encore correct a merger ? |

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

- le `RunCaptureArtifact` est present et valide ;
- aucun `Critical` n'est ouvert ;
- aucun `Major` bloquant n'est ouvert ;
- les dismissals sont justifiés ;
- les defers respectent `WorkflowPolicy.review` ;
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
`WorkflowState`.

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
