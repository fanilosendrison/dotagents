# Artefacts JSON du workflow `/go`

Ce document définit les artefacts JSON partagés entre bootstrap tasks, stages et
reviews. Les résultats individuels restent des `StageOutput` produits par le
stage harness quand l'unite passe par ce harness. Les payloads métier durables
sont des artefacts métier typés validés avant projection dans `WorkflowState`.

---

## 1. `RuntimeState` et `WorkflowState`

Payload metier `/go` stocke par Turnlock dans `StateFile<RuntimeState>`.

Turnlock fournit le fichier d'etat durable (`StateFile<State>`). `/go` fournit
la forme de `StateFile.data`.

```ts
type RuntimeState = BootstrapState | WorkflowState;
```

```ts
type BootstrapState = {
  schema: "go.bootstrap-state.v1";
  invocationDirectory: string;
  policy: WorkflowPolicy;
};
```

`BootstrapState` est l'etat initial minimal donne a Turnlock avant
`run-init`. Il contient seulement les inputs parent deja resolus (le CWD). Il ne contient
pas `runId`, car `runId` appartient a `StateFile.runId`, ni `runInit`, car
`run-init` ne l'a pas encore produit.

```ts
type WorkflowState = {
  schema: "go.workflow-state.v1";
  runId: string;
  runInit: RunInitRecord;
  policy: WorkflowPolicy;
  repository: RepositoryContext;
  currentStage: WorkflowStage | null;
  bootstrapTasks: BootstrapTaskRecord[];
  runCapture?: RunCaptureArtifact;
  repositoryDiscoveryDraft?: RepositoryDiscoveryDraft;
  workSession?: WorkSession;
  projectDiscovery?: ProjectDiscovery;
  snapshots: ChangeSnapshot[];
  executionRecords: WorkflowExecutionRecord[];
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

`WorkflowState` existe seulement apres le snapshot stable emis par `run-init`.
Toutes les bootstrap tasks internes projetees par `run-init` et tous les stages
apres la delegation `implementation` exigent `WorkflowState`; seul `run-init`
accepte `BootstrapState`.

`currentStage` represente le chemin metier principal. Il vaut `null` tant que
le run est encore dans le noyau bootstrap, puis peut valoir `"implementation"`
pendant que Turnlock attend le resultat de la delegation du meme nom.

`policy` est un snapshot durable des decisions d'autorisation et de securite du
run. Les docs peuvent dire "selon policy" seulement si la decision correspond a
un champ de `WorkflowPolicy`.

Les bootstrap tasks sont representees par `bootstrapTasks` et leurs artefacts
metier. Elles sont executees comme sous-taches de `run-init`, puis projetees
dans le `WorkflowState` donne a Turnlock avec la delegation `implementation`.

---

## 2. Startup tasks, stages et états

```ts
type BootstrapTaskName =
  | "provider-config-validation"
  | "repo-capture"
  | "dirty-state-capture"
  | "run-capture"
  | "repo-discovery-draft"
  | "workspace-setup"
  | "project-discovery-finalize";
```

```ts
type WorkflowStage =
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

`implementation-settlement` n'est pas un `WorkflowStage`. C'est une phase
Turnlock de reprise qui consomme le resultat de la delegation
`implementation`, valide les evidences et route vers le prochain stage
mecanique.

```ts
type WorkflowUnitName = BootstrapTaskName | WorkflowStage;
```

```ts
type RunInitRecord = {
  schema: "go.run-init.v1";
  runId: string;
  RepoCapture: RepoCapture;
  repoCaptureHash: string;
  workflowPolicyHash: string;
  turnlockRun: TurnlockRunRef;
  artefactRootRef: string;
  workflowLogRootRef?: string;
  workspaceRootReservedPath: string;
  ownershipMarkerRef: string;
  initializedAt: string;
  dirtyStateDiff?: DirtyStateDiffArtifact;
};
```

> **Alias rétrocompatible :** `worktreeRootReservedPath` est conservé
> comme alias déprécié optionnel pour `workspaceRootReservedPath`. Un
> producteur écrit `workspaceRootReservedPath` ; un consommateur lit
> `workspaceRootReservedPath` avec fallback sur `worktreeRootReservedPath`.

```ts
type RepoCapture = {
  schema: "go.repo-capture.v1";
  invocationDirectory: string;
  canonicalRepositoryRoot: string;
  projectRoot?: string;
  symlinkResolved: boolean;
  resolvedAt: string;
};
```

`RepoCapture` est produit par `run-init` depuis le `invocationDirectory` fourni dans le
`BootstrapState`. `run-init` le stocke sans discovery Git complète.
`workspace-setup` le verifie ensuite contre l'etat Git reel.

```ts
type TurnlockRunRef = {
  runId: string;
  runDirRef: string;
  stateFileRef: string;
  eventsRef?: string;
};
```

`TurnlockRunRef` reference l'enveloppe runtime creee par Turnlock. `/go` ne
definit pas le lock runtime, le schema de `StateFile`, ni l'ecriture atomique de
`state.json`.

```ts
type RunInitOwnershipMarker = {
  schema: "go.run-init-ownership.v1";
  runId: string;
  turnlockRun: TurnlockRunRef;
  artefactRootRef: string;
  workflowLogRootRef?: string;
  workspaceRootReservedPath: string;
  repoCaptureHash: string;
  workflowPolicyHash: string;
  createdAt: string;
};
```

`RunInitOwnershipMarker` est une evidence d'idempotence. Elle permet a un retry
de distinguer une reference deja creee par le meme run d'un chemin occupe par un
autre run ou par un etat inconnu.

Le marker embarque le `TurnlockRunRef` complet, pas seulement `runId`, afin de
prouver quel `runDir`, `stateFileRef` et `eventsRef` sont lies aux refs reservees
par `run-init`. C'est necessaire pour adopter prudemment une ref locale ou
distante deja existante lors d'un retry.

`/go` n'a pas de `runSlug` separe. Le `runId` stocke ici est le `runId`
Turnlock nominal au format ULID, et il est directement utilisable dans les
chemins locaux, refs Git et prefixes distants du workflow. Un `--run-id`
externe non conforme doit etre refuse avant creation de `runDir`, au lieu
d'etre transforme en identifiant derive.

`RunInitOwnershipMarker.createdAt` doit etre identique a
`RunInitRecord.initializedAt`. Un timestamp physique d'ecriture du marker, si
necessaire, appartient aux metadata d'evidence non autoritatives.

```ts
type BootstrapTaskRecord = {
  task: BootstrapTaskName;
  status:
    | "not-started"
    | "running"
    | "passed"
    | "failed"
    | "errored"
    | "cancelled";
  startedAt?: string;
  endedAt?: string;
  checkpointRef?: string;
  executionRecordId?: string;
  businessArtifactIds: string[];
  requiredBefore: WorkflowUnitName[];
};
```

```ts
type BootstrapTaskCheckpoint = {
  schema: "go.startup-task-checkpoint.v1";
  runId: string;
  task: BootstrapTaskName;
  status: "passed" | "failed" | "errored" | "cancelled";
  inputHash: string;
  repoCaptureHash: string;
  workflowPolicyHash: string;
  businessArtifactIds: string[];
  evidenceRefs: string[];
  startedAt: string;
  endedAt: string;
};
```

`BootstrapTaskCheckpoint` est ecrit atomiquement sous
`artefactRoot/startup/<task>/task-record.json`. Il sert a `run-init` pour
adopter, relancer, annuler ou refuser une bootstrap task au retry. Il ne remplace
pas `StateFile<RuntimeState>`.

```ts
type WorkflowExecutionRecord = {
  id: string;
  unit: WorkflowUnitName;
  envelopeKind: "stage-output" | "startup-output" | "turnlock-transition";
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

`WorkflowExecutionRecord` est l'enveloppe durable d'une workflow unit. Pour un
stage execute via le stage harness, `envelopeKind` vaut `"stage-output"` et
`outputJsonPath` pointe vers le `StageOutput` canonique. Pour une bootstrap task
qui n'est pas un stage, le record garde le meme role d'audit sans la renommer en
stage.

```ts
type TurnlockStateRecord = {
  id: string;
  unit: WorkflowUnitName;
  stateName: string;
  startedAt: string;
  endedAt?: string;
  status: "running" | "passed" | "failed" | "errored" | "waiting";
  evidenceRefs: string[];
  businessArtifactIds: string[];
};
```

---

## 3. Policy durable du run

```ts
type WorkflowPolicy = {
  schema: "go.workflow-policy.v1";
  dirtyState: DirtyStatePolicy;
  discovery: DiscoveryPolicy;
  gates: GatePolicy;
  delegation: DelegationPolicy;
  review: ReviewPolicy;
  packaging: PackagingPolicy;
  retention: RetentionPolicy;
};
```

```ts
type DirtyStatePolicy = {
  mode: "require-clean" | "adopt-as-input" | "human-gate-if-dirty";
  adoptionRequiresPatchEvidence: boolean;
  adoptionRequiresWorkspaceReplay: boolean;
};
```

```ts
type DiscoveryPolicy = {
  allowSourceCheckoutDraft: boolean;
  allowWorkspaceRerun: boolean;
  noReliableGateBehavior: "fail" | "human-gate" | "allow-with-evidence";
};
```

```ts
type GatePolicy = {
  requiredKinds: Array<
    | "format"
    | "lint"
    | "typecheck"
    | "tests"
    | "build"
    | "security"
    | "generated-drift"
    | "api-compat"
  >;
  allowOptionalGateFailure: boolean;
};
```

```ts
type DelegationPolicy = {
  implementationBlockedBehavior: "human-gate" | "fail";
  allowAutomaticRemediation: boolean;
  remediationApproval: "policy" | "human";
};
```

```ts
type ReviewPolicy = {
  requireRunCaptureForPrePackageReview: true;
  requireRunCaptureForPrCiReview: true;
  unclearIntentBehavior: "fail" | "human-gate";
  blockingMajorFindingBehavior: "human-gate" | "fail";
};
```

```ts
type PackagingPolicy = {
  requireCleanWorkspaceForPackaging: boolean;
  allowPublishPr: boolean;
  requirePackageReconstructionProof: boolean;
};
```

```ts
type RetentionPolicy = {
  incompleteRunBehavior: "resume" | "quarantine" | "manual-cleanup";
  staleRuntimeLockBehavior: "turnlock-policy";
};
```

`WorkflowPolicy` est resolue par le parent process ou par la configuration du
workflow avant `run-init`, puis stockee par `run-init`. Les bootstrap tasks et
stages ne doivent pas inventer de policy locale.

---

## 4. Capture, discovery et repository

```ts
type RunCaptureArtifact = {
  schema: "go.run-capture.v1";
  id: string;
  runId: string;
  sessionRef: string;
  sessionExcerptRef: string;
  promptAtGoRef: string;
  promptHash: string;
  excerptHash: string;
  capturedAt: string;
};
```

`RunCaptureArtifact` est mecanique. Il ne contient pas de resume,
contraintes, criteres d'acceptation ou specs applicables deduits par LLM.
`promptHash` et `excerptHash` sont des hashes de contenu
`sha256:<lowercase-hex>` calcules sur les octets exacts des fichiers
referencés, pas des hashes JSON JCS.

```ts
type DirtyStateDiffArtifact = {
  schema: "go.dirty-state-diff.v1";
  runId: string;
  capturedAt: string;
  initialDirtyState: "clean" | "dirty";
  sourceStatusPorcelainRef?: string;
  sourcePatchRef?: string;
  sourcePatchHash?: string;
};
```

`DirtyStateDiffArtifact` est produit par la bootstrap task
`dirty-state-capture`. Si `initialDirtyState` vaut `"clean"`, les champs
`sourceStatusPorcelainRef`, `sourcePatchRef` et `sourcePatchHash` sont
absents.

```ts
type RepositoryDiscoveryDraft = {
  schema: "go.repository-discovery-draft.v1";
  id: string;
  runId: string;
  sourceRepo: string;
  inspectedAt: string;
  inspectedFiles: InspectedFileRef[];
  candidatePackageManager?:
    | "bun"
    | "npm"
    | "pnpm"
    | "yarn"
    | "cargo"
    | "go"
    | "python"
    | "unknown";
  candidateLockfiles: string[];
  candidateCommands: CandidateMechanicalCommand[];
  providerCapabilities: ProviderCapabilities;
};
```

```ts
type InspectedFileRef = {
  path: string;
  hash: string;
  requiredForFinalization: boolean;
};
```

`InspectedFileRef.hash` est un hash de contenu de fichier
`sha256:<lowercase-hex>`. Il ne passe pas par la canonicalisation JSON JCS.

```ts
type CandidateMechanicalCommand = {
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
  discoveredFrom: string;
  requiredCandidate: boolean;
};
```

```ts
type RepositoryContext = {
  repositoryRoot: string;
  projectRoot?: string;
  workspaceProjectRoot?: string;
  /** @deprecated use workspaceProjectRoot */
  worktreeProjectRoot?: string;
  provider?: "github" | "gitlab" | "local-only";
  remoteName?: string;
  defaultTargetBranch: string;
  apiEndpoint?: string;
};
```

`RepositoryContext` est initialise depuis `RepoCapture`, puis
verifie par `workspace-setup`.

---

## 5. `WorkSession`

Produit par la bootstrap task `workspace-setup`.

```ts
type WorkSession = {
  runId: string;
  repositoryRoot: string;
  sourceRepo?: string;
  workspaceRoot: string;
  workspaceProjectRoot?: string;
  artefactRoot: string;
  baseBranch: string;
  baseHeadSha: string;
  baseRemote?: string;
  defaultTargetBranch: string;
  dirtyStateDiffAdoption?: DirtyStateDiffAdoption;
  workBranch: `work/${string}`;
  workBranchCreatedAt: string;
};
```

> **Alias rétrocompatibles :** `worktreeRoot`, `worktreeProjectRoot`,
> `worktreeRootReservedPath`, `adoptionRequiresWorktreeReplay`,
> `allowWorktreeRerun`, `requireCleanWorktreeForPackaging`,
> `finalizedAgainstWorktreeRoot`, `"worktree-rerun"` (valeur d'enum),
> `replayedIntoWorktree`, et `worktreeStatusAfterReplayRef` sont
> conservés comme alias dépréciés pour leurs équivalents agnostiques
> (`workspaceRoot`, `workspaceProjectRoot`, `workspaceRootReservedPath`,
> `adoptionRequiresWorkspaceReplay`, `allowWorkspaceRerun`,
> `requireCleanWorkspaceForPackaging`,
> `finalizedAgainstWorkspaceRoot`, `"workspace-rerun"`,
> `replayedIntoWorkspace`, `workspaceStatusAfterReplayRef`).
> `sourceRepo` est optionnel (obligatoire en
> stratégie worktree, absent en stratégie sandbox). Voir
> [ADR-go-workspace-agnostic-terminology.md](../../adr/ADR-go-workspace-agnostic-terminology.md).

`workspaceRoot` est un checkout physique privé. `artefactRoot` est hors du
workspace.

```ts
type DirtyStateDiffAdoption = {
  captureArtifactId: string;
  replayedIntoWorkspace: boolean;
  workspaceStatusAfterReplayRef: string;
};
```

`DirtyStateDiffAdoption` référence le `DirtyStateDiffArtifact` via
`captureArtifactId`. Les détails de provenance (status porcelain d'origine,
patch binaire, hash du diff) sont accessibles via le
`DirtyStateDiffArtifact` projeté dans
`RunInitRecord.dirtyStateDiff`.

---

## 6. `ProjectDiscovery`

Produit par le bootstrap join `project-discovery-finalize` apres finalisation
contre le worktree prive.

```ts
type ProjectDiscovery = {
  source: "draft-finalized" | "workspace-rerun";
  finalizedFromDraftId?: string;
  finalizedAgainstWorkspaceRoot: string;
  inspectedFiles: InspectedFileRef[];
  packageManager?:
    | "bun"
    | "npm"
    | "pnpm"
    | "yarn"
    | "cargo"
    | "go"
    | "python"
    | "unknown";
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

## 7. `WorkflowExecutionRecord`

Projection d'une enveloppe d'execution dans l'etat global.

```ts
type WorkflowExecutionRecord = {
  // Defined in section 2.
};
```

Schéma Zod de validation (utilisé par `run-init` avant projection) :

```ts
export const workflowExecutionRecordSchema = z.object({
  id: z.string().min(1),
  unit: z.string().min(1),
  envelopeKind: z.enum(["stage-output", "startup-output", "turnlock-transition"]),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  artefactDir: z.string().min(1),
  outputJsonPath: z.string().min(1),
  status: z.enum(["passed", "failed", "skipped", "errored"]),
  evidenceRefs: z.array(z.string()),
  businessArtifactIds: z.array(z.string()),
  errors: z.array(stageErrorSchema),
  headShaAfter: z.nullable(z.string()),
  trackedWorktreeHash: z.nullable(z.string()),
  worktreeClean: z.nullable(z.boolean()),
}).strict();
```

Un `WorkflowExecutionRecord` peut pointer vers un `StageOutput` canonique, mais
il peut aussi representer une bootstrap task ou une transition Turnlock apres
`run-init`. La transition bootstrap `run-init` est l'exception : elle est
prouvee par `RunInitRecord`, `RunInitOwnershipMarker` et la transition stable
Turnlock qui remplace `BootstrapState` par `WorkflowState`.

---

## 8. `BusinessArtifactRecord`

Projection d'un artefact métier typé validé dans l'état global.

```ts
type BusinessArtifactRecord = {
  id: string;
  unit: WorkflowUnitName;
  kind: BusinessArtifactKind;
  schema: string;
  ref: string;
  executionRecordId: string;
  stageOutputId?: string;
  validationStatus: "passed" | "failed" | "errored";
};
```

```ts
type BusinessArtifactKind =
  | "provider-config-validation"
  | "repo-capture"
  | "dirty-state-capture"
  | "run-capture"
  | "repository-discovery-draft"
  | "work-session"
  | "project-discovery"
  | "implementation-evidence"
  | "change-snapshot"
  | "conduct-evidence"
  | "review-findings"
  | "review-report"
  | "mechanical-check-results"
  | "remediation-attempt"
  | "package-plan"
  | "package-verification"
  | "pull-request-publication"
  | "pr-ci-review";
```

Un artefact métier typé est toujours référencé par `ref`, validé par son
`schema`, puis projeté dans le champ spécialisé de `WorkflowState` quand le
schéma le permet.

`executionRecordId` est obligatoire pour relier l'artefact a l'execution qui l'a
produit. `stageOutputId` est present seulement si cette execution a produit un
`StageOutput` du stage harness.

Schéma Zod de validation :

```ts
export const businessArtifactRecordSchema = z.object({
  id: z.string().min(1),
  unit: z.string().min(1),
  kind: z.enum([
    "provider-config-validation",
    "repo-capture",
    "run-capture",
    "repository-discovery-draft",
    "work-session",
    "project-discovery",
    "implementation-evidence",
    "change-snapshot",
    "conduct-evidence",
    "review-findings",
    "review-report",
    "mechanical-check-results",
    "remediation-attempt",
    "package-plan",
    "package-verification",
    "pull-request-publication",
    "pr-ci-review"
  ]),
  schema: z.string().min(1),
  ref: z.string().min(1),
  executionRecordId: z.string().min(1),
  stageOutputId: z.string().optional(),
  validationStatus: z.enum(["passed", "failed", "errored"]),
}).strict();
```

---

## 9. `ChangeSnapshot`

Produit après toute mutation agentique ou Git significative.

```ts
type ChangeSnapshot = {
  id: string;
  stage: WorkflowStage;
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

## 10. `CheckRun`

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

## 11. `ReviewFinding`

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
    | "intent-conformance"
    | "robustness"
    | "security"
    | "spec-conformance"
    | "scope-control"
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
  blocksWorkflow: boolean;
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

```ts
type ReviewReportArtifact = {
  schema: "go.review-report.v1";
  id: string;
  stage: "pre-package-review" | "pr-ci-review";
  stageOutputId: string;
  runCaptureId: string;
  reviewedSnapshotId?: string;
  reviewedPullRequestNumber?: number;
  intentCoverage: IntentCoverageRecord[];
  specConformance: SpecConformanceRecord[];
  scopeAssessment: ScopeAssessment;
  engineeringAssessment: EngineeringAssessment;
  findingArtifactId: string;
  narrativeSummaryRef: string;
};
```

```ts
type IntentCoverageRecord = {
  requirement: string;
  sourceRef: string;
  status:
    | "satisfied"
    | "partially-satisfied"
    | "missing"
    | "not-applicable"
    | "unclear";
  evidenceRefs: string[];
};
```

```ts
type SpecConformanceRecord = {
  specRef: string;
  status: "conformant" | "violated" | "not-applicable" | "unclear";
  evidenceRefs: string[];
};
```

```ts
type ScopeAssessment = {
  unexpectedChanges: string[];
  missingExpectedChanges: string[];
  explicitNonGoalsRespected: boolean | "unclear";
  evidenceRefs: string[];
};
```

```ts
type EngineeringAssessment = {
  correctness: "passed" | "failed" | "unclear";
  robustness: "passed" | "failed" | "unclear";
  compatibility: "passed" | "failed" | "unclear";
  tests: "substantive" | "insufficient" | "not-applicable" | "unclear";
  evidenceRefs: string[];
};
```

`ReviewFinding` ne dérive pas de `StageError`. Un finding est une décision
métier avec cycle de vie. Une `StageError` est un diagnostic d'exécution figé
dans le `StageOutput`.

---

## 12. `HumanGate`

```ts
type HumanGate = {
  id: string;
  stage: WorkflowStage;
  reason: string;
  findingIds: string[];
  allowedActions: Array<"apply" | "dismiss" | "defer" | "abort">;
  selectedAction?: "apply" | "dismiss" | "defer" | "abort";
  justification?: string;
  decidedAt?: string;
};
```

---

## 13. `RemediationAttempt`

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

## 14. `PackagePlan`

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

## 15. `PackageVerification`

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

## 16. Branches, commits, PRs

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
