#!/usr/bin/env bun

import { detectRuntime } from "../../../shared/runtime/detect-runtime";
import {
	getToolCommand,
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
	exitAllow,
	respondPreToolDecision,
	respondPreToolDeny,
} from "../../../shared/runtime/respond";
import {
	extractCommitMessage,
	isGitCommit,
	validateCommitMessage,
} from "../core/validator";

async function main() {
	const input = await readHookInput();
	if (!input || input.tool_name !== "Bash") {
		process.exit(0);
	}

	const rawCommand = getToolCommand(input);
	const command = typeof rawCommand === "string" ? rawCommand : "";
	if (!command || !isGitCommit(command)) {
		process.exit(0);
	}

	const message = extractCommitMessage(command);
	if (!message) {
		process.exit(0);
	}

	const result = validateCommitMessage(message);
	if (result.valid) {
		const additionalContext = `[commit-msg-validator] ✅ commit message conforme : "${message}"`;
		if (detectRuntime(input) === "claude") {
			respondPreToolDecision(
				"allow",
				`[commit-msg-validator] ✅ "${message}"`,
				additionalContext,
			);
		}
		exitAllow();
	}

	respondPreToolDeny(formatInvalidCommitMessage(message, result.errors));
}

function formatInvalidCommitMessage(message: string, errors: string[]): string {
	return [
		"Commit message invalide :",
		"",
		`  "${message}"`,
		"",
		...errors.map((error) => `  - ${error}`),
		"",
		"Format attendu: <type>(<scope>): <description>",
	].join("\n");
}

main().catch((error) => {
	console.error("commit-msg-validator pre-tool-use error:", error);
	process.exit(2);
});
