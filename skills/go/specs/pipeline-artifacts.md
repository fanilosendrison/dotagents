# Pipeline Artefacts — Types JSON partagés

Ce document définit les types d'artefacts échangés entre les phases du pipeline
`/go`. Pour les résultats de phase individuelle, la forme obligatoire est
`PhaseOutput` définie dans [`phase-harness/`](./phase-harness/). Les champs
marqués `@deprecated` sont conservés pour migration.

---

## `PipelineState`

État global du run, porté par Turnlock.

```ts
type PipelineState = {
  runId: string;
  repositoryRoot: string;
  currentPhase: string;
  requestedChangeSummary: string;
  workSession?: WorkSession;
  // @deprecated — use trackedWorktreeHash from PhaseOutput (phase-harness/)
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

## `WorkSession`

Enregistré par `workspace-setup`. Voir [`workspace-setup.md`](./workspace-setup.md).

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

## `CheckRun`

Aligné avec `PhaseOutput` de `phase-harness/`. Les champs `@deprecated` sont
conservés pour migration.

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

## `ReviewFinding`

Produit par `pre-pr-review` et `pr-ci-review`. Voir [`ideal-review.md`](./ideal-review.md)
pour les dimensions et sévérités.

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

## `RemediationAttempt`

Traçabilité des corrections appliquées après `review-remediation`.

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

## `PackagePlan`

Plan de découpage du diff en paquets pour `commit-push-pr`.

```ts
type PackagePlan = {
  baseRef: string;
  originalDiffHash: string;
  packages: PackageRecord[];
  reconstructionProof: {
    strategy: "apply-packages-in-dependency-order";
    reconstructedDiffHash: string;
    matchesOriginal: boolean;
  };
};
```

## `PackageRecord`

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

## `CommitRecord`

```ts
type CommitRecord = {
  message: string;
  files: string[];
  reason: string;
  sha?: string;
};
```

## `BranchRecord`

```ts
type BranchRecord = {
  name: string;
  base: string;
  packageIds: string[];
  commitShas: string[];
  pushed: boolean;
};
```

## `PullRequestRecord`

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

## `HumanGate`

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
