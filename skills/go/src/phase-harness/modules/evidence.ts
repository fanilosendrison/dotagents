import * as fs from "node:fs/promises";
import * as path from "node:path";
import { phaseDraftOutputSchema } from "../schemas.ts";
import type {
  PhaseDraftOutput,
  PhaseError,
  ResolvedPhaseInput,
  ValidatedDraftResult,
} from "../types.ts";
import {
  isInvalidEvidenceRef,
  isInvalidRepoRelativePosixPath,
  isPathInside,
  reservedRootFilenames,
} from "../runtime/path-validation.ts";

export async function validateDraftAndEvidence(input: {
  input: ResolvedPhaseInput;
  draft: unknown;
}): Promise<ValidatedDraftResult> {
  const validationErrors: PhaseError[] = [];
  const parsed = safeParseDraft(input.draft);
  const reservedErrors = await validateReservedFileErrors(input.input);

  if (!parsed.ok) {
    return {
      ok: false,
      evidenceRefs: [],
      errors: [
        {
          message: "Phase draft validation failed",
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

  const sanitizedPhaseErrors = await sanitizePhaseErrors(
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
      errors: [...validationErrors, ...sanitizedPhaseErrors],
    };
  }

  return {
    ok: true,
    draft: parsed.draft,
    evidenceRefs: retainedEvidenceRefs,
    errors: sanitizedPhaseErrors,
  };
}

export async function validateReservedHarnessFiles(input: {
  input: ResolvedPhaseInput;
}): Promise<ValidatedDraftResult> {
  const errors = await validateReservedFileErrors(input.input);
  return { ok: false, evidenceRefs: [], errors };
}

async function sanitizePhaseErrors(
  input: ResolvedPhaseInput,
  phaseErrors: PhaseError[],
  retainedEvidenceRefs: string[],
  validationErrors: PhaseError[],
): Promise<PhaseError[]> {
  const sanitized: PhaseError[] = [];
  for (const phaseError of phaseErrors) {
    const next: PhaseError = {
      message: phaseError.message,
      severity: phaseError.severity,
    };

    if (phaseError.evidenceRef !== undefined) {
      const evidenceValid =
        retainedEvidenceRefs.includes(phaseError.evidenceRef) &&
        (await validateEvidenceRef(input, phaseError.evidenceRef)).ok;
      if (evidenceValid) {
        next.evidenceRef = phaseError.evidenceRef;
      } else {
        validationErrors.push({
          message: `error evidence reference validation failed for ${phaseError.evidenceRef}`,
          severity: "blocking",
        });
      }
    }

    if (phaseError.file !== undefined) {
      if (isInvalidRepoRelativePosixPath(phaseError.file)) {
        validationErrors.push({
          message: `error metadata validation failed for file ${phaseError.file}`,
          severity: "blocking",
        });
      } else {
        next.file = phaseError.file;
      }
    }

    if (phaseError.line !== undefined) {
      if (!Number.isInteger(phaseError.line) || phaseError.line <= 0) {
        validationErrors.push({
          message: `error metadata validation failed for line ${phaseError.line}`,
          severity: "blocking",
        });
      } else {
        next.line = phaseError.line;
      }
    }

    sanitized.push(next);
  }
  return sanitized;
}

async function validateEvidenceRef(
  input: ResolvedPhaseInput,
  evidenceRef: string,
): Promise<{ ok: true } | { ok: false; error: PhaseError }> {
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
  input: ResolvedPhaseInput,
): Promise<PhaseError[]> {
  const errors: PhaseError[] = [];
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
): { ok: true; draft: PhaseDraftOutput } | { ok: false } {
  try {
    const parsed = phaseDraftOutputSchema.safeParse(draft);
    return parsed.success ? { ok: true, draft: parsed.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

function isNodeError(cause: unknown): cause is NodeJS.ErrnoException {
  return cause instanceof Error && "code" in cause;
}
