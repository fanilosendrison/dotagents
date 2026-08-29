import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import type {
	CodingStandardsReport,
	Finding,
} from "../../../lib/coding-standards-schema/src/index.ts";
import { consolidate, parseArgs } from "../cli.ts";

function mkFinding(overrides: Partial<Finding> = {}): Finding {
	return {
		id: "0123456789abcdef",
		source: "coding-standards",
		axis: "typing",
		severity: "notable",
		file: "src/foo.ts",
		line_start: 10,
		line_end: 12,
		problem: "weak type any",
		evidence: "any used",
		fix_proposal: "use concrete type",
		observable_change: "grep any returns 0 hits",
		...overrides,
	};
}

function mkReport(
	findings: Finding[],
	scopeDigest = "a".repeat(64),
): CodingStandardsReport {
	const summary = {
		critical: 0,
		major: 0,
		notable: 0,
		minor: 0,
		nit: 0,
		design: 0,
	};
	for (const f of findings) summary[f.severity] += 1;
	const blocking = summary.critical > 0 || summary.major > 0;
	return {
		skill: "coding-standards",
		scope_digest: scopeDigest,
		verdict: findings.length === 0 ? "CLEAN" : "ISSUES_FOUND",
		findings,
		summary,
		blocking,
	};
}

describe("parseArgs", () => {
	it("parses all three required args", () => {
		const a = parseArgs([
			"--scanner-json=/a.json",
			"--files-json-dir=/b",
			"--output=/c.json",
		]);
		assert.strictEqual(a.scannerJson, "/a.json");
		assert.strictEqual(a.filesJsonDir, "/b");
		assert.strictEqual(a.output, "/c.json");
	});

	it("throws when scanner-json is missing", () => {
		assert.throws(() => parseArgs(["--files-json-dir=/b", "--output=/c.json"]));
	});

	it("throws when files-json-dir is missing", () => {
		assert.throws(() =>
			parseArgs(["--scanner-json=/a.json", "--output=/c.json"]),
		);
	});

	it("throws when output is missing", () => {
		assert.throws(() =>
			parseArgs(["--scanner-json=/a.json", "--files-json-dir=/b"]),
		);
	});
});

describe("consolidate", () => {
	it("merges scanner + one per-file report", () => {
		const f1 = mkFinding({ id: "1111111111111111", axis: "typing" });
		const f2 = mkFinding({
			id: "2222222222222222",
			axis: "naming",
			severity: "minor",
		});
		const final = consolidate(mkReport([f1]), [mkReport([f2])]);
		assert.strictEqual(final.findings.length, 2);
		assert.strictEqual(final.verdict, "ISSUES_FOUND");
		assert.strictEqual(final.summary.notable, 1);
		assert.strictEqual(final.summary.minor, 1);
	});

	it("produces CLEAN when everything is empty", () => {
		const final = consolidate(mkReport([]), [mkReport([])]);
		assert.strictEqual(final.verdict, "CLEAN");
		assert.strictEqual(final.findings.length, 0);
		assert.strictEqual(final.blocking, false);
	});

	it("deduplicates byte-equivalent findings by id", () => {
		const finding = mkFinding({ id: "dddddddddddddddd", evidence: "same" });
		const final = consolidate(mkReport([finding]), [mkReport([finding])]);
		assert.strictEqual(final.findings.length, 1);
	});

	it("rejects one finding id with conflicting content", () => {
		const scannerFinding = mkFinding({
			id: "eeeeeeeeeeeeeeee",
			evidence: "scanner",
		});
		const agentFinding = mkFinding({
			id: "eeeeeeeeeeeeeeee",
			evidence: "agent",
		});
		assert.throws(
			() => consolidate(mkReport([scannerFinding]), [mkReport([agentFinding])]),
			/conflicting content/i,
		);
	});

	it("recomputes blocking based on merged findings", () => {
		const critical = mkFinding({
			id: "cccccccccccccccc",
			severity: "critical",
		});
		const final = consolidate(mkReport([]), [mkReport([critical])]);
		assert.strictEqual(final.blocking, true);
	});

	it("handles zero per-file reports (scanner only)", () => {
		const f = mkFinding({ id: "abababababababab" });
		const final = consolidate(mkReport([f]), []);
		assert.strictEqual(final.findings.length, 1);
		assert.strictEqual(final.scope_digest, "a".repeat(64));
	});

	it("rejects a per-file report with a divergent scope digest", () => {
		assert.throws(
			() => consolidate(mkReport([]), [mkReport([], "b".repeat(64))]),
			/scope_digest/i,
		);
	});
});

describe("consolidate — schema validation on reads (integration)", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "cs-consolidate-"));
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("consolidate output matches the schema", async () => {
		const { validateReport } = await import(
			"../../../lib/coding-standards-schema/src/index.ts"
		);
		const f = mkFinding({ id: "ffffffffffffffff", severity: "major" });
		const final = consolidate(mkReport([f]), []);
		assert.doesNotThrow(() => validateReport(final));
		assert.strictEqual(final.blocking, true);
	});

	it("reading an invalid per-file JSON throws during parseReport", async () => {
		const { parseReport } = await import(
			"../../../lib/coding-standards-schema/src/index.ts"
		);
		const bad = join(tempDir, "bad.json");
		writeFileSync(bad, '{"skill": "senior-review", "verdict": "CLEAN"}');
		assert.throws(() => parseReport("not json"));
	});
});
