import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FIXED_TEST_TIMEOUT_MILLISECONDS = 60_000;
export const EXPECTED_NODE_TEST_FILES = Object.freeze([
	"stage-harness/acceptance/run-stage.acceptance.test.ts",
	"stage-harness/properties/run-stage.properties.test.ts",
]);

export async function resolveExpectedTestFiles(testDirectory) {
	const absoluteTestDirectory = path.resolve(testDirectory);
	const resolvedTestFiles = [];
	for (const expectedTestFile of EXPECTED_NODE_TEST_FILES) {
		const absoluteTestFile = path.resolve(
			absoluteTestDirectory,
			expectedTestFile,
		);
		const relativeTestFile = path.relative(
			absoluteTestDirectory,
			absoluteTestFile,
		);
		if (
			relativeTestFile.length === 0 ||
			relativeTestFile === ".." ||
			relativeTestFile.startsWith(`..${path.sep}`) ||
			path.isAbsolute(relativeTestFile)
		) {
			throw new Error(
				`Expected Node test path must stay inside the package test directory: ${JSON.stringify(expectedTestFile)}`,
			);
		}
		const stats = await stat(absoluteTestFile);
		if (!stats.isFile()) {
			throw new Error(
				`Expected Node test path is not a file: ${expectedTestFile}`,
			);
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

export async function runExpectedNodeTests(testDirectory) {
	const resolvedTestFiles = await resolveExpectedTestFiles(testDirectory);
	const result = spawnSync(
		process.execPath,
		buildNodeTestArguments(resolvedTestFiles),
		{
			cwd: path.resolve(testDirectory, ".."),
			env: process.env,
			shell: false,
			stdio: "inherit",
		},
	);
	if (result.error) {
		throw new Error(
			`Unable to start the Node test runner: ${result.error.message}`,
			{
				cause: result.error,
			},
		);
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
		pathToFileURL(path.resolve(entrypointPath)).href === import.meta.url
	);
}

if (isDirectEntrypoint()) {
	try {
		process.exitCode = await runExpectedNodeTests(import.meta.dirname);
	} catch (error) {
		process.stderr.write(
			`Node test runner failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	}
}
