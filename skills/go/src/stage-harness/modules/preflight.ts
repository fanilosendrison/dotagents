import * as fs from "node:fs/promises";
import * as path from "node:path";
import { stageInputSchema } from "../schemas.ts";
import type { StageInput, PreflightResult } from "../types.ts";
import {
  runGitCommand,
  runRequiredGitCommand,
  splitNulRecords,
  trimOneTrailingLineEnding,
} from "../runtime/git.ts";
import { isPathInside } from "../runtime/path-validation.ts";

const stableIdentifierPattern = /^[A-Za-z0-9._-]+$/u;
const exactObjectIdPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

export async function runInputPreflight(
  input: StageInput,
): Promise<PreflightResult> {
  try {
    const parsed = safeParseStageInput(input);
    if (!parsed.ok) {
      return fail("StageInput failed schema validation");
    }

    if (!stableIdentifierPattern.test(parsed.input.runId)) {
      return fail("runId must be a stable ASCII identifier");
    }
    if (!stableIdentifierPattern.test(parsed.input.stage)) {
      return fail("stage must be a stable ASCII identifier");
    }

    if (!path.isAbsolute(parsed.input.workDir)) {
      return fail("workDir must be absolute");
    }
    if (!path.isAbsolute(parsed.input.artefactDir)) {
      return fail("artefactDir must be absolute");
    }

    const resolvedWorkDir = await fs.realpath(parsed.input.workDir);
    const artefactParent = await fs.realpath(path.dirname(parsed.input.artefactDir));
    const artefactBasename = path.basename(parsed.input.artefactDir);
    if (artefactBasename === "." || artefactBasename === "..") {
      return fail("artefactDir basename must not be . or ..");
    }
    const resolvedArtefactDir = path.resolve(artefactParent, artefactBasename);

    const rootResult = await runRequiredGitCommand(resolvedWorkDir, [
      "rev-parse",
      "--show-toplevel",
    ]);
    const reportedRoot = trimOneTrailingLineEnding(rootResult.stdout.toString("utf8"));
    const resolvedReportedRoot = await fs.realpath(reportedRoot);
    if (resolvedReportedRoot !== resolvedWorkDir) {
      return fail("workDir must be the Git repository root");
    }

    if (!exactObjectIdPattern.test(parsed.input.baseSha)) {
      return fail("baseSha must be an exact commit object id");
    }
    const typeResult = await runRequiredGitCommand(resolvedWorkDir, [
      "cat-file",
      "-t",
      parsed.input.baseSha,
    ]);
    if (trimOneTrailingLineEnding(typeResult.stdout.toString("utf8")) !== "commit") {
      return fail("baseSha must name a commit object");
    }
    await runRequiredGitCommand(resolvedWorkDir, [
      "cat-file",
      "-e",
      `${parsed.input.baseSha}^{commit}`,
    ]);

    if (resolvedArtefactDir === resolvedWorkDir) {
      return fail("artefactDir must be outside workDir");
    }
    if (isPathInside(resolvedWorkDir, resolvedArtefactDir)) {
      return fail("artefactDir must be outside workDir");
    }
    if (await pathExists(resolvedArtefactDir)) {
      return fail("artefactDir must not already exist");
    }

    const sparseList = await runGitCommand(resolvedWorkDir, [
      "sparse-checkout",
      "list",
    ]);
    if (sparseList.exitCode === 0 && sparseList.stdout.length > 0) {
      return fail("sparse checkout is unsupported");
    }
    const sparseConfig = await runGitCommand(resolvedWorkDir, [
      "config",
      "--bool",
      "core.sparseCheckout",
    ]);
    if (
      sparseConfig.exitCode === 0 &&
      trimOneTrailingLineEnding(sparseConfig.stdout.toString("utf8")) === "true"
    ) {
      return fail("sparse checkout is unsupported");
    }

    const fileTags = await runRequiredGitCommand(resolvedWorkDir, [
      "ls-files",
      "-v",
      "-z",
    ]);
    for (const record of splitNulRecords(fileTags.stdout)) {
      const tag = record[0];
      if (tag === "S".charCodeAt(0)) {
        return fail("skip-worktree entries are unsupported");
      }
      if (tag !== undefined && tag >= 97 && tag <= 122) {
        return fail("assume-unchanged entries are unsupported");
      }
    }

    return {
      ok: true,
      input: {
        ...parsed.input,
        workDir: resolvedWorkDir,
        artefactDir: resolvedArtefactDir,
      },
    };
  } catch (cause) {
    return fail(errorMessage(cause));
  }
}

function safeParseStageInput(
  input: StageInput,
): { ok: true; input: StageInput } | { ok: false } {
  try {
    const parsed = stageInputSchema.safeParse(input);
    return parsed.success ? { ok: true, input: parsed.data } : { ok: false };
  } catch {
    return { ok: false };
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.lstat(targetPath);
    return true;
  } catch (cause) {
    if (isNodeError(cause) && cause.code === "ENOENT") {
      return false;
    }
    throw cause;
  }
}

function fail(reason: string): PreflightResult {
  return { ok: false, reason };
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function isNodeError(cause: unknown): cause is NodeJS.ErrnoException {
  return cause instanceof Error && "code" in cause;
}
