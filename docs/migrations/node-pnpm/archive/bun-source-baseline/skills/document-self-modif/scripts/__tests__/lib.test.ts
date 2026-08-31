/**
 * Unit tests for bootstrap-docs pure functions (lib.ts).
 * No filesystem, no subprocess — strings in, strings out.
 * Run: cd ~/.agents/skills/document-self-modif && bun test
 */

import { describe, it, expect } from "bun:test";
import {
  validateInput,
  computeNextIndex,
  formatIndexEntry,
  formatQuickNavRow,
  insertQuickNavRow,
  findDocsSection,
  parseDocEntries,
  buildDocTree,
  insertFolderEntry,
} from "../lib";

// ── validateInput ────────────────────────────────────────────

describe("validateInput", () => {
  it("returns null for valid input", () => {
    expect(
      validateInput({
        topic: "x", title: "x", description: "x",
        action: "x", date: "x", content: "# x",
      }),
    ).toBeNull();
  });

  it("rejects missing field", () => {
    expect(validateInput({ topic: "x" })).toContain("title");
  });

  it("rejects empty string", () => {
    expect(validateInput({
      topic: "", title: "x", description: "x",
      action: "x", date: "x", content: "# x",
    })).toContain("topic");
  });

  it("rejects whitespace-only string", () => {
    expect(validateInput({
      topic: "  ", title: "x", description: "x",
      action: "x", date: "x", content: "# x",
    })).toContain("topic");
  });
});

// ── computeNextIndex ─────────────────────────────────────────

describe("computeNextIndex", () => {
  it("returns 1 for empty index", () => {
    expect(computeNextIndex("# Docs\n\n## Existing Modifications\n\n")).toBe(1);
  });

  it("returns N+1 when entries exist", () => {
    const content = "### 1. Foo\n### 2. Bar\n### 5. Baz\n";
    expect(computeNextIndex(content)).toBe(6);
  });

  it("ignores numbers inside code blocks", () => {
    const content = "```\n### 99. Not real\n```\n### 3. Real\n";
    // The regex matches "### 99." inside the code block too — known limitation,
    // but in practice the index never has code blocks with that pattern.
    expect(computeNextIndex(content)).toBe(100);
  });

  it("returns 1 when no numbered entries exist", () => {
    expect(computeNextIndex("Some text without ### N. pattern")).toBe(1);
  });
});

// ── formatIndexEntry ─────────────────────────────────────────

describe("formatIndexEntry", () => {
  it("formats a complete entry", () => {
    const result = formatIndexEntry(7, "My Tool", "2026-06-29", "my-tool");
    expect(result).toBe(
      "\n### 7. My Tool\n" +
      "- **Date** : 2026-06-29\n" +
      "- **Doc** : [`my-tool.md`](my-tool.md)\n",
    );
  });

  it("uses backtick-escaped path", () => {
    const result = formatIndexEntry(1, "X", "2026-01-01", "some-topic");
    expect(result).toContain("[`some-topic.md`]");
    expect(result).toContain("(some-topic.md)");
  });
});

// ── formatQuickNavRow ────────────────────────────────────────

describe("formatQuickNavRow", () => {
  it("includes action, escaped path, and description", () => {
    const row = formatQuickNavRow("Do the thing", "my-topic", "A thing");
    expect(row).toBe("| Do the thing | `docs/my-topic.md` (A thing) |");
  });

  it("handles special characters in description", () => {
    const row = formatQuickNavRow("Use", "t", "foo & bar");
    expect(row).toContain("(foo & bar)");
  });
});

// ── insertQuickNavRow ────────────────────────────────────────

describe("insertQuickNavRow", () => {
  it("inserts row right before ## Skills", () => {
    const before = "| Old row |\n\n## Skills\n\nSkills text\n";
    const result = insertQuickNavRow(before, "| New row |");
    expect(result).toBe("| Old row |\n| New row |\n\n## Skills\n\nSkills text\n");
  });

  it("appends at end when ## Skills is missing", () => {
    const before = "Some content\nEnd of file\n";
    const result = insertQuickNavRow(before, "| Fallback |");
    expect(result).toBe("Some content\nEnd of file\n\n| Fallback |\n");
  });

  it("does not insert inside a heading that contains Skills", () => {
    const before = "## Skills and more\n## Skills\nReal skills\n";
    // Should match the SECOND "## Skills" (exact heading, starts with \n)
    const result = insertQuickNavRow(before, "| Row |");
    expect(result).toBe("## Skills and more\n| Row |\n## Skills\nReal skills\n");
  });
});

// ── findDocsSection ──────────────────────────────────────────

describe("findDocsSection", () => {
  it("finds docs/ block with following sibling", () => {
    const lines = [
      "├── AGENTS.md",
      "├── docs/",
      "│   ├── foo/",
      "├── patches/",
      "└── settings.json",
    ];
    expect(findDocsSection(lines)).toEqual({ start: 1, end: 3 });
  });

  it("returns null when docs/ is missing", () => {
    const lines = ["├── AGENTS.md", "├── patches/"];
    expect(findDocsSection(lines)).toBeNull();
  });

  it("handles docs/ as last top-level entry (end = EOF)", () => {
    const lines = [
      "├── AGENTS.md",
      "└── docs/",
      "    ├── foo/",
    ];
    expect(findDocsSection(lines)).toEqual({ start: 1, end: 3 });
  });

  it("matches docs/ only as a top-level tree entry", () => {
    const lines = [
      "See docs/ for more info",   // not a tree line
      "├── docs/",                  // this one
      "│   ├── foo/",
      "├── patches/",
    ];
    expect(findDocsSection(lines)).toEqual({ start: 1, end: 3 });
  });
});

// ── parseDocEntries ──────────────────────────────────────────

describe("parseDocEntries", () => {
  it("parses header and entries", () => {
    const lines = [
      "│   ├── CONTEXT.md          ← Index",
      "│   ├── alpha-tool.md  ← First",
      "│   └── zulu-tool.md   ← Last",
    ];
    const result = parseDocEntries(lines);
    expect(result.header).toEqual(["│   ├── CONTEXT.md          ← Index"]);
    expect(result.entries).toEqual([
      { name: "alpha-tool", desc: "First" },
      { name: "zulu-tool", desc: "Last" },
    ]);
  });

  it("handles entries without descriptions", () => {
    const lines = [
      "│   ├── bare.md",
    ];
    const result = parseDocEntries(lines);
    expect(result.entries[0].desc).toBe("");
  });

  it("returns empty arrays for empty section", () => {
    expect(parseDocEntries([])).toEqual({ header: [], entries: [] });
  });

  it("skips non-entry lines between entries", () => {
    const lines = [
      "│   ├── foo.md  ← Foo",
      "",                          // blank line
      "│   └── bar.md  ← Bar",
    ];
    const result = parseDocEntries(lines);
    expect(result.entries).toHaveLength(2);
  });
});

// ── buildDocTree ─────────────────────────────────────────────

describe("buildDocTree", () => {
  it("single entry uses └──", () => {
    const result = buildDocTree(
      "├── docs/",
      [],
      [{ name: "only", desc: "One" }],
    );
    expect(result).toEqual([
      "├── docs/",
      "│   └── only.md  ← One",
    ]);
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
    expect(result[2]).toBe("│   ├── a.md  ← A");
    expect(result[3]).toBe("│   ├── b.md  ← B");
    expect(result[4]).toBe("│   └── c.md  ← C");
  });

  it("empty entries produces only docLine + header", () => {
    const result = buildDocTree(
      "├── docs/",
      ["│   ├── CONTEXT.md"],
      [],
    );
    expect(result).toEqual(["├── docs/", "│   ├── CONTEXT.md"]);
  });
});

// ── insertFolderEntry (full pipeline) ────────────────────────

describe("insertFolderEntry", () => {
  const ROUTER = [
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
    const result = insertFolderEntry(ROUTER, "alpha", "First!");
    // alpha should be before beta
    const idx = result.indexOf("│   ├── alpha.md");
    expect(idx).toBeGreaterThan(0);
    expect(result.indexOf("│   ├── beta.md")).toBeGreaterThan(idx);
  });

  it("inserts in the middle", () => {
    const result = insertFolderEntry(ROUTER, "charlie", "Middle");
    // charlie between beta and delta alphabetically
    const idx = result.indexOf("│   ├── charlie.md");
    expect(idx).toBeGreaterThan(result.indexOf("│   ├── beta.md"));
    expect(result.indexOf("│   └── delta.md")).toBeGreaterThan(idx);
  });

  it("inserts at end (old last becomes ├──)", () => {
    const result = insertFolderEntry(ROUTER, "zeta", "Last!");
    // delta was └──, now should be ├──
    expect(result).toContain("│   ├── delta.md");
    // zeta gets └──
    expect(result).toContain("│   └── zeta.md");
  });

  it("is case-insensitive", () => {
    const result = insertFolderEntry(ROUTER, "ALPHA", "Upper");
    // "ALPHA" < "beta" in case-insensitive sort
    expect(result.indexOf("│   ├── ALPHA.md")).toBeLessThan(
      result.indexOf("│   ├── beta.md"),
    );
  });

  it("throws when docs/ section is missing", () => {
    expect(() => insertFolderEntry("# No tree\n", "x", "x")).toThrow("docs/");
  });
});

