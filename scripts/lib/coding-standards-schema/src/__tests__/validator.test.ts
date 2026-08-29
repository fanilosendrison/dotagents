import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FindingSchema, parseReport, validateReport } from "../validator.ts";

const validFinding = {
	id: "0123456789abcdef",
	source: "coding-standards",
	axis: "typing",
	severity: "notable",
	file: "src/foo.ts",
	line_start: 10,
	line_end: 12,
	problem: "weak type any in foo return",
	evidence: "return value typed as any",
	fix_proposal: "Replace any with FooReturn",
	observable_change: "grep '\\bany\\b' src/foo.ts returns 0 hits on that line",
};

const validReport = {
	skill: "coding-standards",
	scope_digest: "a".repeat(64),
	verdict: "ISSUES_FOUND",
	findings: [validFinding],
	summary: {
		critical: 0,
		major: 0,
		notable: 1,
		minor: 0,
		nit: 0,
		design: 0,
	},
	blocking: false,
};

describe("FindingSchema", () => {
	it("accepts a valid finding", () => {
		assert.doesNotThrow(() => FindingSchema.parse(validFinding));
	});

	it("rejects a bad id (not hex)", () => {
		const bad = { ...validFinding, id: "NOT_HEX_XXXXXXXX" };
		assert.throws(() => FindingSchema.parse(bad));
	});

	it("rejects an id of wrong length", () => {
		const bad = { ...validFinding, id: "abcdef" };
		assert.throws(() => FindingSchema.parse(bad));
	});

	it("rejects an unknown axis", () => {
		const bad = { ...validFinding, axis: "not-an-axis" };
		assert.throws(() => FindingSchema.parse(bad));
	});

	it("rejects an unknown severity", () => {
		const bad = { ...validFinding, severity: "catastrophic" };
		assert.throws(() => FindingSchema.parse(bad));
	});

	it("rejects empty observable_change when severity != design", () => {
		const bad = { ...validFinding, observable_change: "" };
		assert.throws(() => FindingSchema.parse(bad));
	});

	it("allows empty observable_change when severity = design", () => {
		const ok = {
			...validFinding,
			severity: "design",
			observable_change: "",
		};
		assert.doesNotThrow(() => FindingSchema.parse(ok));
	});

	it("accepts null line_start / line_end", () => {
		const ok = { ...validFinding, line_start: null, line_end: null };
		assert.doesNotThrow(() => FindingSchema.parse(ok));
	});

	it("rejects non-'coding-standards' source", () => {
		const bad = { ...validFinding, source: "senior-review" };
		assert.throws(() => FindingSchema.parse(bad));
	});
});

describe("ReportSchema", () => {
	it("accepts a valid report", () => {
		assert.doesNotThrow(() => validateReport(validReport));
	});

	it("accepts a CLEAN empty report", () => {
		const empty = {
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
		};
		assert.doesNotThrow(() => validateReport(empty));
	});

	it("rejects report with wrong skill label", () => {
		const bad = { ...validReport, skill: "senior-review" };
		assert.throws(() => validateReport(bad));
	});

	it("rejects a missing scope digest", () => {
		const { scope_digest: _omit, ...bad } = validReport;
		assert.throws(() => validateReport(bad));
	});

	it("rejects report with invalid verdict", () => {
		const bad = { ...validReport, verdict: "MAYBE" };
		assert.throws(() => validateReport(bad));
	});

	it("rejects report missing summary", () => {
		const { summary: _omit, ...rest } = validReport as {
			summary: unknown;
			[k: string]: unknown;
		};
		assert.throws(() => validateReport(rest));
	});

	it("parseReport round-trips", () => {
		const parsed = parseReport(JSON.stringify(validReport));
		assert.strictEqual(parsed.findings[0]?.id, validFinding.id);
		assert.strictEqual(parsed.verdict, "ISSUES_FOUND");
	});

	it("parseReport throws on invalid JSON", () => {
		assert.throws(() => parseReport("not json"));
	});
});
