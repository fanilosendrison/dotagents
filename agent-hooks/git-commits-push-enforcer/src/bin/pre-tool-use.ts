#!/usr/bin/env bun

import {
	getToolCommand,
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
	respondPreToolDeny,
} from "../../../shared/runtime/respond";

const GIT_COMMIT = /git\s+commit\b/;
const CC_REGEX = /^[a-z]+(\([^)]+\))?!?:\s\S/;

function extractMessage(command: string): string | null {
	const heredoc = command.match(/<<'?EOF'?\s*\n([\s\S]*?)\n\s*EOF/);
	if (heredoc) {
		const lines = heredoc[1].split("\n").map((l) => l.trim()).filter((l) => l);
		return lines[0] || null;
	}
	const dq = command.match(/-m\s+"([\s\S]*?)"/);
	if (dq) return dq[1].split("\n")[0].trim() || null;
	const sq = command.match(/-m\s+'([\s\S]*?)'/);
	if (sq) return sq[1].split("\n")[0].trim() || null;
	return null;
}

async function main(): Promise<void> {
	const input = await readHookInput();
	if (!input || input.tool_name !== "Bash") {
		process.exit(0);
	}

	const command = getToolCommand(input);
	if (typeof command !== "string" || !GIT_COMMIT.test(command)) {
		process.exit(0);
	}

	// Allow git commit without -m (interactive editor)
	const msg = extractMessage(command);
	if (msg === null) {
		process.exit(0);
	}

	// Block if the inline message doesn't look like Conventional Commits
	if (!CC_REGEX.test(msg)) {
		respondPreToolDeny(
			"Use /git-commits-push to generate a Conventional Commits message.\n" +
			`Got: "${msg.slice(0, 60)}" — expected: <type>(<scope>): <description>`,
		);
	}

	// Block if commit is not followed by push
	if (!/git\s+push/.test(command)) {
		respondPreToolDeny(
			"Always push after commit. Use: git commit ... && git push\n" +
			"Or invoke /git-commits-push which handles this automatically.",
		);
	}

	// Message is valid and push is present — allow
	process.exit(0);
}

main().catch((error: unknown) => {
	console.error(
		"git-commits-skill-reminder error:",
		error instanceof Error ? error.message : String(error),
	);
	process.exit(2);
});
