#!/usr/bin/env bun

import { existsSync } from "node:fs";
import {
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
	exitAllow,
	respondPostToolBlock,
} from "../../../shared/runtime/respond";
import {
	findStackEval,
	isCodeFile,
	isLinterCompatible,
	readStackConfig,
	runLintPipeline,
} from "../../../../../.claude/scripts/lib/stack-tools/src/index.ts";
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
		if (!existsSync(file) || !isCodeFile(file)) {
			continue;
		}

		const stackEvalPath = findStackEval(file);
		if (!stackEvalPath) {
			continue;
		}

		const config = await readStackConfig(stackEvalPath);
		if (!config.linter && !config.typeChecker) {
			continue;
		}

		if (config.linter && !isLinterCompatible(config.linter, file)) {
			continue;
		}

		const pipeline = await runLintPipeline(config, file);
		if (!pipeline.hasErrors) {
			continue;
		}

		const errorDetails = pipeline.results
			.filter((result) => !result.success)
			.map((result) => `[${result.phase}/${result.tool}] ${result.output}`)
			.join("\n\n");

		failures.push(`Lint/format errors in ${file}:\n\n${errorDetails}`);
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
