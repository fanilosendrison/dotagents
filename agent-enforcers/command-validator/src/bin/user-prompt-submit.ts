#!/usr/bin/env bun

import { approveToken } from "../runtime/override-store";
import { detectRuntime } from "../../../shared/runtime/detect-runtime";
import {
	getPrompt,
	getSessionId,
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import { respondAdditionalContext } from "../../../shared/runtime/respond";

async function main() {
	const input = await readHookInput();
	if (!input || detectRuntime(input) !== "codex") {
		process.exit(0);
	}

	const match = /^allow-command\s+([A-Za-z0-9_-]+)\s*$/.exec(
		getPrompt(input).trim(),
	);
	if (!match) {
		process.exit(0);
	}

	const approved = await approveToken(getSessionId(input), match[1]);
	if (!approved) {
		console.log(
			JSON.stringify({
				decision: "block",
				reason: "Invalid or expired allow-command token.",
			}),
		);
		process.exit(0);
	}

	respondAdditionalContext(
		"UserPromptSubmit",
		"One-shot command override recorded. Retry the exact same command if it is still needed.",
	);
}

main().catch((error) => {
	console.error("UserPromptSubmit hook error:", error);
	process.exit(2);
});
