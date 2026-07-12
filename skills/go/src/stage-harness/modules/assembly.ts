import { stageOutputSchema } from "../schemas.ts";
import type {
  AssembleAndNormalizeOutputResult,
  AssembledOutputInput,
  StageError,
  StageOutput,
} from "../types.ts";

export function assembleAndNormalizeOutput(
  input: AssembledOutputInput,
): AssembleAndNormalizeOutputResult {
  const harnessErrors: StageError[] = [...input.canonicalState.errors];
  const stageErrors: StageError[] = [];

  if (input.execution.kind === "threw") {
    harnessErrors.push({
      message: `Stage threw: ${input.execution.message}`,
      severity: "blocking",
    });
  }

  if (input.validation === null) {
    harnessErrors.push({
      message: "Internal harness error: validation was not executed",
      severity: "blocking",
    });
  } else if (!input.validation.ok) {
    harnessErrors.push(...input.validation.errors);
  } else {
    stageErrors.push(...input.validation.errors);
  }

  const evidenceRefs = input.validation?.evidenceRefs ?? [];
  const status =
    harnessErrors.some((error) => error.severity === "blocking") ||
    input.validation === null ||
    input.validation.ok === false
      ? "errored"
      : input.validation.draft.status;

  const candidate: StageOutput = {
    runId: input.input.runId,
    stage: input.input.stage,
    status,
    artefactDir: input.input.artefactDir,
    evidenceRefs,
    errors: [...harnessErrors, ...stageErrors],
    headShaAfter: input.canonicalState.headShaAfter,
    trackedWorktreeHash: input.canonicalState.trackedWorktreeHash,
    worktreeClean: input.canonicalState.worktreeClean,
  };

  const parsed = stageOutputSchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, output: parsed.data };
  }

  const normalized: StageOutput = {
    ...candidate,
    status: "errored",
    errors: [
      ...candidate.errors,
      {
        message: "StageOutput schema validation failed during assembly",
        severity: "blocking",
      },
    ],
  };
  if (!hasBlockingError(normalized.errors)) {
    normalized.errors.push({
      message: "StageOutput normalization required a blocking error",
      severity: "blocking",
    });
  }

  const normalizedParsed = stageOutputSchema.safeParse(normalized);
  if (!normalizedParsed.success) {
    return { ok: false, reason: "StageOutput normalization failed" };
  }
  return { ok: true, output: normalizedParsed.data };
}

function hasBlockingError(errors: StageError[]): boolean {
  return errors.some((error) => error.severity === "blocking");
}
