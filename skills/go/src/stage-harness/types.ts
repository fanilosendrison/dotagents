export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type StageInput = {
  runId: string;
  workDir: string;
  artefactDir: string;
  baseSha: string;
  stage: string;
  config?: JsonObject;
};

export type StageError = {
  message: string;
  severity: "blocking" | "major" | "minor";
  file?: string;
  line?: number;
  evidenceRef?: string;
};

export type StageDraftOutput = {
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[];
  errors: StageError[];
};

export type StageOutput = {
  runId: string;
  stage: string;
  status: "passed" | "failed" | "skipped" | "errored";
  artefactDir: string;
  evidenceRefs: string[];
  errors: StageError[];
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
};

export type Stage = (input: StageInput) => Promise<StageDraftOutput>;

export type AbsolutePath = string;
export type EvidenceRef = string;

export type ResolvedStageInput = StageInput & {
  workDir: AbsolutePath;
  artefactDir: AbsolutePath;
};

export type PreflightResult =
  | { ok: true; input: ResolvedStageInput }
  | { ok: false; reason: string };

export type StageExecutionResult =
  | { kind: "returned"; draft: unknown }
  | { kind: "threw"; message: string };

export type CanonicalStateSnapshot = {
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
  errors: StageError[];
};

export type ValidatedDraftResult =
  | {
      ok: true;
      draft: StageDraftOutput;
      evidenceRefs: EvidenceRef[];
      errors: StageError[];
    }
  | {
      ok: false;
      evidenceRefs: EvidenceRef[];
      errors: StageError[];
    };

export type AssembledOutputInput = {
  input: ResolvedStageInput;
  execution: StageExecutionResult;
  canonicalState: CanonicalStateSnapshot;
  validation: ValidatedDraftResult | null;
};

export type AssembleAndNormalizeOutputResult =
  | { ok: true; output: StageOutput }
  | { ok: false; reason: string };

export type CreateArtefactDirectoryResult =
  | { ok: true; input: ResolvedStageInput }
  | { ok: false; reason: string };

export type WriteCanonicalOutputResult =
  | { ok: true; output: StageOutput }
  | { ok: false; reason: string };
