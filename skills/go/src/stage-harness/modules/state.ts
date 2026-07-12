import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  CanonicalStateSnapshot,
  StageError,
  ResolvedStageInput,
} from "../types.ts";
import {
  gitFailureMessage,
  runGitCommand,
  splitNulRecords,
  trimOneTrailingLineEnding,
} from "../runtime/git.ts";
import { sha256Hex } from "../runtime/hash.ts";

type TrackedRecord = {
  rawPath: Buffer;
  pathText: string;
  mode: string;
  contentHash: string;
};

export async function collectCanonicalState(input: {
  input: ResolvedStageInput;
}): Promise<CanonicalStateSnapshot> {
  const errors: StageError[] = [];
  const headShaAfter = await collectHeadShaAfter(input.input, errors);
  const trackedWorktreeHash = await collectTrackedWorktreeHash(input.input, errors);
  const worktreeClean = await collectWorktreeClean(input.input, errors);
  return { headShaAfter, trackedWorktreeHash, worktreeClean, errors };
}

async function collectHeadShaAfter(
  input: ResolvedStageInput,
  errors: StageError[],
): Promise<string | null> {
  const result = await runGitCommand(input.workDir, ["rev-parse", "HEAD"]);
  if (result.exitCode !== 0) {
    errors.push({
      message: `headShaAfter unavailable: ${gitFailureMessage(["rev-parse", "HEAD"], result)}`,
      severity: "blocking",
    });
    return null;
  }
  return trimOneTrailingLineEnding(result.stdout.toString("utf8"));
}

async function collectWorktreeClean(
  input: ResolvedStageInput,
  errors: StageError[],
): Promise<boolean | null> {
  const args = ["status", "--porcelain=v1", "-z", "--ignore-submodules=none"];
  const result = await runGitCommand(input.workDir, args);
  if (result.exitCode !== 0) {
    errors.push({
      message: `worktreeClean unavailable: ${gitFailureMessage(args, result)}`,
      severity: "blocking",
    });
    return null;
  }
  return result.stdout.length === 0;
}

async function collectTrackedWorktreeHash(
  input: ResolvedStageInput,
  errors: StageError[],
): Promise<string | null> {
  const args = ["ls-files", "-s", "-z"];
  const result = await runGitCommand(input.workDir, args);
  if (result.exitCode !== 0) {
    errors.push({
      message: `trackedWorktreeHash unavailable: ${gitFailureMessage(args, result)}`,
      severity: "blocking",
    });
    return null;
  }

  const records: TrackedRecord[] = [];
  for (const rawRecord of splitNulRecords(result.stdout)) {
    const parsed = parseLsFilesStageRecord(rawRecord);
    if (parsed === null) {
      errors.push({
        message: "trackedWorktreeHash unavailable: malformed git ls-files record",
        severity: "blocking",
      });
      return null;
    }
    if (parsed.stage !== "0") {
      errors.push({
        message: `trackedWorktreeHash unavailable: unmerged index entry ${parsed.pathText}`,
        severity: "blocking",
        file: parsed.pathText,
      });
      return null;
    }

    const trackedRecord = await buildTrackedRecord(input.workDir, parsed);
    if (!trackedRecord.ok) {
      errors.push(trackedRecord.error);
      return null;
    }
    records.push(trackedRecord.record);
  }

  records.sort((left, right) => Buffer.compare(left.rawPath, right.rawPath));
  const payload = Buffer.concat(
    records.flatMap((record) => [
      record.rawPath,
      Buffer.from("\0"),
      Buffer.from(record.mode),
      Buffer.from("\0"),
      Buffer.from(record.contentHash),
      Buffer.from("\0"),
    ]),
  );
  return sha256Hex(payload);
}

function parseLsFilesStageRecord(record: Buffer):
  | {
      indexMode: string;
      objectId: string;
      stage: string;
      rawPath: Buffer;
      pathText: string;
    }
  | null {
  const firstSpace = record.indexOf(0x20);
  if (firstSpace < 0) {
    return null;
  }
  const secondSpace = record.indexOf(0x20, firstSpace + 1);
  if (secondSpace < 0) {
    return null;
  }
  const tab = record.indexOf(0x09, secondSpace + 1);
  if (tab < 0) {
    return null;
  }
  const indexMode = record.subarray(0, firstSpace).toString("utf8");
  const objectId = record.subarray(firstSpace + 1, secondSpace).toString("utf8");
  const stage = record.subarray(secondSpace + 1, tab).toString("utf8");
  const rawPath = record.subarray(tab + 1);
  return {
    indexMode,
    objectId,
    stage,
    rawPath,
    pathText: rawPath.toString("utf8"),
  };
}

async function buildTrackedRecord(
  workDir: string,
  entry: {
    indexMode: string;
    objectId: string;
    rawPath: Buffer;
    pathText: string;
  },
): Promise<{ ok: true; record: TrackedRecord } | { ok: false; error: StageError }> {
  const fullPath = path.join(workDir, entry.pathText);
  let stat: Awaited<ReturnType<typeof fs.lstat>>;
  try {
    stat = await fs.lstat(fullPath);
  } catch (cause) {
    if (isNodeError(cause) && cause.code === "ENOENT") {
      return {
        ok: true,
        record: {
          rawPath: entry.rawPath,
          pathText: entry.pathText,
          mode: "0",
          contentHash: "DELETED",
        },
      };
    }
    return {
      ok: false,
      error: trackedHashError(`cannot inspect ${entry.pathText}`, entry.pathText),
    };
  }

  if (entry.indexMode.startsWith("100")) {
    if (!stat.isFile()) {
      return {
        ok: false,
        error: trackedHashError(`type mismatch for ${entry.pathText}`, entry.pathText),
      };
    }
    try {
      const bytes = await fs.readFile(fullPath);
      return {
        ok: true,
        record: {
          rawPath: entry.rawPath,
          pathText: entry.pathText,
          mode: (stat.mode & 0o111) !== 0 ? "100755" : "100644",
          contentHash: sha256Hex(bytes),
        },
      };
    } catch (cause) {
      const reason =
        isNodeError(cause) && cause.code === "ENOENT"
          ? `race while reading ${entry.pathText}`
          : `cannot read ${entry.pathText}`;
      return { ok: false, error: trackedHashError(reason, entry.pathText) };
    }
  }

  if (entry.indexMode === "120000") {
    if (!stat.isSymbolicLink()) {
      return {
        ok: false,
        error: trackedHashError(`type mismatch for ${entry.pathText}`, entry.pathText),
      };
    }
    try {
      const target = await fs.readlink(fullPath);
      return {
        ok: true,
        record: {
          rawPath: entry.rawPath,
          pathText: entry.pathText,
          mode: "120000",
          contentHash: sha256Hex(Buffer.from(target)),
        },
      };
    } catch {
      return {
        ok: false,
        error: trackedHashError(`cannot read symlink ${entry.pathText}`, entry.pathText),
      };
    }
  }

  if (entry.indexMode === "160000") {
    return {
      ok: true,
      record: {
        rawPath: entry.rawPath,
        pathText: entry.pathText,
        mode: "160000",
        contentHash: entry.objectId,
      },
    };
  }

  return {
    ok: false,
    error: trackedHashError(`unsupported index mode ${entry.indexMode} for ${entry.pathText}`, entry.pathText),
  };
}

function trackedHashError(message: string, file: string): StageError {
  return {
    message: `trackedWorktreeHash unavailable: ${message}`,
    severity: "blocking",
    file,
  };
}

function isNodeError(cause: unknown): cause is NodeJS.ErrnoException {
  return cause instanceof Error && "code" in cause;
}
