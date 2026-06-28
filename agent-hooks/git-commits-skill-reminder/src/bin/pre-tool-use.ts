#!/usr/bin/env bun

import {
	getToolCommand,
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
	exitAllow,
	respondPreToolDecision,
} from "../../../shared/runtime/respond";

const GIT_COMMIT_PATTERN = /\bgit\s+commit\b/;

async function main(): Promise<void> {
	const input = await readHookInput();
	if (!input || input.tool_name !== "Bash") {
		exitAllow();
	}

	const command = getToolCommand(input);
	if (typeof command !== "string" || !GIT_COMMIT_PATTERN.test(command)) {
		exitAllow();
	}

	respondPreToolDecision(
		"allow",
		"[git-commits-push-skill] rappel contextuel",
		"[git-commits-push-skill] CRITICAL REMINDER : Le skill /git-commits-push doit avoir été invoqué (Skill tool) dans cette conversation AVANT de committer. Si ce n'est pas fait, annule ce commit et invoque /git-commits-push d'abord.",
	);
}

main().catch((error: unknown) => {
	console.error(
		"git-commits-push-skill-reminder error:",
		error instanceof Error ? error.message : String(error),
	);
	process.exit(2);
});
