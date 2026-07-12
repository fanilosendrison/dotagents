import * as fs from "node:fs/promises";
import * as path from "node:path";
import { expect } from "bun:test";
import type { StageOutput } from "../../../src/stage-harness/index.ts";

export async function assertOutputJsonMatchesReturn(
  output: StageOutput,
): Promise<void> {
  const payload = await fs.readFile(
    path.join(output.artefactDir, "output.json"),
    "utf8",
  );
  expect(JSON.parse(payload)).toEqual(output);
}

export async function assertNoOutputJson(artefactDir: string): Promise<void> {
  try {
    await fs.access(path.join(artefactDir, "output.json"));
    throw new Error("output.json exists");
  } catch (cause) {
    if (
      cause instanceof Error &&
      "code" in cause &&
      cause.code === "ENOENT"
    ) {
      return;
    }
    throw cause;
  }
}

export function assertCanonicalFieldsAvailable(output: StageOutput): void {
  expect(output.headShaAfter).not.toBeNull();
  expect(output.trackedWorktreeHash).not.toBeNull();
  expect(output.worktreeClean).not.toBeNull();
}

export function assertErroredHasBlockingError(output: StageOutput): void {
  expect(output.status).toBe("errored");
  expect(output.errors.some((error) => error.severity === "blocking")).toBe(
    true,
  );
}
