import * as childProcess from "node:child_process";

export type GitCommandResult = {
  exitCode: number;
  stdout: Buffer;
  stderr: Buffer;
};

export async function runGitCommand(
  workDir: string,
  args: string[],
): Promise<GitCommandResult> {
  return await new Promise((resolve, reject) => {
    const child = childProcess.spawn("git", ["-C", workDir, ...args], {
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

export async function runRequiredGitCommand(
  workDir: string,
  args: string[],
): Promise<GitCommandResult> {
  const result = await runGitCommand(workDir, args);
  if (result.exitCode !== 0) {
    throw new Error(gitFailureMessage(args, result));
  }
  return result;
}

export function trimOneTrailingLineEnding(value: string): string {
  if (value.endsWith("\r\n")) {
    return value.slice(0, -2);
  }
  if (value.endsWith("\n")) {
    return value.slice(0, -1);
  }
  return value;
}

export function gitFailureMessage(
  args: string[],
  result: GitCommandResult,
): string {
  const stderr = result.stderr.toString("utf8").trim();
  const diagnostic = stderr.length === 0 ? `exit ${result.exitCode}` : stderr;
  return `git ${args.join(" ")} failed: ${diagnostic}`;
}

export function splitNulRecords(output: Buffer): Buffer[] {
  const records: Buffer[] = [];
  let start = 0;
  for (let index = 0; index < output.length; index += 1) {
    if (output[index] === 0) {
      if (index > start) {
        records.push(output.subarray(start, index));
      }
      start = index + 1;
    }
  }
  if (start < output.length) {
    records.push(output.subarray(start));
  }
  return records;
}
