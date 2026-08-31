import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anyWithoutJustifRule } from "../../lib/grep-rules/any-without-justif.ts";

describe("anyWithoutJustifRule", () => {
	it("flags `any` used as a type", () => {
		const text = `function foo(x: any): void {}\n`;
		const findings = anyWithoutJustifRule.scan("x.ts", text);
		assert.strictEqual(findings.length, 1);
		assert.strictEqual(findings[0]?.line_start, 1);
	});

	it("skips when the preceding line has a justification comment", () => {
		const text = `// justification: third-party untyped lib\nfunction foo(x: any): void {}\n`;
		assert.deepStrictEqual(anyWithoutJustifRule.scan("x.ts", text), []);
	});

	it("skips when the line has a biome-ignore comment", () => {
		const text = `// biome-ignore lint/suspicious/noExplicitAny: untyped\nfunction foo(x: any): void {}\n`;
		assert.deepStrictEqual(anyWithoutJustifRule.scan("x.ts", text), []);
	});

	it("skips when the line has an eslint-disable-next-line", () => {
		const text = `// eslint-disable-next-line @typescript-eslint/no-explicit-any\nfunction foo(x: any): void {}\n`;
		assert.deepStrictEqual(anyWithoutJustifRule.scan("x.ts", text), []);
	});

	it("applies only to .ts/.tsx", () => {
		assert.strictEqual(anyWithoutJustifRule.applies("x.ts"), true);
		assert.strictEqual(anyWithoutJustifRule.applies("x.tsx"), true);
		assert.strictEqual(anyWithoutJustifRule.applies("x.js"), false);
		assert.strictEqual(anyWithoutJustifRule.applies("x.py"), false);
	});

	it("flags `as any` casts", () => {
		const text = `const x = payload as any;\n`;
		const findings = anyWithoutJustifRule.scan("x.ts", text);
		assert.strictEqual(findings.length, 1);
	});
});
