# Go Pipeline Contract — FSM, artefacts, gates

Ce document est le contrat central du pipeline `/go`. Il définit les invariants,
les sévérités, le catalogue des phases, les règles de terminaison et de preuve,
et la relation avec Turnlock.

Documents référencés :

- [`software-design-workflow.md`](./software-design-workflow.md) — architecture générale du pipeline.
- [`ideal-review.md`](../review/ideal-review.md) — contenu sémantique de la review.
- [`agent-conduct-check.md`](../phases/agent-conduct-check.md) — check des traces process de l'agent.
- [`commit-push-pr.md`](../phases/commit-push-pr.md) — découpage Git, branches, push, PR.
- [`pipeline-artifacts.md`](../artifacts/pipeline-artifacts.md) — types JSON partagés.
- [`phase-harness/`](../../briefs/phase-harness/) — harness d'exécution de phase (NIB).

Le principe : **Turnlock porte l'état mécanique**, les outils déterministes
produisent des preuves, les agents produisent des artefacts JSON validés, et
l'humain arbitre uniquement les décisions sémantiques irréductibles.

> **Note — Phase Contract**: L'exécution individuelle de chaque phase est
> régie par [`phase-harness/NIB-S-go-phase-harness.md`](../../briefs/phase-harness/NIB-S-go-phase-harness.md),
> qui définit les types canoniques `PhaseInput`, `PhaseDraftOutput`, `PhaseOutput`,
> `PhaseError` et le runner `runPhase()`. Les structures ci-dessous sont des
> projections d'état pipeline ; elles ne remplacent jamais `artefactDir/output.json`,
> qui reste la sortie canonique de phase.

---

## Invariants globaux

1. **Snapshot-authoritative** : `state.json` Turnlock est la source de vérité de
   l'avancement. Les logs et commentaires PR sont dérivés, jamais autoritaires.
2. **Fail-closed** : absence d'artefact, JSON invalide, schéma invalide, finding
   bloquant non traité, ou résultat non reproductible → arrêt du pipeline.
3. **JSON-only** : tout artefact échangé entre phases est du JSON validable.
4. **Pas de jugement caché dans le pipeline** : une branche conditionnelle de
   la FSM dépend d'un `PhaseOutput.status`, d'un booléen, d'un hash canonique,
   d'un compteur, ou d'un finding structuré. Elle ne dépend jamais d'une phrase
   libre ni d'un exit code brut.
5. **Tout finding bloquant est probatoire** : il nomme l'invariant violé et
   fournit une reproduction minimale ou une preuve mécanique.
6. **Toute modification relance les gates mécaniques** : après un fix agentique,
   le pipeline repasse par `agent-conduct-check` → lint → typecheck → tests
   avant toute review suivante.
7. **Human gate explicite** : aucun changement de code issu d'une finding de
   review agentique n'est appliqué sans décision explicite ou mode d'auto-apply
   déclaré dans `state.json`.

---

## Sévérités canoniques

Le pipeline utilise exactement les sévérités de [`ideal-review.md`](../review/ideal-review.md).

- **Bloquant** : bug, faille, corruption, régression, breaking change non
  documenté, test mensonger, ou échec mécanique. Le pipeline ne peut pas
  avancer tant que ce point n'est pas corrigé, rejeté comme faux positif avec
  justification, ou explicitement converti en décision humaine documentée.
- **Majeur** : dette ou risque significatif. Peut bloquer si `blocksPipeline`
  vaut `true`, sinon devient une gate humaine ou un backlog prioritaire.
- **Mineur** : amélioration utile mais non bloquante. N'arrête pas le pipeline.
- **Suggestion** : préférence, alternative équivalente, micro-refactor. N'arrête
  jamais le pipeline.

Le vocabulaire `CRITICAL/HIGH/MEDIUM/LOW` n'est pas utilisé dans les artefacts du
pipeline. Si un outil externe émet ces niveaux, la phase d'ingestion les mappe
avant persistance.

Mapping avec `PhaseError.severity` (voir `phase-harness/`) :

- `blocking` → `Bloquant`
- `major` → `Majeur`
- `minor` → `Mineur`

`Suggestion` est propre aux `ReviewFinding` : ce n'est pas une sévérité de
`PhaseError`. Si une suggestion doit être conservée comme preuve de phase, elle
reste un finding non bloquant ou est encodée en `minor` avec contexte explicite.

---

## Phases canoniques

### 1. `workspace-setup`

Phase déterministe avant toute implémentation. Elle fige le point de départ du
run : repo, branche courante, `HEAD`, état dirty, branche cible par défaut, et
branche de travail privée. Voir [`workspace-setup.md`](../phases/workspace-setup.md).

### 2. `implementation`

L'agent principal implémente la demande utilisateur. Cette phase peut lancer ses
propres tests exploratoires, mais ses résultats ne sont pas autoritaires. Elle
travaille sur `work/<run-id>` et produit un diff brut plus un résumé d'intention.

### 3. `agent-conduct-check`

Check déterministe des traces laissées par l'agent : secrets dans commandes,
fichiers temporaires, environnement, staging area, permissions dangereuses,
process debug persistants. Voir [`agent-conduct-check.md`](../phases/agent-conduct-check.md).

### 4. `lint`

Check déterministe de surface. Échec → délégation de correction, retry borné,
fallback model, puis recheck.

### 5. `typecheck`

Check déterministe de cohérence statique. Échec → délégation de correction,
retry borné, fallback model, puis recheck.

### 6. `tests`

Check déterministe de comportement. Échec → délégation de correction, retry
borné, fallback model, puis recheck.

### 7. `pre-pr-review`

Review hybride avant commit : agrège checks mécaniques spécifiques à
[`ideal-review.md`](../review/ideal-review.md) puis délègue les dimensions sémantiques à
des agents. Elle produit des findings structurés, pas des modifications directes.

### 8. `review-remediation`

Si des findings `Bloquant` ou des findings `Majeur` avec `blocksPipeline: true`
existent, la FSM demande une décision humaine :

- `apply` : l'agent corrige le batch approuvé, puis retour à `agent-conduct-check`.
- `dismiss` : le finding est marqué faux positif avec justification.
- `defer` : autorisé seulement pour `Majeur` non bloquant, `Mineur`, ou `Suggestion`.
- `abort` : arrêt du pipeline.

### 9. `commit-push-pr`

Découpe le diff en paquets logiques, crée les branches dédiées, applique les
paquets, commit, push, et ouvre les PRs. Voir [`commit-push-pr.md`](../phases/commit-push-pr.md).

### 10. `pr-ci-review`

Review de PR côté CI. Elle réexécute les gates mécaniques et la review
structurée sur le diff réellement poussé. C'est la gate autoritative de merge.
Voir [`pr-ci-review.md`](../phases/pr-ci-review.md).

---

## Review execution matrix

Chaque dimension de [`ideal-review.md`](../review/ideal-review.md) est exécutée sous une
des trois formes :

- **Mécanique** : outil déterministe ou script maison.
- **Agentique** : agent de jugement qui retourne `ReviewFinding[]`.
- **Hybride** : ingestion mécanique d'indices puis jugement agentique.

### Mécanique par défaut

- Build / CI / Reproducibility : clean install/build quand possible, lockfile
  consistency, generated-file drift.
- Tests — Substance : mutation ciblée quand disponible, absence d'assertions,
  tests skipped/focused.
- Tests — Coverage : coverage diff, présence de tests pour fichiers touchés.
- Security : secrets scan, SAST, dependency CVEs.
- Compliance / Supply Chain : license scan, SCA, package-health checks.
- Backward Compatibility : OpenAPI diff, protobuf breaking check, public API diff,
  migration/config drift quand applicable.
- Agent Conduct : checks locaux définis par [`agent-conduct-check.md`](../phases/agent-conduct-check.md).

### Agentique par défaut

- Correctness : comportement attendu, edge cases, régressions silencieuses.
- Robustness : crash consistency, idempotence, lifecycle, race assumptions.
- Spec Conformance : alignement sur specs/NIB/contrats.
- Interface : ergonomie API, erreur stable, call sites.
- Observability : capacité de diagnostic réelle.
- Structure : local reasoning, suppression, duplication sémantique.
- Simplicity / Sobriety : sur-abstraction, gold-plating, fausse consistance.
- AI Artifact Detection : APIs hallucinated, commentaires menteurs, docs alignées
  sur du faux code, mauvais idiomes.

---

## Règles de terminaison

La review ne cherche jamais zéro remarque. Elle cherche zéro risque bloquant.

Le pipeline peut avancer vers `commit-push-pr` seulement si :

- tous les checks mécaniques requis sont `passed` ;
- aucun finding `Bloquant` n'est `open` ;
- aucun finding `Majeur` avec `blocksPipeline: true` n'est `open` ;
- tous les `HumanGate` requis ont une décision et une justification ;
- le `trackedWorktreeHash` courant correspond à celui validé par les derniers
  checks et le worktree est `worktreeClean` (voir `phase-harness/`).

Tout fix appliqué invalide les checks précédents et force un retour à
`agent-conduct-check`.

---

## Règles de preuve

Un finding peut bloquer le pipeline seulement s'il contient au moins une preuve :

- sortie d'un outil déterministe ;
- reproduction minimale ;
- citation d'une spec, NIB, ou contrat public ;
- comparaison avant/après ;
- chemin de données ou contrôle démontré ;
- explication d'un invariant durable violé.

Un finding sans preuve peut rester `Mineur` ou `Suggestion`, mais ne peut pas
être `Bloquant`.

---

## Relation avec Turnlock

Turnlock ne connaît pas les règles métier ci-dessus. Il garantit seulement :

- persistance atomique de l'état ;
- reprise exacte après délégation ;
- protocole stdout fermé ;
- validation JSON par les phases ;
- retry/fallback/loop detection mécanique.

Le pipeline `/go` est un consommateur de Turnlock. Ses phases et artefacts sont
des données applicatives, pas des fonctionnalités du runtime.
