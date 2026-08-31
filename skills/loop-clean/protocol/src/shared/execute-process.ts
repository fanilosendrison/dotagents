import { spawn } from "node:child_process";

export interface ProcessExecution {
	readonly exitCode: number;
	readonly stdout: Uint8Array;
	readonly stderr: string;
}

export async function executeProcess(
	command: string,
	args: readonly string[],
	options: {
		readonly cwd: string;
		readonly env?: NodeJS.ProcessEnv;
	},
): Promise<ProcessExecution> {
	return await new Promise<ProcessExecution>((resolve, reject) => {
		const child = spawn(command, [...args], {
			cwd: options.cwd,
			env: options.env ?? process.env,
			shell: false,
			stdio: ["ignore", "pipe", "pipe"],
		});
		const stdoutChunks: Buffer[] = [];
		const stderrChunks: Buffer[] = [];

		child.stdout.on("data", (chunk: Buffer) => {
			stdoutChunks.push(Buffer.from(chunk));
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderrChunks.push(Buffer.from(chunk));
		});
		child.once("error", reject);
		child.once("close", (exitCode, signal) => {
			if (exitCode === null) {
				reject(
					new Error(
						`${command} terminated without an exit code${signal ? ` (${signal})` : ""}`,
					),
				);
				return;
			}
			const stdout = Buffer.concat(stdoutChunks);
			resolve({
				exitCode,
				stdout: new Uint8Array(
					stdout.buffer,
					stdout.byteOffset,
					stdout.byteLength,
				),
				stderr: Buffer.concat(stderrChunks).toString("utf8"),
			});
		});
	});
}

export function decodeProcessOutput(stdout: Uint8Array): string {
	return new TextDecoder().decode(stdout);
}
