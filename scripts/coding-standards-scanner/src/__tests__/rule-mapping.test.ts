import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { axisForRule, RULE_TO_AXIS } from "../lib/rule-mapping.ts";

describe("axisForRule", () => {
	it("returns the declared axis for known rules", () => {
		assert.strictEqual(axisForRule("no-empty"), "error-handling");
		assert.strictEqual(
			axisForRule("@typescript-eslint/no-explicit-any"),
			"typing",
		);
		assert.strictEqual(axisForRule("complexity"), "maintainability");
		assert.strictEqual(axisForRule("prefer-const"), "immutability");
	});

	it("returns null for out-of-scope rules (dedup-codebase territory)", () => {
		assert.strictEqual(axisForRule("no-unused-vars"), null);
		assert.strictEqual(axisForRule("@typescript-eslint/no-unused-vars"), null);
		assert.strictEqual(axisForRule("SC2034"), null);
	});

	it("returns null for unknown rules", () => {
		assert.strictEqual(axisForRule("never-heard-of-it"), null);
	});

	it("handles shellcheck SC codes", () => {
		assert.strictEqual(axisForRule("SC2164"), "error-handling");
		assert.strictEqual(axisForRule("SC2086"), null);
	});

	it("maps grep rule ids to their axes", () => {
		assert.strictEqual(axisForRule("grep/debug-statements"), "maintainability");
		assert.strictEqual(axisForRule("grep/abbreviations-denylist"), "naming");
		assert.strictEqual(axisForRule("grep/any-without-justif"), "typing");
	});

	it("mapping table is non-empty", () => {
		assert.ok(Object.keys(RULE_TO_AXIS).length > 10);
	});
});
