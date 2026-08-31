import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { debugStatementsRule } from "../../lib/grep-rules/debug-statements.ts";

describe("debugStatementsRule", () => {
	it("detects console.log in TypeScript", () => {
		const text = `function foo() {\n  console.log("hello");\n  return 1;\n}\n`;
		const findings = debugStatementsRule.scan("x.ts", text);
		assert.strictEqual(findings.length, 1);
		assert.strictEqual(findings[0]?.line_start, 2);
		assert.strictEqual(findings[0]?.ruleId, "grep/debug-statements");
	});

	it("detects debugger statement", () => {
		const text = `function foo() {\n  debugger;\n}\n`;
		const findings = debugStatementsRule.scan("x.ts", text);
		assert.strictEqual(findings.length, 1);
		assert.strictEqual(findings[0]?.line_start, 2);
	});

	it("detects print() in Python", () => {
		const text = `def foo():\n    print("hi")\n    return 1\n`;
		const findings = debugStatementsRule.scan("x.py", text);
		assert.strictEqual(findings.length, 1);
		assert.strictEqual(findings[0]?.line_start, 2);
	});

	it("applies to supported extensions only", () => {
		assert.strictEqual(debugStatementsRule.applies("x.ts"), true);
		assert.strictEqual(debugStatementsRule.applies("x.py"), true);
		assert.strictEqual(debugStatementsRule.applies("x.sh"), false);
		assert.strictEqual(debugStatementsRule.applies("x.md"), false);
	});

	it("returns empty when no debug statement present", () => {
		const text = `function foo() {\n  return 1;\n}\n`;
		assert.deepStrictEqual(debugStatementsRule.scan("x.ts", text), []);
	});
});
