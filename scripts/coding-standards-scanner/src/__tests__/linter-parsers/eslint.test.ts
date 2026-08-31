import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEslintJson } from "../../lib/linter-parsers/eslint.ts";

// Golden fixture: shape of `eslint --format json` output (trimmed).
const GOLDEN = JSON.stringify([
	{
		filePath: "/repo/src/foo.ts",
		messages: [
			{
				ruleId: "@typescript-eslint/no-explicit-any",
				severity: 1,
				message: "Unexpected any. Specify a different type.",
				line: 12,
				endLine: 12,
				column: 18,
				endColumn: 21,
			},
			{
				ruleId: "no-empty",
				severity: 2,
				message: "Empty block statement.",
				line: 30,
				endLine: 32,
			},
			{
				// parser error — ruleId null, must be dropped
				ruleId: null,
				severity: 2,
				message: "Parsing error",
				line: 1,
			},
		],
	},
	{
		filePath: "/repo/src/bar.ts",
		messages: [],
	},
]);

describe("parseEslintJson", () => {
	it("parses the golden fixture", () => {
		const findings = parseEslintJson(GOLDEN);
		assert.strictEqual(findings.length, 2);

		const any = findings.find(
			(f) => f.ruleId === "@typescript-eslint/no-explicit-any",
		);
		assert.notStrictEqual(any, undefined);
		assert.strictEqual(any?.file, "/repo/src/foo.ts");
		assert.strictEqual(any?.line_start, 12);
		assert.strictEqual(any?.line_end, 12);

		const empty = findings.find((f) => f.ruleId === "no-empty");
		assert.notStrictEqual(empty, undefined);
		assert.strictEqual(empty?.line_start, 30);
		assert.strictEqual(empty?.line_end, 32);
	});

	it("returns [] on empty input", () => {
		assert.deepStrictEqual(parseEslintJson(""), []);
	});

	it("returns [] on invalid JSON", () => {
		assert.deepStrictEqual(parseEslintJson("not json"), []);
	});

	it("returns [] on non-array JSON", () => {
		assert.deepStrictEqual(parseEslintJson('{"foo":"bar"}'), []);
	});

	it("drops messages with null ruleId (parser errors)", () => {
		const findings = parseEslintJson(GOLDEN);
		assert.strictEqual(
			findings.every((f) => f.ruleId !== null),
			true,
		);
	});
});
