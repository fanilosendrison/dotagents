import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRuffJson } from "../../lib/linter-parsers/ruff.ts";

// Golden fixture from `ruff check --output-format json`.
const GOLDEN = JSON.stringify([
	{
		code: "E722",
		filename: "/repo/src/foo.py",
		message: "Do not use bare `except`",
		location: { row: 14, column: 5 },
		end_location: { row: 14, column: 12 },
		fix: null,
	},
	{
		code: "D103",
		filename: "/repo/src/foo.py",
		message: "Missing docstring in public function",
		location: { row: 3, column: 1 },
		end_location: { row: 3, column: 10 },
	},
]);

describe("parseRuffJson", () => {
	it("parses the golden fixture", () => {
		const findings = parseRuffJson(GOLDEN);
		assert.strictEqual(findings.length, 2);
		assert.strictEqual(findings[0]?.ruleId, "E722");
		assert.strictEqual(findings[0]?.file, "/repo/src/foo.py");
		assert.strictEqual(findings[0]?.line_start, 14);
		assert.strictEqual(findings[1]?.ruleId, "D103");
		assert.strictEqual(findings[1]?.line_start, 3);
	});

	it("returns [] on empty output", () => {
		assert.deepStrictEqual(parseRuffJson(""), []);
		assert.deepStrictEqual(parseRuffJson("[]"), []);
	});

	it("returns [] on malformed JSON", () => {
		assert.deepStrictEqual(parseRuffJson("not json"), []);
	});
});
