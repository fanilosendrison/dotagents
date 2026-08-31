import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { findStackEval, readStackConfig } from "../stack-config.ts";

describe("findStackEval", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "stack-tools-test-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("finds STACK_EVAL.yaml in the same directory", () => {
		writeFileSync(
			join(tempDir, "STACK_EVAL.yaml"),
			"decisions:\n  linter: biome",
		);
		const result = findStackEval(join(tempDir, "src", "file.ts"));
		assert.strictEqual(result, join(tempDir, "STACK_EVAL.yaml"));
	});

	it("finds STACK_EVAL.yaml in parent directory", () => {
		const subDir = join(tempDir, "src", "lib");
		mkdirSync(subDir, { recursive: true });
		writeFileSync(
			join(tempDir, "STACK_EVAL.yaml"),
			"decisions:\n  linter: biome",
		);

		const result = findStackEval(join(subDir, "file.ts"));
		assert.strictEqual(result, join(tempDir, "STACK_EVAL.yaml"));
	});

	it("returns null when no STACK_EVAL.yaml found", () => {
		const result = findStackEval(join(tempDir, "file.ts"));
		assert.strictEqual(result, null);
	});
});

describe("readStackConfig", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "stack-tools-config-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("parses linter and type_checker", async () => {
		const yamlPath = join(tempDir, "STACK_EVAL.yaml");
		writeFileSync(
			yamlPath,
			"decisions:\n  linter: biome\n  type_checker: tsc\n",
		);

		const config = await readStackConfig(yamlPath);
		assert.strictEqual(config.linter, "biome");
		assert.strictEqual(config.typeChecker, "tsc");
	});

	it("normalizes 'none' to null", async () => {
		const yamlPath = join(tempDir, "STACK_EVAL.yaml");
		writeFileSync(
			yamlPath,
			"decisions:\n  linter: none\n  type_checker: none\n",
		);

		const config = await readStackConfig(yamlPath);
		assert.strictEqual(config.linter, null);
		assert.strictEqual(config.typeChecker, null);
	});

	it("handles missing decisions gracefully", async () => {
		const yamlPath = join(tempDir, "STACK_EVAL.yaml");
		writeFileSync(yamlPath, "project_name: test\n");

		const config = await readStackConfig(yamlPath);
		assert.strictEqual(config.linter, null);
		assert.strictEqual(config.typeChecker, null);
	});

	it("handles missing type_checker", async () => {
		const yamlPath = join(tempDir, "STACK_EVAL.yaml");
		writeFileSync(yamlPath, "decisions:\n  linter: ruff\n");

		const config = await readStackConfig(yamlPath);
		assert.strictEqual(config.linter, "ruff");
		assert.strictEqual(config.typeChecker, null);
	});

	it("lowercases values", async () => {
		const yamlPath = join(tempDir, "STACK_EVAL.yaml");
		writeFileSync(
			yamlPath,
			"decisions:\n  linter: Biome\n  type_checker: TSC\n",
		);

		const config = await readStackConfig(yamlPath);
		assert.strictEqual(config.linter, "biome");
		assert.strictEqual(config.typeChecker, "tsc");
	});
});
