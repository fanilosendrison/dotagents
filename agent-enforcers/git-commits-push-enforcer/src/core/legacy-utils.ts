const GIT_COMMIT = /git\s+commit\b/;
const CC_REGEX = /^[a-z]+(\([^)]+\))?!?:\s\S/;

/** Detect whether the raw shell command contains a git commit (simple regex). */
export function isGitCommit(command: string): boolean {
	return GIT_COMMIT.test(command);
}

/**
 * Extract the commit message from a raw git-commit command.
 * Supports: -m "...", -m '...', heredoc <<'EOF' ... EOF
 */
export function extractMessage(command: string): string | null {
	const heredoc = command.match(/<<'?EOF'?\s*\n([\s\S]*?)\n\s*EOF/);
	if (heredoc) {
		const lines = heredoc[1]!
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l);
		return lines[0] || null;
	}
	const dq = command.match(/-m\s+"([\s\S]*?)"/);
	if (dq) return dq[1]!.split("\n")[0]!.trim() || null;
	const sq = command.match(/-m\s+'([\s\S]*?)'/);
	if (sq) return sq[1]!.split("\n")[0]!.trim() || null;
	return null;
}

/** Check if a commit message follows Conventional Commits format. */
export function isValidCC(message: string): boolean {
	return CC_REGEX.test(message.trim());
}

/** Check if the raw command includes a git push instruction (simple regex). */
export function hasPush(command: string): boolean {
	return /git\s+push/.test(command);
}
