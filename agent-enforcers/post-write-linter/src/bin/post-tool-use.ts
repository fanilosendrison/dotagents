#!/usr/bin/env bun

import { checkFile } from "../core/linter";
import {
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
	exitAllow,
	respondPostToolBlock,
} from "../../../shared/runtime/respond";
import { extractTouchedFilesFromApplyPatch } from "../core/patch-files";

function getTouchedFiles(input: Awaited<ReturnType<typeof readHookInput>>): string[] {
	if (!input || input.hook_event_name !== "PostToolUse") {
		return [];
	}

	if (
		(input.tool_name === "Write" || input.tool_name === "Edit") &&
		typeof input.tool_input?.file_path === "string" &&
		input.tool_input.file_path
	) {
		return [input.tool_input.file_path];
	}

	if (
		input.tool_name === "apply_patch" &&
		typeof input.tool_input?.command === "string" &&
		input.tool_input.command.trim()
	) {
		return extractTouchedFilesFromApplyPatch(
			input.tool_input.command,
			input.cwd || process.cwd(),
		);
	}

	return [];
}

async function main(): Promise<void> {
	const input = await readHookInput();
	const files = getTouchedFiles(input);
	const failures: string[] = [];

	for (const file of files) {
		const result = checkFile(file);
		if (!result.success && result.output) {
			failures.push(`Biome errors in ${file}:\n\n${result.output}`);
		}
	}

	if (failures.length > 0) {
		respondPostToolBlock(failures.join("\n\n---\n\n"));
	}

	exitAllow();
}

main().catch((error: unknown) => {
	console.error(
		"post-write-linter post-tool-use error:",
		error instanceof Error ? error.message : String(error),
	);
	exitAllow();
});
