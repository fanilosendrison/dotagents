import { describe, it, expect } from "bun:test";
import {
  validateInput,
  computeNextIndex,
  formatIndexEntry,
  findDocsSection,
  parseDocEntries,
  buildDocTree,
  insertFolderEntry,
} from "../lib";

describe("lib", () => {
  describe("validateInput", () => {
    it("returns null for valid input", () => {
      const inp = {
        topic: "t", title: "t", description: "d", action: "a", date: "d", content: "c"
      };
      expect(validateInput(inp)).toBeNull();
    });

    it("returns error if missing required field", () => {
      const inp = { topic: "t" };
      expect(validateInput(inp)).toContain('field "title" is required');
    });

    it("returns error if field is empty string", () => {
      const inp = {
        topic: "t", title: "", description: "d", action: "a", date: "d", content: "c"
      };
      expect(validateInput(inp)).toContain('must not be empty');
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
    it("formats markdown correctly", () => {
      const entry = formatIndexEntry(2, "Test Tool", "2026-06-29", "test-tool");
      expect(entry).toContain("### 2. Test Tool");
      expect(entry).toContain("- **Date** : 2026-06-29");
      expect(entry).toContain("[`test-tool/CONTEXT.md`](test-tool/CONTEXT.md)");
    });
  });

  describe("Folder Structure parsing", () => {
    const lines = [
      "~/.agents/",
      "├── AGENTS.md",
      "├── docs/",
      "│   ├── CONTEXT.md",
      "│   └── alpha/",
      "│       └── CONTEXT.md        ← Alpha",
      "├── agent-enforcers/",
      "└── skills/"
    ];

    it("findDocsSection finds boundaries", () => {
      const section = findDocsSection(lines);
      expect(section).toEqual({ start: 2, end: 6 });
    });

    it("parseDocEntries extracts header and entries", () => {
      const sectionLines = lines.slice(3, 6);
      const { header, entries } = parseDocEntries(sectionLines);
      expect(header).toEqual(["│   ├── CONTEXT.md"]);
      expect(entries).toEqual([{ name: "alpha", desc: "Alpha" }]);
    });

    it("buildDocTree reconstructs block", () => {
      const header = ["│   ├── CONTEXT.md"];
      const entries = [
        { name: "alpha", desc: "Alpha" },
        { name: "beta", desc: "Beta" }
      ];
      const rebuilt = buildDocTree("├── docs/", header, entries);
      expect(rebuilt).toEqual([
        "├── docs/",
        "│   ├── CONTEXT.md",
        "│   ├── alpha/",
        "│   │   └── CONTEXT.md        ← Alpha",
        "│   └── beta/",
        "│       └── CONTEXT.md        ← Beta"
      ]);
    });

    it("insertFolderEntry modifies routerContent", () => {
      const router = lines.join("\n");
      const updated = insertFolderEntry(router, "beta", "Beta");
      expect(updated).toContain("│   ├── alpha/");
      expect(updated).toContain("│   └── beta/");
      expect(updated).toContain("│       └── CONTEXT.md        ← Beta");
    });
  });
});
