import * as fs from "node:fs/promises";
import * as path from "node:path";
import { stageDraftOutputSchema } from "../schemas.ts";
import type {
  StageDraftOutput,
  StageError,
  ResolvedStageInput,
  ValidatedDraftResult,
} from "../types.ts";
import {
  isInvalidEvidenceRef,
  isInvalidRepoRelativePosixPath,
  isPathInside,
  reservedRootFilenames,
} from "../runtime/path-validation.ts";

export async function validateDraftAndEvidence(input: {
  input: ResolvedStageInput;
  draft: unknown;
}): Promise<ValidatedDraftResult> {
  const validationErrors: StageError[] = [];
  const parsed = safeParseDraft(input.draft);
  const reservedErrors = await validateReservedFileErrors(input.input);

  if (!parsed.ok) {
    return {
      ok: false,
      evidenceRefs: [],
      errors: [
        {
          message: "Stage draft validation failed",
          severity: "blocking",
        },
        ...reservedErrors,
      ],
    };
  }

  const retainedEvidenceRefs: string[] = [];
  for (const evidenceRef of parsed.draft.evidenceRefs) {
    const result = await validateEvidenceRef(input.input, evidenceRef);
    if (result.ok) {
      retainedEvidenceRefs.push(evidenceRef);
    } else {
      validationErrors.push(result.error);
    }
  }

  const sanitizedStageErrors = await sanitizeStageErrors(
    input.input,
    parsed.draft.errors,
    retainedEvidenceRefs,
    validationErrors,
  );

  validationErrors.push(...reservedErrors);
  if (validationErrors.length > 0) {
    return {
      ok: false,
      evidenceRefs: retainedEvidenceRefs,
      errors: [...validationErrors, ...sanitizedStageErrors],
    };
  }

  return {
    ok: true,
    draft: parsed.draft,
    evidenceRefs: retainedEvidenceRefs,
    errors: sanitizedStageErrors,
  };
}

export async function validateReservedHarnessFiles(input: {
  input: ResolvedStageInput;
}): Promise<ValidatedDraftResult> {
  const errors = await validateReservedFileErrors(input.input);
  return { ok: false, evidenceRefs: [], errors };
}

async function sanitizeStageErrors(
  input: ResolvedStageInput,
  stageErrors: StageError[],
  retainedEvidenceRefs: string[],
  validationErrors: StageError[],
): Promise<StageError[]> {
  const sanitized: StageError[] = [];
  for (const stageError of stageErrors) {
    const next: StageError = {
      message: stageError.message,
      severity: stageError.severity,
    };

    if (stageError.evidenceRef !== undefined) {
      const evidenceValid =
        retainedEvidenceRefs.includes(stageError.evidenceRef) &&
        (await validateEvidenceRef(input, stageError.evidenceRef)).ok;
      if (evidenceValid) {
        next.evidenceRef = stageError.evidenceRef;
      } else {
        validationErrors.push({
          message: `error evidence reference validation failed for ${stageError.evidenceRef}`,
          severity: "blocking",
        });
      }
    }

    if (stageError.file !== undefined) {
      if (isInvalidRepoRelativePosixPath(stageError.file)) {
        validationErrors.push({
          message: `error metadata validation failed for file ${stageError.file}`,
          severity: "blocking",
        });
      } else {
        next.file = stageError.file;
      }
    }

    if (stageError.line !== undefined) {
      if (!Number.isInteger(stageError.line) || stageError.line <= 0) {
        validationErrors.push({
          message: `error metadata validation failed for line ${stageError.line}`,
          severity: "blocking",
        });
      } else {
        next.line = stageError.line;
      }
    }

    sanitized.push(next);
  }
  return sanitized;
}

async function validateEvidenceRef(
  input: ResolvedStageInput,
  evidenceRef: string,
): Promise<{ ok: true } | { ok: false; error: StageError }> {
  if (isInvalidEvidenceRef(evidenceRef)) {
    return {
      ok: false,
      error: {
        message: `evidence reference validation failed for ${evidenceRef}`,
        severity: "blocking",
      },
    };
  }

  try {
    const artefactRealPath = await fs.realpath(input.artefactDir);
    const candidate = path.join(input.artefactDir, evidenceRef);
    const candidateRealPath = await fs.realpath(candidate);
    if (!isPathInside(artefactRealPath, candidateRealPath)) {
      return {
        ok: false,
        error: {
          message: `evidence containment validation failed for ${evidenceRef}`,
          severity: "blocking",
        },
      };
    }
    const stat = await fs.stat(candidateRealPath);
    if (!stat.isFile()) {
      return {
        ok: false,
        error: {
          message: `evidence reference validation failed: ${evidenceRef} is not a regular file`,
          severity: "blocking",
        },
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: {
        message: `evidence reference validation failed for ${evidenceRef}`,
        severity: "blocking",
      },
    };
  }
}

async function validateReservedFileErrors(
  input: ResolvedStageInput,
): Promise<StageError[]> {
  const errors: StageError[] = [];
  for (const filename of reservedRootFilenames) {
    try {
      await fs.lstat(path.join(input.artefactDir, filename));
      errors.push({
        message: `reserved-file violation: ${filename} exists at artefact root`,
        severity: "blocking",
      });
    } catch (cause) {
      if (!(isNodeError(cause) && cause.code === "ENOENT")) {
        errors.push({
          message: `reserved-file validation failed for ${filename}`,
          severity: "blocking",
        });
      }
    }
  }
  return errors;
}

function safeParseDraft(
  draft: unknown,
): { ok: true; draft: StageDraftOutput } | { ok: false } {
  try {
    const parsed = stageDraftOutputSchema.safeParse(draft);
    return parsed.success ? { ok: true, draft: parsed.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function isNodeError(cause: unknown): cause is NodeJS.ErrnoException {
  return cause instanceof Error && "code" in cause;
}
