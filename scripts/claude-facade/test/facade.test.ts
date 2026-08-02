/**
 * Claude Facade Installer — Test Suite
 *
 * All tests use temporary roots so the real HOME is never touched.
 * Run with: bun test ~/.agents/scripts/claude-facade/test/facade.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { mkdirSync, rmSync, writeFileSync, symlinkSync, existsSync, realpathSync, readlinkSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { checkEntry, checkAll, installEntry, installAll, generateGitignoreRules } from "../src/facade";
import { FACADE_ENTRIES } from "../src/manifest";
import type { FacadeEntry } from "../src/types";

const __dirname = dirname(fileURLToPath(import.meta.url));

let agentsRoot: string;
let claudeRoot: string;

function seed(): string {
  return `claude-facade-test-${randomBytes(8).toString("hex")}`;
}

function createSource(entry: FacadeEntry) {
  const src = join(agentsRoot, entry.source);
  if (entry.kind === "directory") {
    mkdirSync(src, { recursive: true });
    // Create a marker file so realpath has something to resolve
    writeFileSync(join(src, ".facade-marker"), "canonical source");
  } else {
    mkdirSync(join(src, ".."), { recursive: true });
    writeFileSync(src, "canonical source content");
  }
}

function resolveTestRoots() {
  return { agentsRoot, claudeRoot };
}

describe("claude-facade", () => {
  beforeAll(() => {
    agentsRoot = join(tmpdir(), seed(), ".agents");
    claudeRoot = join(tmpdir(), seed(), ".claude");
    mkdirSync(agentsRoot, { recursive: true });
    mkdirSync(claudeRoot, { recursive: true });
  });

  afterAll(() => {
    if (agentsRoot && existsSync(agentsRoot)) {
      rmSync(join(agentsRoot, ".."), { recursive: true, force: true });
    }
  });

  // ── Manifest integrity ─────────────────────────────────
  describe("manifest", () => {
    it("contains all expected entries", () => {
      expect(FACADE_ENTRIES.length).toBe(15);
    });

    it("has no duplicates in destination", () => {
      const dests = FACADE_ENTRIES.map((e) => e.destination);
      const unique = new Set(dests);
      expect(unique.size).toBe(dests.length);
    });

    it("has no duplicates in source", () => {
      const sources = FACADE_ENTRIES.map((e) => e.source);
      const unique = new Set(sources);
      expect(unique.size).toBe(sources.length);
    });

    it("contains no absolute paths", () => {
      for (const e of FACADE_ENTRIES) {
        expect(e.source.startsWith("/")).toBe(false);
        expect(e.source.startsWith("~")).toBe(false);
        expect(e.source.includes("Users/")).toBe(false);
        expect(e.destination.startsWith("/")).toBe(false);
        expect(e.destination.startsWith("~")).toBe(false);
        expect(e.destination.includes("Users/")).toBe(false);
      }
    });
  });

  // ── 11.1 Nominal installation ─────────────────────────
  describe("install", () => {
    it("creates a symlink when source present and destination absent", () => {
      const entry = FACADE_ENTRIES[0]; // skills/loop-clean
      createSource(entry);

      // Ensure destination does not exist
      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}

      const result = installEntry(entry, agentsRoot, claudeRoot);
      expect(result.ok).toBe(true);

      // Verify
      const stat = lstatSync(destPath);
      expect(stat.isSymbolicLink()).toBe(true);
      expect(realpathSync(destPath)).toBe(realpathSync(join(agentsRoot, entry.source)));
    });
  });

  // ── 11.2 Idempotence ──────────────────────────────────
  describe("idempotence", () => {
    it("running install twice succeeds with no changes", () => {
      const entry = FACADE_ENTRIES[1]; // skills/coding-standards
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}

      // First install
      const r1 = installEntry(entry, agentsRoot, claudeRoot);
      expect(r1.ok).toBe(true);
      const linkTarget1 = readlinkSync(destPath);

      // Second install
      const r2 = installEntry(entry, agentsRoot, claudeRoot);
      expect(r2.ok).toBe(true);
      const linkTarget2 = readlinkSync(destPath);

      // Unchanged
      expect(linkTarget1).toBe(linkTarget2);
    });
  });

  // ── 11.3 Check nominal ────────────────────────────────
  describe("check", () => {
    it("returns OK for correct facade entries", () => {
      // Set up 3 entries
      const entries = FACADE_ENTRIES.slice(0, 3);
      for (const e of entries) {
        createSource(e);
        try { rmSync(join(claudeRoot, e.destination), { recursive: true, force: true }); } catch {}
        installEntry(e, agentsRoot, claudeRoot);
      }

      // Check only the entries we set up (others may have missing sources)
      for (const e of entries) {
        const result = checkEntry(e, agentsRoot, claudeRoot);
        expect(result.status).toBe("OK");
      }
    });
  });

  // ── 11.4 Source missing ───────────────────────────────
  describe("source missing", () => {
    it("fails install and creates no link", () => {
      const entry: FacadeEntry = { source: "skills/nonexistent", destination: "skills/nonexistent", kind: "directory" };
      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}

      const result = installEntry(entry, agentsRoot, claudeRoot);
      expect(result.ok).toBe(false);
      expect(existsSync(destPath)).toBe(false);
    });

    it("check reports SOURCE_MISSING", () => {
      const entry: FacadeEntry = { source: "skills/also-nonexistent", destination: "skills/also-nonexistent", kind: "directory" };
      const result = checkEntry(entry, agentsRoot, claudeRoot);
      expect(result.status).toBe("SOURCE_MISSING");
    });
  });

  // ── 11.5 Real destination — file ──────────────────────
  describe("real destination file", () => {
    it("fails install and preserves content", () => {
      const entry = FACADE_ENTRIES[0];
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}
      mkdirSync(join(destPath, ".."), { recursive: true });
      writeFileSync(destPath, "original real file content");

      const result = installEntry(entry, agentsRoot, claudeRoot);
      expect(result.ok).toBe(false);
      expect(result.detail).toContain("real");

      // Content preserved
      const stat = lstatSync(destPath);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(readFileSync(destPath, "utf8")).toBe("original real file content");
    });
  });

  // ── 11.6 Real destination — directory ─────────────────
  describe("real destination directory", () => {
    it("fails install and preserves content", () => {
      const entry = FACADE_ENTRIES[0];
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}
      mkdirSync(destPath, { recursive: true });
      writeFileSync(join(destPath, "child.txt"), "child content");

      const result = installEntry(entry, agentsRoot, claudeRoot);
      expect(result.ok).toBe(false);
      expect(result.detail).toContain("real");
      expect(result.detail).toContain("directory");

      // Content preserved
      const stat = lstatSync(destPath);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(readFileSync(join(destPath, "child.txt"), "utf8")).toBe("child content");
    });
  });

  // ── 11.7 Wrong symlink ───────────────────────────────
  describe("wrong symlink", () => {
    it("fails install and preserves old target", () => {
      const entry = FACADE_ENTRIES[0];
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}
      mkdirSync(join(destPath, ".."), { recursive: true });

      // Create a symlink to somewhere else
      const wrongTarget = join(agentsRoot, "skills", "coding-standards");
      mkdirSync(wrongTarget, { recursive: true });
      writeFileSync(join(wrongTarget, ".marker"), "wrong");
      symlinkSync(wrongTarget, destPath);

      const result = installEntry(entry, agentsRoot, claudeRoot, "install");
      expect(result.ok).toBe(false);
      expect(result.detail).toContain("wrong target");

      // Old target preserved
      expect(readlinkSync(destPath)).toBe(wrongTarget);
    });

    it("repair mode fixes wrong symlink", () => {
      const entry = FACADE_ENTRIES[1];
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}
      mkdirSync(join(destPath, ".."), { recursive: true });

      const wrongTarget = join(agentsRoot, "skills", "loop-clean");
      mkdirSync(wrongTarget, { recursive: true });
      writeFileSync(join(wrongTarget, ".marker"), "wrong");
      symlinkSync(wrongTarget, destPath);

      const result = installEntry(entry, agentsRoot, claudeRoot, "repair");
      expect(result.ok).toBe(true);
      expect(result.detail).toContain("Repaired");

      const expectedReal = realpathSync(join(agentsRoot, entry.source));
      expect(realpathSync(destPath)).toBe(expectedReal);
    });

    it("preserves the old symlink and removes the temporary link when atomic publication fails", () => {
      const entry = FACADE_ENTRIES[1];
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}
      const destinationDirectory = dirname(destPath);
      mkdirSync(destinationDirectory, { recursive: true });

      const wrongTarget = join(agentsRoot, "skills", "loop-clean");
      mkdirSync(wrongTarget, { recursive: true });
      symlinkSync(wrongTarget, destPath);
      const directoryEntriesBeforeRepair = readdirSync(destinationDirectory).sort();

      const failAtomicPublication = () => {
        throw new Error("injected atomic publication failure");
      };

      expect(() => installEntry(entry, agentsRoot, claudeRoot, "repair", failAtomicPublication))
        .toThrow("injected atomic publication failure");
      expect(readlinkSync(destPath)).toBe(wrongTarget);
      expect(readdirSync(destinationDirectory).sort()).toEqual(directoryEntriesBeforeRepair);
    });
  });

  // ── 11.8 Broken symlink ──────────────────────────────
  describe("broken symlink", () => {
    it("install fails with BROKEN_SYMLINK classification", () => {
      const entry = FACADE_ENTRIES[0];
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}
      mkdirSync(join(destPath, ".."), { recursive: true });

      // Create symlink to nonexistent target
      symlinkSync("/nonexistent/path/for/testing", destPath);

      const installResult = installEntry(entry, agentsRoot, claudeRoot, "install");
      expect(installResult.ok).toBe(false);
      expect(installResult.detail).toContain("broken");

      const checkResult = checkEntry(entry, agentsRoot, claudeRoot);
      expect(checkResult.status).toBe("BROKEN_SYMLINK");
    });

    it("repair mode fixes broken symlink", () => {
      const entry = FACADE_ENTRIES[1];
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}
      mkdirSync(join(destPath, ".."), { recursive: true });

      symlinkSync("/nonexistent/path/for/testing2", destPath);

      const result = installEntry(entry, agentsRoot, claudeRoot, "repair");
      expect(result.ok).toBe(true);
      expect(result.detail).toContain("Repaired");

      const expectedReal = realpathSync(join(agentsRoot, entry.source));
      expect(realpathSync(destPath)).toBe(expectedReal);
    });
  });

  // ── 11.9 HOME different (no machine-specific paths) ──
  describe("no machine-specific paths", () => {
    it("install does not produce paths containing /Users/", () => {
      const entry = FACADE_ENTRIES[0];
      createSource(entry);

      const destPath = join(claudeRoot, entry.destination);
      try { rmSync(destPath, { recursive: true, force: true }); } catch {}

      const result = installEntry(entry, agentsRoot, claudeRoot);
      expect(result.ok).toBe(true);

      const linkTarget = readlinkSync(destPath);
      expect(linkTarget).not.toContain("/Users/famillesendrison");
      expect(linkTarget).not.toContain("/Users/");
    });

    it("test roots do not contain /Users/famillesendrison", () => {
      expect(agentsRoot).not.toContain("/Users/famillesendrison");
      expect(claudeRoot).not.toContain("/Users/famillesendrison");
    });

    it("manifest contains no machine-specific paths", () => {
      for (const e of FACADE_ENTRIES) {
        expect(e.source).not.toContain("/Users/");
        expect(e.destination).not.toContain("/Users/");
        expect(JSON.stringify(FACADE_ENTRIES)).not.toContain("/Users/famillesendrison");
      }
    });
  });

  // ── 11.10 Gitignore coverage ──────────────────────────
  describe("gitignore coverage", () => {
    it("generates rules for every manifest destination", () => {
      const rules = generateGitignoreRules();
      const rulesText = rules.join("\n");

      for (const entry of FACADE_ENTRIES) {
        const expectedRule = `/${entry.destination}`;
        expect(rulesText).toContain(expectedRule);
      }
    });

    it("does not include broad ignore patterns like skills/ or agents/ alone", () => {
      const rules = generateGitignoreRules();
      const rulesText = rules.join("\n");
      // Should have specific rules, not broad directory ignores
      expect(rules.filter((r) => r === "/skills" || r === "/agents" || r === "/scripts")).toHaveLength(0);
    });
  });

  // ── 11.11 No tracked absolute paths ───────────────────
  describe("no tracked absolute paths", () => {
    it("manifest source entries are relative", () => {
      for (const e of FACADE_ENTRIES) {
        expect(e.source.startsWith("/")).toBe(false);
        expect(e.source.startsWith("~")).toBe(false);
        expect(e.source.includes(":\\")).toBe(false); // Windows
      }
    });

    it("manifest destination entries are relative", () => {
      for (const e of FACADE_ENTRIES) {
        expect(e.destination.startsWith("/")).toBe(false);
        expect(e.destination.startsWith("~")).toBe(false);
        expect(e.destination.includes(":\\")).toBe(false);
      }
    });

    it("facade.ts does not contain /Users/famillesendrison in code", () => {
      const facadeSource = readFileSync(
        join(__dirname, "..", "src", "facade.ts"),
        "utf8",
      );
      // homedir() is used, but no hardcoded paths
      expect(facadeSource).not.toContain("/Users/famillesendrison");
    });

    it("cli.ts does not contain /Users/famillesendrison in code", () => {
      const cliSource = readFileSync(
        join(__dirname, "..", "src", "cli.ts"),
        "utf8",
      );
      expect(cliSource).not.toContain("/Users/famillesendrison");
    });
  });

  // ── installAll ────────────────────────────────────────
  describe("installAll", () => {
    it("installs all entries when sources exist", () => {
      // Create all sources
      for (const entry of FACADE_ENTRIES) {
        createSource(entry);
        try { rmSync(join(claudeRoot, entry.destination), { recursive: true, force: true }); } catch {}
      }

      const report = installAll(agentsRoot, claudeRoot);
      expect(report.overallOk).toBe(true);
      expect(report.failCount).toBe(0);
    });
  });

  // ── checkAll with all statuses ────────────────────────
  describe("checkAll edge cases", () => {
    it("reports DESTINATION_MISSING when no link", () => {
      // Use a custom entry with source that exists but destination that doesn't
      const srcDir = join(agentsRoot, "skills", "custom-source");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, ".marker"), "test");

      const entry: FacadeEntry = { source: "skills/custom-source", destination: "skills/custom-missing-dest", kind: "directory" };
      const result = checkEntry(entry, agentsRoot, claudeRoot);
      expect(result.status).toBe("DESTINATION_MISSING");
    });

    it("reports DESTINATION_NOT_SYMLINK for real files", () => {
      // Create source first
      const srcDir = join(agentsRoot, "skills", "another-source");
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, ".marker"), "test");

      const entry: FacadeEntry = { source: "skills/another-source", destination: "skills/real-file", kind: "directory" };
      const destPath = join(claudeRoot, entry.destination);
      mkdirSync(join(destPath, ".."), { recursive: true });
      writeFileSync(destPath, "real file");

      const result = checkEntry(entry, agentsRoot, claudeRoot);
      expect(result.status).toBe("DESTINATION_NOT_SYMLINK");
    });
  });
});
