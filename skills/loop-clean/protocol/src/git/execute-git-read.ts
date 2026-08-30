import { executeProcess } from "../shared/execute-process.ts";

/**
 * Low-level git subprocess runner shared across the protocol package.
 *
 * Kept in its own module so that both capture-invariants and read-index-digest
 * can import it without creating a circular dependency.
 */

export interface GitExecution {
	readonly exitCode: number;
	readonly stdout: Uint8Array;
	readonly stderr: string;
}

export async function executeGitRead(
	repositoryRoot: string,
	args: readonly string[],
): Promise<GitExecution> {
	return await executeProcess("git", ["-C", repositoryRoot, ...args], {
		cwd: repositoryRoot,
		env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
	});
}
