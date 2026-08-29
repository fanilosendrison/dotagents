import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const packageDirectory = path.resolve(import.meta.dirname, "..");
let temporaryDirectory;

function runNode(entrypoint, args, cwd = packageDirectory) {
	return spawnSync(process.execPath, [entrypoint, ...args], {
		cwd,
		env: process.env,
		encoding: "utf8",
		shell: false,
	});
}

before(() => {
	temporaryDirectory = mkdtempSync(path.join(tmpdir(), "scripts-node-cli-"));
});

after(() => {
	if (temporaryDirectory !== undefined) {
		rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

describe("Node script CLIs", () => {
	it("runs the scanner and writes a schema-valid clean report", () => {
		const sourceDirectory = path.join(temporaryDirectory, "scanner", "src");
		mkdirSync(sourceDirectory, { recursive: true });
		writeFileSync(
			path.join(sourceDirectory, "clean.ts"),
			"export const value = 1;\n",
		);
		const outputPath = path.join(temporaryDirectory, "scanner-report.json");
		const result = runNode(
			path.join(packageDirectory, "coding-standards-scanner", "src", "cli.ts"),
			["--scope=path", `--path=${sourceDirectory}`, `--output=${outputPath}`],
			path.join(temporaryDirectory, "scanner"),
		);
		assert.strictEqual(result.status, 0, result.stderr);
		const report = JSON.parse(readFileSync(outputPath, "utf8"));
		assert.strictEqual(report.skill, "coding-standards");
		assert.strictEqual(report.verdict, "CLEAN");
		assert.match(report.scope_digest, /^[0-9a-f]{64}$/);
	});

	it("runs the consolidator and preserves an empty scanner report", () => {
		const scannerPath = path.join(temporaryDirectory, "input-scanner.json");
		const outputPath = path.join(temporaryDirectory, "consolidated.json");
		writeFileSync(
			scannerPath,
			`${JSON.stringify({
				skill: "coding-standards",
				scope_digest: "a".repeat(64),
				verdict: "CLEAN",
				findings: [],
				summary: {
					critical: 0,
					major: 0,
					notable: 0,
					minor: 0,
					nit: 0,
					design: 0,
				},
				blocking: false,
			})}\n`,
		);
		const result = runNode(
			path.join(
				packageDirectory,
				"coding-standards-consolidate",
				"src",
				"cli.ts",
			),
			[
				`--scanner-json=${scannerPath}`,
				`--files-json-dir=${path.join(temporaryDirectory, "absent-files")}`,
				`--output=${outputPath}`,
			],
		);
		assert.strictEqual(result.status, 0, result.stderr);
		const report = JSON.parse(readFileSync(outputPath, "utf8"));
		assert.strictEqual(report.verdict, "CLEAN");
		assert.deepStrictEqual(report.findings, []);
	});

	it("runs the Claude facade gitignore command through Node", () => {
		const result = runNode(
			path.join(packageDirectory, "claude-facade", "src", "cli.ts"),
			["gitignore-rules"],
		);
		assert.strictEqual(result.status, 0, result.stderr);
		assert.strictEqual(result.stdout.includes("/skills/loop-clean"), true);
		assert.strictEqual(
			result.stdout.includes("/scripts/coding-standards-scanner"),
			true,
		);
	});
});
