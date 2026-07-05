const GIT_COMMIT = /git\s+commit\b/;

export function isGitCommit(command: string): boolean {
	return GIT_COMMIT.test(command);
}
