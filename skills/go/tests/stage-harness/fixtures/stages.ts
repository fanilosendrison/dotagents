import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  Stage,
  StageDraftOutput,
  StageInput,
} from "../../../src/stage-harness/index.ts";

export const passingStageWithEvidence: Stage = async (input) => {
  await writeEvidence(input, "result.json", JSON.stringify({ ok: true }));
  return { status: "passed", evidenceRefs: ["evidence/result.json"], errors: [] };
};

export const failingStageWithEvidence: Stage = async (input) => {
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

export const skippedStage: Stage = async () => ({
  status: "skipped",
  evidenceRefs: [],
  errors: [],
});

export const throwingStage: Stage = async () => {
  throw new Error("stage exploded");
};

export const invalidDraftStage = async (): Promise<unknown> => ({
  status: "passed",
  evidenceRefs: "not-an-array",
  errors: [],
});

export const undefinedDraftStage = async (): Promise<unknown> => undefined;

export const erroredDraftStage = async (): Promise<unknown> => ({
  status: "errored",
  evidenceRefs: [],
  errors: [],
});

export const failedWithoutErrorsStage = async (): Promise<unknown> => ({
  status: "failed",
  evidenceRefs: [],
  errors: [],
});

export const passedWithErrorsStage = async (): Promise<unknown> => ({
  status: "passed",
  evidenceRefs: [],
  errors: [{ message: "unexpected", severity: "minor" }],
});

export const skippedWithErrorsStage = async (): Promise<unknown> => ({
  status: "skipped",
  evidenceRefs: [],
  errors: [{ message: "unexpected", severity: "minor" }],
});

export const dirtyTrackedFileStage: Stage = async (input) => {
  await fs.writeFile(path.join(input.workDir, "src/a.txt"), "beta\n");
  return { status: "passed", evidenceRefs: [], errors: [] };
};

export const reservedOutputStage: Stage = async (input) => {
  await fs.writeFile(path.join(input.artefactDir, "output.json"), "stage");
  return { status: "passed", evidenceRefs: [], errors: [] };
};

export const reservedStdoutStage: Stage = async (input) => {
  await fs.writeFile(path.join(input.artefactDir, "stdout.txt"), "stage");
  return { status: "passed", evidenceRefs: [], errors: [] };
};

export const reservedStderrStage: Stage = async (input) => {
  await fs.writeFile(path.join(input.artefactDir, "stderr.txt"), "stage");
  return { status: "passed", evidenceRefs: [], errors: [] };
};

export const symlinkEscapeEvidenceStage: Stage = async (input) => {
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

export const invalidErrorEvidenceStage: Stage = async (input) => {
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

export const invalidErrorFileStage: Stage = async () => ({
  status: "failed",
  evidenceRefs: [],
  errors: [{ message: "Bad file", severity: "minor", file: "../escape.ts" }],
});

export const invalidErrorLineStage: Stage = async (): Promise<StageDraftOutput> => ({
  status: "failed",
  evidenceRefs: [],
  errors: [{ message: "Bad line", severity: "minor", line: 0 }],
});

export const stringThrowingStage = async (): Promise<StageDraftOutput> => {
  throw "string exploded";
};

export const objectThrowingStage = async (): Promise<StageDraftOutput> => {
  throw { code: "EXPLODED" };
};

export const cyclicThrowingStage = async (): Promise<StageDraftOutput> => {
  const value: { self?: unknown } = {};
  value.self = value;
  throw value;
};

export function invalidEvidenceRefStage(ref: string): Stage {
  return async (input: StageInput) => {
    if (ref === "evidence/dir") {
      await fs.mkdir(path.join(input.artefactDir, ref), { recursive: true });
    }
    return { status: "passed", evidenceRefs: [ref], errors: [] };
  };
}

async function writeEvidence(
  input: StageInput,
  filename: string,
  contents: string,
): Promise<void> {
  const evidenceDir = path.join(input.artefactDir, "evidence");
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(path.join(evidenceDir, filename), contents);
}
