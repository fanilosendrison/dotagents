import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  Phase,
  PhaseDraftOutput,
  PhaseInput,
} from "../../../src/phase-harness/index.ts";

export const passingPhaseWithEvidence: Phase = async (input) => {
  await writeEvidence(input, "result.json", JSON.stringify({ ok: true }));
  return { status: "passed", evidenceRefs: ["evidence/result.json"], errors: [] };
};

export const failingPhaseWithEvidence: Phase = async (input) => {
  await writeEvidence(input, "lint.json", JSON.stringify({ ok: false }));
  return {
    status: "failed",
    evidenceRefs: ["evidence/lint.json"],
    errors: [
      {
        message: "Lint failed",
        severity: "minor",
        file: "src/a.txt",
        line: 1,
        evidenceRef: "evidence/lint.json",
      },
    ],
  };
};

export const skippedPhase: Phase = async () => ({
  status: "skipped",
  evidenceRefs: [],
  errors: [],
});

export const throwingPhase: Phase = async () => {
  throw new Error("phase exploded");
};

export const invalidDraftPhase = async (): Promise<unknown> => ({
  status: "passed",
  evidenceRefs: "not-an-array",
  errors: [],
});

export const undefinedDraftPhase = async (): Promise<unknown> => undefined;

export const erroredDraftPhase = async (): Promise<unknown> => ({
  status: "errored",
  evidenceRefs: [],
  errors: [],
});

export const failedWithoutErrorsPhase = async (): Promise<unknown> => ({
  status: "failed",
  evidenceRefs: [],
  errors: [],
});

export const passedWithErrorsPhase = async (): Promise<unknown> => ({
  status: "passed",
  evidenceRefs: [],
  errors: [{ message: "unexpected", severity: "minor" }],
});

export const skippedWithErrorsPhase = async (): Promise<unknown> => ({
  status: "skipped",
  evidenceRefs: [],
  errors: [{ message: "unexpected", severity: "minor" }],
});

export const dirtyTrackedFilePhase: Phase = async (input) => {
  await fs.writeFile(path.join(input.workDir, "src/a.txt"), "beta\n");
  return { status: "passed", evidenceRefs: [], errors: [] };
};

export const reservedOutputPhase: Phase = async (input) => {
  await fs.writeFile(path.join(input.artefactDir, "output.json"), "phase");
  return { status: "passed", evidenceRefs: [], errors: [] };
};

export const reservedStdoutPhase: Phase = async (input) => {
  await fs.writeFile(path.join(input.artefactDir, "stdout.txt"), "phase");
  return { status: "passed", evidenceRefs: [], errors: [] };
};

export const reservedStderrPhase: Phase = async (input) => {
  await fs.writeFile(path.join(input.artefactDir, "stderr.txt"), "phase");
  return { status: "passed", evidenceRefs: [], errors: [] };
};

export const symlinkEscapeEvidencePhase: Phase = async (input) => {
  const outside = path.join(path.dirname(input.artefactDir), "outside.txt");
  await fs.writeFile(outside, "outside");
  await fs.mkdir(path.join(input.artefactDir, "evidence"), { recursive: true });
  await fs.symlink(outside, path.join(input.artefactDir, "evidence", "escape"));
  return {
    status: "passed",
    evidenceRefs: ["evidence/escape"],
    errors: [],
  };
};

export const invalidErrorEvidencePhase: Phase = async (input) => {
  await writeEvidence(input, "lint.json", "{}");
  return {
    status: "failed",
    evidenceRefs: ["evidence/lint.json"],
    errors: [
      {
        message: "Bad evidence",
        severity: "minor",
        evidenceRef: "evidence/missing.json",
      },
    ],
  };
};

export const invalidErrorFilePhase: Phase = async () => ({
  status: "failed",
  evidenceRefs: [],
  errors: [{ message: "Bad file", severity: "minor", file: "../escape.ts" }],
});

export const invalidErrorLinePhase: Phase = async (): Promise<PhaseDraftOutput> => ({
  status: "failed",
  evidenceRefs: [],
  errors: [{ message: "Bad line", severity: "minor", line: 0 }],
});

export const stringThrowingPhase = async (): Promise<PhaseDraftOutput> => {
  throw "string exploded";
};

export const objectThrowingPhase = async (): Promise<PhaseDraftOutput> => {
  throw { code: "EXPLODED" };
};

export const cyclicThrowingPhase = async (): Promise<PhaseDraftOutput> => {
  const value: { self?: unknown } = {};
  value.self = value;
  throw value;
};

export function invalidEvidenceRefPhase(ref: string): Phase {
  return async (input: PhaseInput) => {
    if (ref === "evidence/dir") {
      await fs.mkdir(path.join(input.artefactDir, ref), { recursive: true });
    }
    return { status: "passed", evidenceRefs: [ref], errors: [] };
  };
}

async function writeEvidence(
  input: PhaseInput,
  filename: string,
  contents: string,
): Promise<void> {
  const evidenceDir = path.join(input.artefactDir, "evidence");
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, filename), contents);
}
