import { phaseOutputSchema } from "../schemas.ts";
import type {
  AssembleAndNormalizeOutputResult,
  AssembledOutputInput,
  PhaseError,
  PhaseOutput,
} from "../types.ts";

export function assembleAndNormalizeOutput(
  input: AssembledOutputInput,
): AssembleAndNormalizeOutputResult {
  const harnessErrors: PhaseError[] = [...input.canonicalState.errors];
  const phaseErrors: PhaseError[] = [];

  if (input.execution.kind === "threw") {
    harnessErrors.push({
      message: `Phase threw: ${input.execution.message}`,
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
    phaseErrors.push(...input.validation.errors);
  }

  const evidenceRefs = input.validation?.evidenceRefs ?? [];
  const status =
    harnessErrors.some((error) => error.severity === "blocking") ||
    input.validation === null ||
    input.validation.ok === false
      ? "errored"
      : input.validation.draft.status;

  const candidate: PhaseOutput = {
    runId: input.input.runId,
    phase: input.input.phase,
    status,
    artefactDir: input.input.artefactDir,
    evidenceRefs,
    errors: [...harnessErrors, ...phaseErrors],
    headShaAfter: input.canonicalState.headShaAfter,
    trackedWorktreeHash: input.canonicalState.trackedWorktreeHash,
    worktreeClean: input.canonicalState.worktreeClean,
  };

  const parsed = phaseOutputSchema.safeParse(candidate);
  if (parsed.success) {
    return { ok: true, output: parsed.data };
  }

  const normalized: PhaseOutput = {
    ...candidate,
    status: "errored",
    errors: [
      ...candidate.errors,
      {
        message: "PhaseOutput schema validation failed during assembly",
        severity: "blocking",
      },
    ],
  };
  if (!hasBlockingError(normalized.errors)) {
    normalized.errors.push({
      message: "PhaseOutput normalization required a blocking error",
      severity: "blocking",
    });
  }

  const normalizedParsed = phaseOutputSchema.safeParse(normalized);
  if (!normalizedParsed.success) {
    return { ok: false, reason: "PhaseOutput normalization failed" };
  }
  return { ok: true, output: normalizedParsed.data };
}

function hasBlockingError(errors: PhaseError[]): boolean {
  return errors.some((error) => error.severity === "blocking");
}
