import * as fs from "node:fs/promises";
import * as path from "node:path";
import assert from "node:assert/strict";
import type { StageOutput } from "../../../src/stage-harness/index.ts";

export async function assertOutputJsonMatchesReturn(
  output: StageOutput,
): Promise<void> {
  const payload = await fs.readFile(
    path.join(output.artefactDir, "output.json"),
    "utf8",
  );
  assert.deepStrictEqual(JSON.parse(payload), output);
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
  assert.notStrictEqual(output.headShaAfter, null);
  assert.notStrictEqual(output.trackedWorktreeHash, null);
  assert.notStrictEqual(output.worktreeClean, null);
}

export function assertErroredHasBlockingError(output: StageOutput): void {
  assert.strictEqual(output.status, "errored");
  assert.strictEqual(output.errors.some((error) => error.severity === "blocking"), true);
}
