# Artefacts JSON du workflow `/go`

Ce document définit les artefacts JSON partagés entre stages. Les
résultats individuels de stage restent des `StageOutput` produits par le stage
harness. Les payloads métier durables sont des artefacts métier typés validés
avant projection dans `PipelineState`.

---

## 1. `PipelineState`

État global du run, porté par Turnlock.

```ts
type PipelineState = {
  runId: string;
  requestedChange: RequestedChange;
  repository: RepositoryContext;
  currentStage: PipelineStage;
  currentTurnlockState: string;
  workSession?: WorkSession;
  projectDiscovery?: ProjectDiscovery;
  snapshots: ChangeSnapshot[];
  stageOutputs: StageOutputRecord[];
  businessArtifacts: BusinessArtifactRecord[];
  checks: CheckRun[];
  findings: ReviewFinding[];
  humanGates: HumanGate[];
  remediations: RemediationAttempt[];
  packagePlan?: PackagePlan;
  packageVerification?: PackageVerification;
  branches: BranchRecord[];
  commits: CommitRecord[];
  pullRequests: PullRequestRecord[];
  mergeTracking: MergeTrackingRecord[];
};
```

---

## 2. Stages et états

```ts
type PipelineStage =
  | "intake"
  | "workspace-setup"
  | "project-discovery"
  | "implementation"
  | "change-snapshot"
  | "conduct-settled"
  | "mechanical-gates"
  | "pre-package-review"
  | "review-remediation"
  | "final-change-snapshot"
  | "package-plan"
  | "package-verify"
  | "branch-materialize"
  | "commit-package"
  | "publish-pr"
  | "pr-ci-review"
  | "post-merge-tracking";
```

```ts
type TurnlockStateRecord = {
  id: string;
  stage: PipelineStage;
  stateName: string;
  startedAt: string;
  endedAt?: string;
  status: "running" | "passed" | "failed" | "errored" | "waiting";
  evidenceRefs: string[];
  businessArtifactIds: string[];
};
```

---

## 3. Demande et repository

```ts
type RequestedChange = {
  summary: string;
  promptRef?: string;
  specRefs: string[];
  acceptanceCriteria: string[];
  constraints: string[];
};
```

```ts
type RepositoryContext = {
  repositoryRoot: string;
  provider?: "github" | "gitlab" | "local-only";
  remoteName?: string;
  defaultTargetBranch: string;
};
```

---

## 4. `WorkSession`

Produit par `workspace-setup`.

```ts
type WorkSession = {
  runId: string;
  repositoryRoot: string;
  sourceCheckoutRoot: string;
  worktreeRoot: string;
  artefactRoot: string;
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

`worktreeRoot` est un checkout physique privé. `artefactRoot` est hors du
worktree.

---

## 5. `ProjectDiscovery`

Produit par `project-discovery`.

```ts
type ProjectDiscovery = {
  packageManager?: "bun" | "npm" | "pnpm" | "yarn" | "cargo" | "go" | "python" | "unknown";
  lockfiles: string[];
  checkCommands: MechanicalCheckDefinition[];
  testCommands: MechanicalCheckDefinition[];
  buildCommands: MechanicalCheckDefinition[];
  providerCapabilities: ProviderCapabilities;
};
```

```ts
type MechanicalCheckDefinition = {
  id: string;
  kind:
    | "format"
    | "lint"
    | "typecheck"
    | "tests"
    | "build"
    | "security"
    | "generated-drift"
    | "api-compat"
    | "custom";
  command: string[];
  required: boolean;
  workingDirectory: string;
};
```

```ts
type ProviderCapabilities = {
  canPushBranches: boolean;
  canOpenPullRequests: boolean;
  canReadCiStatus: boolean;
  supportsStackedPrs: boolean;
};
```

---

## 6. `StageOutputRecord`

Projection d'un `StageOutput` dans l'état global.

```ts
type StageOutputRecord = {
  id: string;
  stage: PipelineStage;
  stage: string;
  startedAt: string;
  endedAt: string;
  artefactDir: string;
  outputJsonPath: string;
  status: "passed" | "failed" | "skipped" | "errored";
  evidenceRefs: string[];
  businessArtifactIds: string[];
  errors: StageError[];
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
};
```

---

## 7. `BusinessArtifactRecord`

Projection d'un artefact métier typé validé dans l'état global.

```ts
type BusinessArtifactRecord = {
  id: string;
  stage: PipelineStage;
  kind: BusinessArtifactKind;
  schema: string;
  ref: string;
  stageOutputId: string;
  validationStatus: "passed" | "failed" | "errored";
};
```

```ts
type BusinessArtifactKind =
  | "requested-change"
  | "work-session"
  | "project-discovery"
  | "implementation-evidence"
  | "change-snapshot"
  | "conduct-evidence"
  | "review-findings"
  | "mechanical-check-results"
  | "remediation-attempt"
  | "package-plan"
  | "package-verification"
  | "pull-request-publication"
  | "pr-ci-review";
```

Un artefact métier typé est toujours référencé par `ref`, validé par son
`schema`, puis projeté dans le champ spécialisé de `PipelineState` quand le
schéma le permet.

---

## 8. `ChangeSnapshot`

Produit après toute mutation agentique ou Git significative.

```ts
type ChangeSnapshot = {
  id: string;
  stage: PipelineStage;
  source: "implementation" | "remediation" | "packaging" | "pr-ci" | "manual";
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
  changedFiles: ChangedFile[];
  diffSummaryRef: string;
  createdAt: string;
};
```

```ts
type ChangedFile = {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed" | "copied" | "type-changed";
  previousPath?: string;
};
```

---

## 9. `CheckRun`

Résultat d'un check mécanique dans `mechanical-gates` ou `pr-ci-review`.

```ts
type CheckRun = {
  id: string;
  definitionId: string;
  stage: "mechanical-gates" | "pr-ci-review" | "package-verify";
  kind:
    | "format"
    | "lint"
    | "typecheck"
    | "tests"
    | "build"
    | "security"
    | "generated-drift"
    | "api-compat"
    | "package-reconstruction"
    | "custom";
  status: "passed" | "failed" | "skipped" | "errored";
  stageOutputId: string;
  trackedWorktreeHash: string | null;
  evidenceRefs: string[];
};
```

---

## 10. `ReviewFinding`

Produit par les stages de jugement structuré.

```ts
type ReviewFinding = {
  id: string;
  source: "deterministic-tool" | "review-agent" | "human";
  stage:
    | "conduct-settled"
    | "pre-package-review"
    | "package-verify"
    | "pr-ci-review";
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
    | "agent-conduct"
    | "packaging";
  severity: "Critical" | "Major" | "Minor" | "Notable";
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

```ts
type ReviewFindingsArtifact = {
  schema: "go.review-findings.v1";
  id: string;
  stage:
    | "conduct-settled"
    | "pre-package-review"
    | "package-verify"
    | "pr-ci-review";
  stageOutputId: string;
  findings: ReviewFinding[];
};
```

`ReviewFinding` ne dérive pas de `StageError`. Un finding est une décision
métier avec cycle de vie. Une `StageError` est un diagnostic d'exécution figé
dans le `StageOutput`.

---

## 11. `HumanGate`

```ts
type HumanGate = {
  id: string;
  stage: PipelineStage;
  reason: string;
  findingIds: string[];
  allowedActions: Array<"apply" | "dismiss" | "defer" | "abort">;
  selectedAction?: "apply" | "dismiss" | "defer" | "abort";
  justification?: string;
  decidedAt?: string;
};
```

---

## 12. `RemediationAttempt`

```ts
type RemediationAttempt = {
  id: string;
  findingIds: string[];
  approvedBy: "human" | "policy";
  agentLabel: string;
  beforeSnapshotId: string;
  afterSnapshotId?: string;
  beforeTrackedWorktreeHash: string;
  afterTrackedWorktreeHash?: string;
  result: "changed" | "no-change" | "failed";
  followupCheckIds: string[];
};
```

---

## 13. `PackagePlan`

```ts
type PackagePlan = {
  id: string;
  finalSnapshotId: string;
  baseRef: string;
  originalDiffHash: string;
  packages: PackageRecord[];
  reconstructionProof: {
    strategy: "apply-packages-in-dependency-order";
    reconstructedDiffHash?: string;
    matchesOriginal?: boolean;
  };
};
```

```ts
type PackageRecord = {
  id: string;
  slug: string;
  kind: "independent" | "depends-on" | "inseparable";
  dependsOn: string[];
  files: string[];
  branchName: `pr/${string}/${string}`;
  baseBranchName: string;
  commitPlan: CommitPlanRecord[];
};
```

```ts
type CommitPlanRecord = {
  id: string;
  message: string;
  files: string[];
  reason: string;
};
```

---

## 14. `PackageVerification`

```ts
type PackageVerification = {
  packagePlanId: string;
  status: "passed" | "failed" | "errored";
  reconstructedDiffHash: string | null;
  matchesOriginal: boolean;
  packageResults: PackageVerificationResult[];
  reviewFindingsArtifactId?: string;
};
```

```ts
type PackageVerificationResult = {
  packageId: string;
  branchName: string;
  status: "passed" | "failed" | "errored";
  checkRunIds: string[];
  evidenceRefs: string[];
};
```

---

## 15. Branches, commits, PRs

```ts
type BranchRecord = {
  name: string;
  base: string;
  packageIds: string[];
  commitShas: string[];
  pushed: boolean;
};
```

```ts
type CommitRecord = {
  sha: string;
  packageId: string;
  message: string;
  files: string[];
  createdBy: "trusted-git-mutation";
};
```

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

```ts
type MergeTrackingRecord = {
  pullRequestNumber: number;
  status: "open" | "merged" | "closed" | "needs-rebase" | "abandoned";
  mergeSha?: string;
  retargetedFrom?: string;
  retargetedTo?: string;
};
```

---

VegaCorp - `/go` Workflow - "Reliability precedes intelligence."
