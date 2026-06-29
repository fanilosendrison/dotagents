import { describe, it, expect } from "bun:test";
import {
  validateInput,
  computeNextIndex,
  formatIndexEntry,
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
});
