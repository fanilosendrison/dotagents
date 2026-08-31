import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildDocTree,
	computeNextIndex,
	findDocsSection,
	formatIndexEntry,
	insertFolderEntry,
	parseDocEntries,
	validateInput,
} from "../lib.mjs";

describe("lib", () => {
	describe("validateInput", () => {
		it("returns null for valid input with all fields", () => {
			assert.equal(
				validateInput({
					action: "a",
					content: "c",
					date: "d",
					description: "d",
					title: "t",
					topic: "t",
					trigger: "tr",
					wiring: "w",
				}),
				null,
			);
		});

		it("returns null for valid input without optional fields", () => {
			assert.equal(
				validateInput({
					action: "a",
					content: "c",
					date: "d",
					description: "d",
					title: "t",
					topic: "t",
				}),
				null,
			);
		});

		it("returns error if missing required field", () => {
			assert.ok(
				validateInput({ topic: "t" })?.includes('field "title" is required'),
			);
		});

		it("returns error if field is empty string", () => {
			assert.ok(
				validateInput({
					action: "a",
					content: "c",
					date: "d",
					description: "d",
					title: "",
					topic: "t",
				})?.includes("must not be empty"),
			);
		});
	});

	describe("computeNextIndex", () => {
		it("returns 1 for empty index", () => {
			assert.equal(computeNextIndex(""), 1);
		});

		it("returns max + 1", () => {
			assert.equal(computeNextIndex("### 1. A\n### 5. B\n"), 6);
		});
	});

	describe("formatIndexEntry", () => {
		it("formats minimal entry without wiring/trigger", () => {
			const entry = formatIndexEntry(2, "Test Tool", "2026-06-29", "test-tool");
			assert.ok(entry.includes("### 2. Test Tool"));
			assert.ok(entry.includes("- **Date** : 2026-06-29"));
			assert.ok(entry.includes("[`test-tool.md`](test-tool.md)"));
			assert.ok(!entry.includes("**Wiring**"));
			assert.ok(!entry.includes("**Trigger**"));
		});

		it("includes wiring and trigger when provided", () => {
			const entry = formatIndexEntry(
				3,
				"Scanner",
				"2026-07-04",
				"scanner",
				"Pi ext + pre-hook",
				"git commit",
			);
			assert.ok(entry.includes("### 3. Scanner"));
			assert.ok(entry.includes("- **Wiring** : Pi ext + pre-hook"));
			assert.ok(entry.includes("- **Trigger** : git commit"));
		});
	});

	describe("Folder Structure parsing", () => {
		const lines = [
			"~/.agents/",
			"├── AGENTS.md",
			"├── docs/",
			"│   ├── CONTEXT.md",
			"│   ├── alpha.md",
			"│   └── zulu.md",
			"├── agent-enforcers/",
			"└── skills/",
		];

		it("findDocsSection finds boundaries", () => {
			assert.deepEqual(findDocsSection(lines), { start: 2, end: 6 });
		});

		it("parseDocEntries extracts entries, CONTEXT.md is treated as entry", () => {
			const { header, entries } = parseDocEntries(lines.slice(3, 6));
			assert.deepEqual(header, []);
			assert.deepEqual(entries, [
				{ name: "CONTEXT", desc: "" },
				{ name: "alpha", desc: "" },
				{ name: "zulu", desc: "" },
			]);
		});

		it("buildDocTree reconstructs block with padding and descriptions", () => {
			assert.deepEqual(
				buildDocTree(
					"├── docs/",
					[],
					[
						{ name: "alpha", desc: "Alpha tool" },
						{ name: "beta", desc: "Beta tool" },
					],
				),
				[
					"├── docs/",
					"│   ├── alpha.md  ← Alpha tool",
					"│   └── beta.md   ← Beta tool",
				],
			);
		});

		it("insertFolderEntry adds entry alphabetically", () => {
			const updated = insertFolderEntry(lines.join("\n"), "beta", "Beta tool");
			assert.ok(updated.includes("│   ├── alpha.md"));
			assert.ok(updated.includes("│   ├── beta.md     ← Beta tool"));
			assert.ok(updated.includes("│   ├── CONTEXT.md"));
			assert.ok(updated.includes("│   └── zulu.md"));
		});
	});
});
