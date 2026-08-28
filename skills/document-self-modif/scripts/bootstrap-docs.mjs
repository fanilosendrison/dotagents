#!/usr/bin/env node
/**
 * Bootstrap a new harness docs/<topic>/ from a single JSON blob.
 * Reads JSON from stdin and applies the pure transformations from lib.mjs.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	computeNextIndex,
	formatIndexEntry,
	formatQuickNavRow,
	insertFolderEntry,
	insertQuickNavRow,
	validateInput,
} from "./lib.mjs";

function writeOutput(message) {
	process.stdout.write(`${message}\n`);
}

function writeError(message) {
	process.stderr.write(`ERROR: ${message}\n`);
}

async function readStandardInput() {
	let input = "";
	for await (const chunk of process.stdin) {
		input += Buffer.from(chunk).toString("utf8");
	}
	return input;
}

async function main() {
	let input;
	try {
		input = JSON.parse(await readStandardInput());
	} catch {
		writeError("invalid JSON on stdin");
		return 1;
	}

	const validationError = validateInput(input);
	if (validationError !== null) {
		writeError(validationError);
		return 1;
	}

	const { action, content, date, description, title, topic } = input;
	const harnessDirectory = join(homedir(), ".pi", "agent");
	const documentPath = join(harnessDirectory, "docs", `${topic}.md`);
	writeFileSync(documentPath, content, "utf8");
	writeOutput(`✓ docs/${topic}.md`);

	const indexPath = join(harnessDirectory, "docs", "CONTEXT.md");
	const indexContent = readFileSync(indexPath, "utf8");
	const nextIndex = computeNextIndex(indexContent);
	writeFileSync(
		indexPath,
		indexContent + formatIndexEntry(nextIndex, title, date, topic),
		"utf8",
	);
	writeOutput(`✓ docs/CONTEXT.md (entry ${nextIndex})`);

	const routerPath = join(harnessDirectory, "CONTEXT.md");
	const quickNavigationRow = formatQuickNavRow(action, topic, description);
	const quickNavigationContent = insertQuickNavRow(
		readFileSync(routerPath, "utf8"),
		quickNavigationRow,
	);
	writeFileSync(routerPath, quickNavigationContent, "utf8");
	writeOutput("✓ Quick Navigation row");

	try {
		const folderStructureContent = insertFolderEntry(
			quickNavigationContent,
			topic,
			description,
		);
		writeFileSync(routerPath, folderStructureContent, "utf8");
		writeOutput(`✓ Folder Structure (docs/${topic}.md)`);
	} catch (error) {
		writeError(error instanceof Error ? error.message : String(error));
		return 1;
	}

	writeOutput("Done.");
	return 0;
}

process.exitCode = await main();
