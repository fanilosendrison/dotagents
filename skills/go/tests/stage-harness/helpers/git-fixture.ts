import * as childProcess from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export type CommittedRepo = {
  workDir: string;
  baseSha: string;
  files: Record<string, string>;
  cleanup: () => Promise<void>;
};

export type RepoEntry =
  | { kind: "file"; path: string; bytes: string; executable?: boolean }
  | { kind: "symlink"; path: string; target: string }
  | { kind: "deleted-after-commit"; path: string; bytes: string };

export type CommittedRepoFromEntries = CommittedRepo & {
  entries: RepoEntry[];
};

export type GitCommandResult = {
  exitCode: number;
  stdout: Buffer;
  stderr: Buffer;
};

export async function runGit(
  workDir: string,
  args: string[],
  options: { allowFailure?: boolean; env?: NodeJS.ProcessEnv } = {},
): Promise<GitCommandResult> {
  const commandOptions =
    options.env === undefined ? {} : { env: options.env };
  const result = await runCommand("git", ["-C", workDir, ...args], commandOptions);
  if (result.exitCode !== 0 && options.allowFailure !== true) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr.toString("utf8")}`,
    );
  }
  return result;
}

export async function createCommittedRepo(
  files: Record<string, string> = { "src/a.txt": "alpha\n" },
): Promise<CommittedRepo> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "go-stage-repo-"));
  await runCommand("git", ["init", workDir]);
  await runGit(workDir, ["config", "user.name", "Example User"]);
  await runGit(workDir, ["config", "user.email", "user@example.invalid"]);
  for (const [relativePath, bytes] of Object.entries(files)) {
    await writeFileInRepo(workDir, relativePath, bytes);
  }
  await runGit(workDir, ["add", "."]);
  await runGit(workDir, ["commit", "-m", "initial", "--no-verify"]);
  const baseSha = trimOneLineEnding(
    (await runGit(workDir, ["rev-parse", "HEAD"])).stdout.toString("utf8"),
  );
  return {
    workDir,
    baseSha,
    files,
    cleanup: () => fs.rm(workDir, { recursive: true, force: true }),
  };
}

export async function createCommittedRepoFromEntries(
  entries: RepoEntry[],
): Promise<CommittedRepoFromEntries> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "go-stage-repo-"));
  await runCommand("git", ["init", workDir]);
  await runGit(workDir, ["config", "user.name", "Example User"]);
  await runGit(workDir, ["config", "user.email", "user@example.invalid"]);

  const files: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.kind === "file" || entry.kind === "deleted-after-commit") {
      await writeFileInRepo(workDir, entry.path, entry.bytes);
      files[entry.path] = entry.bytes;
      if (entry.kind === "file" && entry.executable === true) {
        await fs.chmod(path.join(workDir, entry.path), 0o755);
      }
    } else {
      await fs.mkdir(path.dirname(path.join(workDir, entry.path)), {
        recursive: true,
      });
      await fs.symlink(entry.target, path.join(workDir, entry.path));
      files[entry.path] = entry.target;
    }
  }

  await runGit(workDir, ["add", "."]);
  await runGit(workDir, ["commit", "-m", "initial", "--no-verify"]);
  const baseSha = trimOneLineEnding(
    (await runGit(workDir, ["rev-parse", "HEAD"])).stdout.toString("utf8"),
  );

  for (const entry of entries) {
    if (entry.kind === "deleted-after-commit") {
      await fs.rm(path.join(workDir, entry.path), { force: true });
    }
  }

  return {
    workDir,
    baseSha,
    files,
    entries,
    cleanup: () => fs.rm(workDir, { recursive: true, force: true }),
  };
}

export async function writeFileInRepo(
  workDir: string,
  relativePath: string,
  bytes: string,
): Promise<void> {
  const fullPath = path.join(workDir, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, bytes);
}

export async function createMergeConflictRepo(): Promise<CommittedRepo> {
  const repo = await createCommittedRepo({ "src/a.txt": "base\n" });
  await runGit(repo.workDir, ["checkout", "-b", "left"]);
  await writeFileInRepo(repo.workDir, "src/a.txt", "left\n");
  await runGit(repo.workDir, ["add", "."]);
  await runGit(repo.workDir, ["commit", "-m", "left", "--no-verify"]);
  await runGit(repo.workDir, ["checkout", "-b", "right", repo.baseSha]);
  await writeFileInRepo(repo.workDir, "src/a.txt", "right\n");
  await runGit(repo.workDir, ["add", "."]);
  await runGit(repo.workDir, ["commit", "-m", "right", "--no-verify"]);
  await runGit(repo.workDir, ["merge", "left"], { allowFailure: true });
  return repo;
}

export async function getTreeSha(workDir: string): Promise<string> {
  return trimOneLineEnding(
    (await runGit(workDir, ["rev-parse", "HEAD^{tree}"])).stdout.toString(
      "utf8",
    ),
  );
}

export async function getBlobSha(
  workDir: string,
  relativePath: string,
): Promise<string> {
  return trimOneLineEnding(
    (
      await runGit(workDir, ["rev-parse", `HEAD:${relativePath}`])
    ).stdout.toString("utf8"),
  );
}

export function trimOneLineEnding(value: string): string {
  if (value.endsWith("\r\n")) {
    return value.slice(0, -2);
  }
  if (value.endsWith("\n")) {
    return value.slice(0, -1);
  }
  return value;
}

async function runCommand(
  command: string,
  args: string[],
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<GitCommandResult> {
  return await new Promise((resolve, reject) => {
    const cleanPath = (process.env.PATH || "")
      .split(":")
      .filter((p) => !p.includes(".gravity/wrappers") && !p.includes("git-commits-push-enforcer"))
      .join(":");
    const child = childProcess.spawn(command, args, {
      env: { ...process.env, PATH: cleanPath, ...options.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdoutChunks),
        stderr: Buffer.concat(stderrChunks),
      }),
    );
  });
}
