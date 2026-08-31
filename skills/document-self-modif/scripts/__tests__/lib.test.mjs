import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildDocTree,
	computeNextIndex,
	findDocsSection,
	formatIndexEntry,
	formatQuickNavRow,
	insertFolderEntry,
	insertQuickNavRow,
	parseDocEntries,
	validateInput,
} from "../lib.mjs";

describe("validateInput", () => {
	it("returns null for valid input", () => {
		assert.equal(
			validateInput({
				action: "x",
				content: "# x",
				date: "x",
				description: "x",
				title: "x",
				topic: "x",
			}),
			null,
		);
	});

	it("rejects missing field", () => {
		assert.ok(validateInput({ topic: "x" })?.includes("title"));
	});

	it("rejects empty string", () => {
		assert.ok(
			validateInput({
				action: "x",
				content: "# x",
				date: "x",
				description: "x",
				title: "x",
				topic: "",
			})?.includes("topic"),
		);
	});

	it("rejects whitespace-only string", () => {
		assert.ok(
			validateInput({
				action: "x",
				content: "# x",
				date: "x",
				description: "x",
				title: "x",
				topic: "  ",
			})?.includes("topic"),
		);
	});
});

describe("computeNextIndex", () => {
	it("returns 1 for empty index", () => {
		assert.equal(
			computeNextIndex("# Docs\n\n## Existing Modifications\n\n"),
			1,
		);
	});

	it("returns N+1 when entries exist", () => {
		assert.equal(computeNextIndex("### 1. Foo\n### 2. Bar\n### 5. Baz\n"), 6);
	});

	it("ignores numbers inside code blocks", () => {
		const content = "```\n### 99. Not real\n```\n### 3. Real\n";
		assert.equal(computeNextIndex(content), 100);
	});

	it("returns 1 when no numbered entries exist", () => {
		assert.equal(computeNextIndex("Some text without ### N. pattern"), 1);
	});
});

describe("formatIndexEntry", () => {
	it("formats a complete entry", () => {
		assert.equal(
			formatIndexEntry(7, "My Tool", "2026-06-29", "my-tool"),
			"\n### 7. My Tool\n" +
				"- **Date** : 2026-06-29\n" +
				"- **Doc** : [`my-tool.md`](my-tool.md)\n",
		);
	});

	it("uses backtick-escaped path", () => {
		const result = formatIndexEntry(1, "X", "2026-01-01", "some-topic");
		assert.ok(result.includes("[`some-topic.md`]"));
		assert.ok(result.includes("(some-topic.md)"));
	});
});

describe("formatQuickNavRow", () => {
	it("includes action, escaped path, and description", () => {
		assert.equal(
			formatQuickNavRow("Do the thing", "my-topic", "A thing"),
			"| Do the thing | `docs/my-topic.md` (A thing) |",
		);
	});

	it("handles special characters in description", () => {
		assert.ok(
			formatQuickNavRow("Use", "t", "foo & bar").includes("(foo & bar)"),
		);
	});
});

describe("insertQuickNavRow", () => {
	it("inserts row right before ## Skills", () => {
		assert.equal(
			insertQuickNavRow(
				"| Old row |\n\n## Skills\n\nSkills text\n",
				"| New row |",
			),
			"| Old row |\n| New row |\n\n## Skills\n\nSkills text\n",
		);
	});

	it("appends at end when ## Skills is missing", () => {
		assert.equal(
			insertQuickNavRow("Some content\nEnd of file\n", "| Fallback |"),
			"Some content\nEnd of file\n\n| Fallback |\n",
		);
	});

	it("does not insert inside a heading that contains Skills", () => {
		assert.equal(
			insertQuickNavRow(
				"## Skills and more\n## Skills\nReal skills\n",
				"| Row |",
			),
			"## Skills and more\n| Row |\n## Skills\nReal skills\n",
		);
	});
});

describe("findDocsSection", () => {
	it("finds docs/ block with following sibling", () => {
		assert.deepEqual(
			findDocsSection([
				"├── AGENTS.md",
				"├── docs/",
				"│   ├── foo/",
				"├── patches/",
				"└── settings.json",
			]),
			{ start: 1, end: 3 },
		);
	});

	it("returns null when docs/ is missing", () => {
		assert.equal(findDocsSection(["├── AGENTS.md", "├── patches/"]), null);
	});

	it("handles docs/ as last top-level entry (end = EOF)", () => {
		assert.deepEqual(
			findDocsSection(["├── AGENTS.md", "└── docs/", "    ├── foo/"]),
			{ start: 1, end: 3 },
		);
	});

	it("matches docs/ only as a top-level tree entry", () => {
		assert.deepEqual(
			findDocsSection([
				"See docs/ for more info",
				"├── docs/",
				"│   ├── foo/",
				"├── patches/",
			]),
			{ start: 1, end: 3 },
		);
	});
});

describe("parseDocEntries", () => {
	it("parses header and entries", () => {
		const result = parseDocEntries([
			"│   ├── CONTEXT.md          ← Index",
			"│   ├── alpha-tool.md  ← First",
			"│   └── zulu-tool.md   ← Last",
		]);
		assert.deepEqual(result.header, ["│   ├── CONTEXT.md          ← Index"]);
		assert.deepEqual(result.entries, [
			{ name: "alpha-tool", desc: "First" },
			{ name: "zulu-tool", desc: "Last" },
		]);
	});

	it("handles entries without descriptions", () => {
		assert.equal(parseDocEntries(["│   ├── bare.md"]).entries[0]?.desc, "");
	});

	it("returns empty arrays for empty section", () => {
		assert.deepEqual(parseDocEntries([]), { header: [], entries: [] });
	});

	it("skips non-entry lines between entries", () => {
		const result = parseDocEntries([
			"│   ├── foo.md  ← Foo",
			"",
			"│   └── bar.md  ← Bar",
		]);
		assert.equal(result.entries.length, 2);
	});
});

describe("buildDocTree", () => {
	it("single entry uses └──", () => {
		assert.deepEqual(
			buildDocTree("├── docs/", [], [{ name: "only", desc: "One" }]),
			["├── docs/", "│   └── only.md  ← One"],
		);
	});

	it("multiple entries: all but last use ├──", () => {
		const result = buildDocTree(
			"├── docs/",
			["│   ├── CONTEXT.md"],
			[
				{ name: "a", desc: "A" },
				{ name: "b", desc: "B" },
				{ name: "c", desc: "C" },
			],
		);
		assert.equal(result[2], "│   ├── a.md  ← A");
		assert.equal(result[3], "│   ├── b.md  ← B");
		assert.equal(result[4], "│   └── c.md  ← C");
	});

	it("empty entries produces only docLine + header", () => {
		assert.deepEqual(buildDocTree("├── docs/", ["│   ├── CONTEXT.md"], []), [
			"├── docs/",
			"│   ├── CONTEXT.md",
		]);
	});
});

describe("insertFolderEntry", () => {
	const router = [
		"```",
		"~/.pi/agent/",
		"├── docs/",
		"│   ├── CONTEXT.md",
		"│   ├── beta.md      ← B",
		"│   └── delta.md     ← D",
		"├── patches/",
		"```",
	].join("\n");

	it("inserts at beginning alphabetically", () => {
		const result = insertFolderEntry(router, "alpha", "First!");
		const index = result.indexOf("│   ├── alpha.md");
		assert.ok(index > 0);
		assert.ok(result.indexOf("│   ├── beta.md") > index);
	});

	it("inserts in the middle", () => {
		const result = insertFolderEntry(router, "charlie", "Middle");
		const index = result.indexOf("│   ├── charlie.md");
		assert.ok(index > result.indexOf("│   ├── beta.md"));
		assert.ok(result.indexOf("│   └── delta.md") > index);
	});

	it("inserts at end (old last becomes ├──)", () => {
		const result = insertFolderEntry(router, "zeta", "Last!");
		assert.ok(result.includes("│   ├── delta.md"));
		assert.ok(result.includes("│   └── zeta.md"));
	});

	it("is case-insensitive", () => {
		const result = insertFolderEntry(router, "ALPHA", "Upper");
		assert.ok(
			result.indexOf("│   ├── ALPHA.md") < result.indexOf("│   ├── beta.md"),
		);
	});

	it("throws when docs/ section is missing", () => {
		assert.throws(() => insertFolderEntry("# No tree\n", "x", "x"), /docs\//);
	});
});
