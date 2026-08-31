import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FIXED_TEST_TIMEOUT_MILLISECONDS = 30_000;
export const EXPECTED_NODE_TEST_FILES = Object.freeze([
	"command-validator/src/core/__tests__/runtime-contract.test.ts",
	"command-validator/src/core/__tests__/validator.test.ts",
	"git-commits-push-enforcer/src/core/__tests__/trust-store.test.ts",
	"git-commits-push-enforcer/src/core/__tests__/validator.test.ts",
	"path-guard/src/core/__tests__/path-guard.test.ts",
	"permission-enforcer/src/core/__tests__/state.test.ts",
]);

export async function resolveExpectedTestFiles(enforcersDirectory) {
	const absoluteEnforcersDirectory = path.resolve(enforcersDirectory);
	const resolvedTestFiles = [];
	for (const expectedTestFile of EXPECTED_NODE_TEST_FILES) {
		const absoluteTestFile = path.resolve(
			absoluteEnforcersDirectory,
			expectedTestFile,
		);
		const relativeTestFile = path.relative(
			absoluteEnforcersDirectory,
			absoluteTestFile,
		);
		if (
			relativeTestFile.length === 0 ||
			relativeTestFile === ".." ||
			relativeTestFile.startsWith(`..${path.sep}`) ||
			path.isAbsolute(relativeTestFile)
		) {
			throw new Error(
				`Expected Node test path must stay inside agent-enforcers: ${JSON.stringify(expectedTestFile)}`,
			);
		}
		const stats = await stat(absoluteTestFile);
		if (!stats.isFile()) {
			throw new Error(`Expected Node test path is not a file: ${expectedTestFile}`);
		}
		resolvedTestFiles.push(absoluteTestFile);
	}
	return resolvedTestFiles;
}

export function buildNodeTestArguments(resolvedTestFiles) {
	return [
		"--test",
		"--test-concurrency=1",
		`--test-timeout=${FIXED_TEST_TIMEOUT_MILLISECONDS}`,
		"--test-reporter=tap",
		...resolvedTestFiles,
	];
}

export async function runExpectedNodeTests(enforcersDirectory) {
	const resolvedTestFiles = await resolveExpectedTestFiles(enforcersDirectory);
	const result = spawnSync(process.execPath, buildNodeTestArguments(resolvedTestFiles), {
		cwd: path.resolve(enforcersDirectory, ".."),
		env: process.env,
		shell: false,
		stdio: "inherit",
	});
	if (result.error) {
		throw new Error(`Unable to start the Node test runner: ${result.error.message}`, {
			cause: result.error,
		});
	}
	if (result.status === null) {
		throw new Error(
			`Node test runner terminated without an exit code${result.signal ? ` (${result.signal})` : ""}`,
		);
	}
	return result.status;
}

function isDirectEntrypoint() {
	const entrypointPath = process.argv[1];
	return (
		entrypointPath !== undefined &&
		pathToFileURL(realpathSync(path.resolve(entrypointPath))).href === import.meta.url
	);
}

if (isDirectEntrypoint()) {
	try {
		process.exitCode = await runExpectedNodeTests(
			path.resolve(import.meta.dirname, ".."),
		);
	} catch (error) {
		process.stderr.write(
			`Node test runner failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	}
}
