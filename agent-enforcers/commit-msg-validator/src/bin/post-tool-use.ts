#!/usr/bin/env bun

import { detectRuntime } from "../../../shared/runtime/detect-runtime";
import {
	getToolCommand,
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
	exitAllow,
	respondAdditionalContext,
} from "../../../shared/runtime/respond";
import {
	extractCommitMessage,
	isGitCommit,
	validateCommitMessage,
} from "../core/validator";

async function main() {
	const input = await readHookInput();
	if (!input || detectRuntime(input) !== "codex" || input.tool_name !== "Bash") {
		process.exit(0);
	}

	const rawCommand = getToolCommand(input);
	const command = typeof rawCommand === "string" ? rawCommand : "";
	if (!command || !isGitCommit(command)) {
		process.exit(0);
	}

	const message = extractCommitMessage(command);
	if (!message || !validateCommitMessage(message).valid) {
		process.exit(0);
	}

	respondAdditionalContext(
		"PostToolUse",
		`[commit-msg-validator] ✅ commit message conforme : "${message}"`,
	);
}

main().catch((error) => {
	console.error("commit-msg-validator post-tool-use error:", error);
	exitAllow();
});
