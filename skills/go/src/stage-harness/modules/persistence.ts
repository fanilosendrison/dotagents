import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { stageOutputSchema } from "../schemas.ts";
import type {
  CreateArtefactDirectoryResult,
  StageOutput,
  ResolvedStageInput,
  WriteCanonicalOutputResult,
} from "../types.ts";

export async function createArtefactDirectory(input: {
  input: ResolvedStageInput;
}): Promise<CreateArtefactDirectoryResult> {
  try {
    await fs.mkdir(input.input.artefactDir, { recursive: false });
    return { ok: true, input: input.input };
  } catch (cause) {
    return { ok: false, reason: filesystemErrorMessage(cause) };
  }
}

export async function writeCanonicalOutputAtomically(input: {
  output: StageOutput;
}): Promise<WriteCanonicalOutputResult> {
  const parsed = stageOutputSchema.safeParse(input.output);
  if (!parsed.success) {
    return { ok: false, reason: "StageOutput failed schema validation" };
  }

  const output = parsed.data;
  const payload = `${JSON.stringify(output, null, 2)}\n`;
  const temporaryPath = path.join(
    output.artefactDir,
    `.output.${process.pid}.${randomUUID()}.tmp`,
  );
  const finalPath = path.join(output.artefactDir, "output.json");

  try {
    if (process.env.GO_PHASE_HARNESS_TEST_FAULT === "fail-write") {
      throw new Error("injected write failure");
    }
    if (process.env.GO_PHASE_HARNESS_TEST_FAULT === "temp-collision") {
      await fs.writeFile(temporaryPath, "collision", { flag: "wx" });
    }
    await fs.writeFile(temporaryPath, payload, { flag: "wx" });
    if (process.env.GO_PHASE_HARNESS_TEST_FAULT === "fail-rename") {
      throw new Error("injected rename failure");
    }
    await fs.rename(temporaryPath, finalPath);
    return { ok: true, output };
  } catch (cause) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    return { ok: false, reason: filesystemErrorMessage(cause) };
  }
}

function filesystemErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
