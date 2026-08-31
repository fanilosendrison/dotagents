import { describe, expect, it } from "bun:test";
import {
	buildDocTree,
	computeNextIndex,
	findDocsSection,
	formatIndexEntry,
	insertFolderEntry,
	parseDocEntries,
	validateInput,
} from "../lib";

describe("lib", () => {
	describe("validateInput", () => {
		it("returns null for valid input with all fields", () => {
			const inp = {
				topic: "t",
				title: "t",
				description: "d",
				action: "a",
				date: "d",
				content: "c",
				wiring: "w",
				trigger: "tr",
			};
			expect(validateInput(inp)).toBeNull();
		});

		it("returns null for valid input without optional fields", () => {
			const inp = {
				topic: "t",
				title: "t",
				description: "d",
				action: "a",
				date: "d",
				content: "c",
			};
			expect(validateInput(inp)).toBeNull();
		});

		it("returns error if missing required field", () => {
			const inp = { topic: "t" };
			expect(validateInput(inp)).toContain('field "title" is required');
		});

		it("returns error if field is empty string", () => {
			const inp = {
				topic: "t",
				title: "",
				description: "d",
				action: "a",
				date: "d",
				content: "c",
			};
			expect(validateInput(inp)).toContain("must not be empty");
		});
	});

	describe("computeNextIndex", () => {
		it("returns 1 for empty index", () => {
			expect(computeNextIndex("")).toBe(1);
		});

		it("returns max + 1", () => {
			const index = `### 1. A\n### 5. B\n`;
			expect(computeNextIndex(index)).toBe(6);
		});
	});

	describe("formatIndexEntry", () => {
		it("formats minimal entry without wiring/trigger", () => {
			const entry = formatIndexEntry(2, "Test Tool", "2026-06-29", "test-tool");
			expect(entry).toContain("### 2. Test Tool");
			expect(entry).toContain("- **Date** : 2026-06-29");
			expect(entry).toContain("[`test-tool.md`](test-tool.md)");
			expect(entry).not.toContain("**Wiring**");
			expect(entry).not.toContain("**Trigger**");
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
			expect(entry).toContain("### 3. Scanner");
			expect(entry).toContain("- **Wiring** : Pi ext + pre-hook");
			expect(entry).toContain("- **Trigger** : git commit");
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
			const section = findDocsSection(lines);
			expect(section).toEqual({ start: 2, end: 6 });
		});

		it("parseDocEntries extracts entries, CONTEXT.md is treated as entry", () => {
			const sectionLines = lines.slice(3, 6);
			const { header, entries } = parseDocEntries(sectionLines);
			expect(header).toEqual([]);
			expect(entries).toEqual([
				{ name: "CONTEXT", desc: "" },
				{ name: "alpha", desc: "" },
				{ name: "zulu", desc: "" },
			]);
		});

		it("buildDocTree reconstructs block with padding and descriptions", () => {
			const header: string[] = [];
			const entries = [
				{ name: "alpha", desc: "Alpha tool" },
				{ name: "beta", desc: "Beta tool" },
			];
			const rebuilt = buildDocTree("├── docs/", header, entries);
			// Note: padding is computed from max name length (4 for "beta")
			expect(rebuilt).toEqual([
				"├── docs/",
				"│   ├── alpha.md  ← Alpha tool",
				"│   └── beta.md   ← Beta tool",
			]);
		});

		it("insertFolderEntry adds entry alphabetically", () => {
			const router = lines.join("\n");
			const updated = insertFolderEntry(router, "beta", "Beta tool");
			expect(updated).toContain("│   ├── alpha.md");
			expect(updated).toContain("│   ├── beta.md     ← Beta tool");
			expect(updated).toContain("│   ├── CONTEXT.md");
			expect(updated).toContain("│   └── zulu.md");
		});
	});
});
