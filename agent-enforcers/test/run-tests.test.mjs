import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildNodeTestArguments, isDirectEntrypoint } from "./run-tests.mjs";

const runnerPath = fileURLToPath(new URL("./run-tests.mjs", import.meta.url));

test("preserves gateway paths in the child Node test process", () => {
	const testPath = path.join(import.meta.dirname, "fixture.test.mjs");
	assert.deepEqual(buildNodeTestArguments([testPath]).slice(0, 2), [
		"--preserve-symlinks",
		"--preserve-symlinks-main",
	]);
});

test("recognizes a lexically preserved main-module path", () => {
	assert.equal(
		isDirectEntrypoint(runnerPath, pathToFileURL(runnerPath).href),
		true,
	);
	assert.equal(
		isDirectEntrypoint(import.meta.filename, pathToFileURL(runnerPath).href),
		false,
	);
});
