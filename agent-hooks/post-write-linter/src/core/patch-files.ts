import { isAbsolute, normalize, resolve } from "node:path";

const TOUCHED_FILE_PATTERN = /^\*\*\* (?:Add|Update) File: (.+)$/;
const MOVED_FILE_PATTERN = /^\*\*\* Move to: (.+)$/;

export function extractTouchedFilesFromApplyPatch(
	command: string,
	cwd = process.cwd(),
): string[] {
	const files = new Set<string>();

	for (const line of command.split(/\r?\n/)) {
		const match = line.match(TOUCHED_FILE_PATTERN) ?? line.match(MOVED_FILE_PATTERN);
		if (!match) continue;

		const filePath = normalizePatchPath(match[1], cwd);
		if (filePath) {
			files.add(filePath);
		}
	}

	return [...files];
}

function normalizePatchPath(rawPath: string, cwd: string): string | null {
	const trimmed = rawPath.trim();
	if (!trimmed || trimmed === "/dev/null") {
		return null;
	}

	return normalize(isAbsolute(trimmed) ? trimmed : resolve(cwd, trimmed));
}
