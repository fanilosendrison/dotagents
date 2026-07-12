export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = { [key: string]: JsonValue };

export type PhaseInput = {
  runId: string;
  workDir: string;
  artefactDir: string;
  baseSha: string;
  phase: string;
  config?: JsonObject;
};

export type PhaseError = {
  message: string;
  severity: "blocking" | "major" | "minor";
  file?: string;
  line?: number;
  evidenceRef?: string;
};

export type PhaseDraftOutput = {
  status: "passed" | "failed" | "skipped";
  evidenceRefs: string[];
  errors: PhaseError[];
};

export type PhaseOutput = {
  runId: string;
  phase: string;
  status: "passed" | "failed" | "skipped" | "errored";
  artefactDir: string;
  evidenceRefs: string[];
  errors: PhaseError[];
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
};

export type Phase = (input: PhaseInput) => Promise<PhaseDraftOutput>;

export type AbsolutePath = string;
export type EvidenceRef = string;

export type ResolvedPhaseInput = PhaseInput & {
  workDir: AbsolutePath;
  artefactDir: AbsolutePath;
};

export type PreflightResult =
  | { ok: true; input: ResolvedPhaseInput }
  | { ok: false; reason: string };

export type PhaseExecutionResult =
  | { kind: "returned"; draft: unknown }
  | { kind: "threw"; message: string };

export type CanonicalStateSnapshot = {
  headShaAfter: string | null;
  trackedWorktreeHash: string | null;
  worktreeClean: boolean | null;
  errors: PhaseError[];
};

export type ValidatedDraftResult =
  | {
      ok: true;
      draft: PhaseDraftOutput;
      evidenceRefs: EvidenceRef[];
      errors: PhaseError[];
    }
  | {
      ok: false;
      evidenceRefs: EvidenceRef[];
      errors: PhaseError[];
    };

export type AssembledOutputInput = {
  input: ResolvedPhaseInput;
  execution: PhaseExecutionResult;
  canonicalState: CanonicalStateSnapshot;
  validation: ValidatedDraftResult | null;
};

export type AssembleAndNormalizeOutputResult =
  | { ok: true; output: PhaseOutput }
  | { ok: false; reason: string };

export type CreateArtefactDirectoryResult =
  | { ok: true; input: ResolvedPhaseInput }
  | { ok: false; reason: string };

export type WriteCanonicalOutputResult =
  | { ok: true; output: PhaseOutput }
  | { ok: false; reason: string };
