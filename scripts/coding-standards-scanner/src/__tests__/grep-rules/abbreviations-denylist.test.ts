import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { abbreviationsDenylistRule } from "../../lib/grep-rules/abbreviations-denylist.ts";

describe("abbreviationsDenylistRule", () => {
	it("catches denied abbreviations", () => {
		const text = `const mgr = new Manager();\nconst foo = 1;\n`;
		const findings = abbreviationsDenylistRule.scan("x.ts", text);
		assert.strictEqual(findings.length, 2);
	});

	it("does not flag Manager (substring of mgr in word boundary terms)", () => {
		const text = `const manager = new Manager();\n`;
		assert.deepStrictEqual(abbreviationsDenylistRule.scan("x.ts", text), []);
	});

	it("flags xxx in Python", () => {
		const text = `def xxx():\n    pass\n`;
		const findings = abbreviationsDenylistRule.scan("x.py", text);
		assert.strictEqual(findings.length, 1);
	});

	it("flags the canonical proc_dat example", () => {
		const text = `let proc_dat = 42;\n`;
		const findings = abbreviationsDenylistRule.scan("x.ts", text);
		assert.strictEqual(findings.length, 1);
	});
});
