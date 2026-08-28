import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const skillDirectory = resolve(testDirectory, "..");
const validatorPath = resolve(skillDirectory, "dist", "quick-validate.mjs");
const testFiles = [resolve(testDirectory, "quick-validate.test.mjs")];

if (!existsSync(validatorPath)) {
	throw new Error(`Compiled validator not found: ${validatorPath}`);
}
for (const testFile of testFiles) {
	if (!existsSync(testFile)) {
		throw new Error(`Expected test file not found: ${testFile}`);
	}
}
if (testFiles.length === 0) {
	throw new Error("No skill validator tests configured");
}

const result = spawnSync(
	process.execPath,
	[
		"--test",
		"--test-concurrency=1",
		"--test-timeout=30000",
		"--test-reporter=tap",
		...testFiles,
	],
	{
		env: {
			...process.env,
			SKILL_VALIDATOR_CLI: validatorPath,
		},
		stdio: "inherit",
		timeout: 120_000,
	},
);

if (result.error) {
	throw result.error;
}
if (result.status === null) {
	throw new Error(
		`Skill validator tests terminated by ${result.signal ?? "unknown signal"}`,
	);
}
process.exitCode = result.status;
