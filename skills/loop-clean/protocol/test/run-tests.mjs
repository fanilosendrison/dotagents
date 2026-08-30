import { spawnSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const FIXED_TEST_TIMEOUT_MILLISECONDS = 180_000;
export const EXPECTED_PORTABLE_TEST_FILES = Object.freeze([
	"portable/autonomy.test.ts",
	"portable/controller-e2e.test.ts",
	"portable/findings.test.ts",
	"portable/git-invariants.test.ts",
	"portable/lockfile-contract.test.ts",
	"portable/routing.test.ts",
	"portable/runtime-gate.test.ts",
	"portable/scope.test.ts",
]);
export const EXPECTED_REPOSITORY_TEST_FILES = Object.freeze([
	"repository/static-contract.test.ts",
]);

function selectedTestFiles(suite) {
	if (suite === undefined || suite === "all") {
		return [...EXPECTED_PORTABLE_TEST_FILES, ...EXPECTED_REPOSITORY_TEST_FILES];
	}
	if (suite === "portable") return [...EXPECTED_PORTABLE_TEST_FILES];
	if (suite === "repository") return [...EXPECTED_REPOSITORY_TEST_FILES];
	throw new Error(`Unknown Node test suite: ${JSON.stringify(suite)}`);
}

export async function resolveExpectedTestFiles(
	testDirectory,
	expectedTestFiles,
) {
	const absoluteTestDirectory = path.resolve(testDirectory);
	const resolvedTestFiles = [];
	for (const expectedTestFile of expectedTestFiles) {
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

export async function runExpectedNodeTests(testDirectory, suite) {
	const resolvedTestFiles = await resolveExpectedTestFiles(
		testDirectory,
		selectedTestFiles(suite),
	);
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
		process.exitCode = await runExpectedNodeTests(
			import.meta.dirname,
			process.argv[2],
		);
	} catch (error) {
		process.stderr.write(
			`Node test runner failed: ${error instanceof Error ? error.message : String(error)}\n`,
		);
		process.exitCode = 1;
	}
}
