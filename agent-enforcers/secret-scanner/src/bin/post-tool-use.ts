#!/usr/bin/env bun

import { detectRuntime } from "../../../shared/runtime/detect-runtime";
import {
	getSessionId,
	getToolCommand,
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
	exitAllow,
	respondAdditionalContext,
} from "../../../shared/runtime/respond";
import { consumeCleanScan } from "../runtime/scan-state";

function isGitCommit(command: string): boolean {
	return /\bgit\s+commit\b/.test(command);
}

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

	if (!(await consumeCleanScan(getSessionId(input), command))) {
		process.exit(0);
	}

	respondAdditionalContext(
		"PostToolUse",
		"[secret-scanner] ✅ aucun secret détecté dans le diff staged",
	);
}

main().catch((error) => {
	console.error("secret-scanner post-tool-use error:", error);
	exitAllow();
});
