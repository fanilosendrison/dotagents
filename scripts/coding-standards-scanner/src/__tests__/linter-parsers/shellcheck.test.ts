import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseShellcheckJson } from "../../lib/linter-parsers/shellcheck.ts";

const GOLDEN = JSON.stringify([
	{
		file: "/repo/bin/deploy.sh",
		line: 23,
		endLine: 23,
		column: 1,
		endColumn: 4,
		level: "warning",
		code: 2164,
		message: "Use 'cd ... || exit' or 'cd ... || return' in case cd fails.",
	},
	{
		file: "/repo/bin/deploy.sh",
		line: 8,
		endLine: 8,
		column: 1,
		endColumn: 7,
		level: "info",
		code: 2034,
		message: "variable appears unused",
	},
]);

describe("parseShellcheckJson", () => {
	it("parses the golden fixture", () => {
		const findings = parseShellcheckJson(GOLDEN);
		assert.strictEqual(findings.length, 2);
		assert.strictEqual(findings[0]?.ruleId, "SC2164");
		assert.strictEqual(findings[0]?.line_start, 23);
		assert.strictEqual(findings[1]?.ruleId, "SC2034");
	});

	it("prefixes numeric codes with SC", () => {
		const findings = parseShellcheckJson(GOLDEN);
		assert.strictEqual(
			findings.every((f) => f.ruleId.startsWith("SC")),
			true,
		);
	});

	it("returns [] on empty output", () => {
		assert.deepStrictEqual(parseShellcheckJson(""), []);
		assert.deepStrictEqual(parseShellcheckJson("[]"), []);
	});
});
