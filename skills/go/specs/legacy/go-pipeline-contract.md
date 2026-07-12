# Go Pipeline Contract — FSM, artefacts, gates

Ce document est le contrat central du pipeline `/go`. Il relie les quatre
documents spécialisés :

- `software-design-workflow.md` — architecture générale du pipeline.
- `ideal-review.md` — contenu sémantique de la review du code produit.
- `agent-conduct.md` — conduite de l'agent pendant le travail.
- `commit-push-pr-workflow.md` — découpage Git, branches, push, PR.

Le principe : **Turnlock porte l'état mécanique**, les outils déterministes
produisent des preuves, les agents produisent des artefacts JSON validés, et
l'humain arbitre uniquement les décisions sémantiques irréductibles.

> **Note — Phase Contract**: L'exécution individuelle de chaque phase est
> régie par [`phase-contract.md`](./phase-contract.md), qui définit les types
> canoniques `PhaseInput`, `PhaseDraftOutput`, `PhaseOutput`, `PhaseError` et le
> runner `runPhase()`. Les structures ci-dessous sont des projections d'état
> pipeline ; elles ne remplacent jamais `artefactDir/output.json`, qui reste la
> sortie canonique de phase.

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

Le pipeline utilise exactement les sévérités de `ideal-review.md`.

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

Mapping avec `PhaseError.severity` (`phase-contract.md`) :

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
branche de travail privée.

Responsabilités :

- détecter `repositoryRoot`, `baseBranch`, `baseHeadSha`, et `defaultTargetBranch` ;
- refuser un worktree dirty sauf adoption explicite dans le run ;
- créer `work/<run-id>` depuis `baseHeadSha` ;
- checkout `work/<run-id>` ;
- persister `WorkSession` dans `state.json`.

Cette phase ne produit aucun code applicatif. Elle crée seulement le terrain
contrôlé sur lequel l'agent pourra travailler.

### 2. `implementation`

L'agent principal implémente la demande utilisateur. Cette phase peut lancer ses
propres tests exploratoires, mais ses résultats ne sont pas autoritaires. Elle
travaille sur `work/<run-id>` et produit un diff brut plus un résumé d'intention.

### 3. `agent-conduct-check`

Check déterministe des traces laissées par l'agent : secrets dans commandes,
fichiers temporaires, environnement, staging area, permissions dangereuses,
process debug persistants. Cette phase applique `agent-conduct.md`.

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
`ideal-review.md` puis délègue les dimensions sémantiques à des agents. Elle
produit des findings structurés, pas des modifications directes.

### 8. `review-remediation`

Si des findings `Bloquant` ou des findings `Majeur` avec `blocksPipeline: true`
existent, la FSM demande une décision humaine :

- `apply` : l'agent corrige le batch approuvé, puis retour à `agent-conduct-check`.
- `dismiss` : le finding est marqué faux positif avec justification.
- `defer` : autorisé seulement pour `Majeur` non bloquant, `Mineur`, ou
  `Suggestion`.
- `abort` : arrêt du pipeline.

### 9. `commit-push-pr`

Découpe le diff en paquets logiques, crée les branches dédiées, applique les
paquets, commit, push, et ouvre les PRs. Cette phase applique
`commit-push-pr-workflow.md`, y compris son contrat d'interaction avec
`git-commits-push-enforcer` pour les mutations `git commit`, `git commit-tree`,
et `git push`.

### 10. `pr-ci-review`

Review de PR côté CI. Elle réexécute les gates mécaniques et la review
structurée sur le diff réellement poussé. C'est la gate autoritative de merge.

---

## Artefacts JSON

Les formes ci-dessous sont conceptuelles : l'implémentation peut les encoder en
Zod, JSON Schema, ou types TypeScript. Pour les résultats de phase, la forme
obligatoire est `PhaseOutput` dans `phase-contract.md`. Les champs marqués
`@deprecated` ci-dessous sont optionnels et conservés seulement pour migration.

### `PipelineState`

```ts
type PipelineState = {
  runId: string;
  repositoryRoot: string;
  currentPhase: string;
  requestedChangeSummary: string;
  workSession?: WorkSession;
  // @deprecated — use trackedWorktreeHash from PhaseOutput (phase-contract.md)
  implementationDiffHash?: string;
  checks: CheckRun[];
  findings: ReviewFinding[];
  remediations: RemediationAttempt[];
  packagePlan?: PackagePlan;
  branches: BranchRecord[];
  pullRequests: PullRequestRecord[];
  humanGates: HumanGate[];
};
```

### `WorkSession`

```ts
type WorkSession = {
  runId: string;
  repositoryRoot: string;
  baseBranch: string;
  baseHeadSha: string;
  baseRemote?: string;
  defaultTargetBranch: string;
  initialDirtyState: "clean" | "dirty-adopted";
  initialStatusPorcelain: string;
  workBranch: `work/${string}`;
  workBranchCreatedAt: string;
};
```

### `CheckRun`

```ts
type CheckRun = {
  id: string;
  phase:
    | "workspace-setup"
    | "implementation"
    | "agent-conduct-check"
    | "lint"
    | "typecheck"
    | "tests"
    | "pre-pr-review"
    | "review-remediation"
    | "commit-push-pr"
    | "pr-ci-review"
    | "build-repro"
    | "secret-scan"
    | "license-scan"
    | "supply-chain-scan"
    | "api-compat";
  startedAt: string;
  endedAt: string;
  status: "passed" | "failed" | "skipped" | "errored";
  artefactDir: string;
  evidenceRefs: string[];
  errors: PhaseError[];
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
  // @deprecated — command execution details belong in phase evidence
  command?: string;
  // @deprecated — status now includes skipped and errored; exit code is
  // an implementation detail captured by the harness, not a contract field
  exitCode?: number;
  // @deprecated — PhaseOutput is the canonical output; outputRef will be
  // replaced by artefactDir + output.json
  outputRef?: string;
  // @deprecated — use trackedWorktreeHash from PhaseOutput
  diffHash?: string;
};
```

### `ReviewFinding`

```ts
type ReviewFinding = {
  id: string;
  source: "deterministic-tool" | "review-agent" | "human";
  dimension:
    | "correctness"
    | "robustness"
    | "security"
    | "spec-conformance"
    | "backward-compatibility"
    | "build-ci-reproducibility"
    | "tests-substance"
    | "tests-coverage"
    | "interface"
    | "observability"
    | "structure"
    | "simplicity"
    | "compliance-supply-chain"
    | "ai-artifact-detection"
    | "agent-conduct";
  severity: "Bloquant" | "Majeur" | "Mineur" | "Suggestion";
  blocksPipeline: boolean;
  title: string;
  file?: string;
  line?: number;
  invariantViolated?: string;
  minimalReproduction?: string;
  evidenceRefs: string[];
  recommendedAction: "fix" | "dismiss" | "defer" | "manual-review";
  status: "open" | "fixed" | "dismissed" | "deferred";
};
```

### `RemediationAttempt`

```ts
type RemediationAttempt = {
  id: string;
  findingIds: string[];
  approvedBy: "human" | "policy";
  agentLabel: string;
  beforeTrackedWorktreeHash: string;
  afterTrackedWorktreeHash: string;
  // @deprecated — use beforeTrackedWorktreeHash
  beforeDiffHash?: string;
  // @deprecated — use afterTrackedWorktreeHash
  afterDiffHash?: string;
  result: "changed" | "no-change" | "failed";
  followupCheckIds: string[];
};
```

### `PackagePlan`

```ts
type PackagePlan = {
  baseRef: string;
  // Packaging-only diff fingerprint used to prove split/reconstruction.
  // Mechanical gates use trackedWorktreeHash from PhaseOutput.
  originalDiffHash: string;
  packages: PackageRecord[];
  reconstructionProof: {
    strategy: "apply-packages-in-dependency-order";
    // Packaging-only diff fingerprint, not a replacement for trackedWorktreeHash.
    reconstructedDiffHash: string;
    matchesOriginal: boolean;
  };
};
```

### `PackageRecord`

```ts
type PackageRecord = {
  id: string;
  slug: string;
  kind: "independent" | "depends-on" | "inseparable";
  dependsOn: string[];
  files: string[];
  commitPlan: CommitRecord[];
  branchName: string;
  baseBranchName: string;
};
```

### `CommitRecord`

```ts
type CommitRecord = {
  message: string;
  files: string[];
  reason: string;
  sha?: string;
};
```

### `BranchRecord`

```ts
type BranchRecord = {
  name: string;
  base: string;
  packageIds: string[];
  commitShas: string[];
  pushed: boolean;
};
```

### `PullRequestRecord`

```ts
type PullRequestRecord = {
  number: number;
  url: string;
  headBranch: string;
  baseBranch: string;
  packageIds: string[];
  ciReviewStatus: "pending" | "passed" | "failed";
};
```

### `HumanGate`

```ts
type HumanGate = {
  id: string;
  reason: string;
  findingIds: string[];
  allowedActions: Array<"apply" | "dismiss" | "defer" | "abort">;
  selectedAction?: "apply" | "dismiss" | "defer" | "abort";
  justification?: string;
};
```

---

## Review execution matrix

Chaque dimension de `ideal-review.md` est exécutée sous une des trois formes :

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
- Agent Conduct : checks locaux définis par `agent-conduct.md`.

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
  checks et le worktree est `worktreeClean` (voir `phase-contract.md`).

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
