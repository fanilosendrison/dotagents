/**
 * Integration tests for bootstrap-docs CLI.
 * Each test spawns the real script in a fake $HOME with
 * realistic CONTEXT.md fixtures. No mocks — filesystem I/O
 * and subprocess execution are real.
 *
 * Run: cd ~/.agents/skills/document-self-modif && bun test
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT = join(import.meta.dir, "bootstrap-docs");

// ── fixtures ──────────────────────────────────────────────────

const ROUTER_FIXTURE = `# Harness Config

## Folder Structure

\`\`\`
~/.pi/agent/
├── AGENTS.md
├── docs/
│   ├── CONTEXT.md          ← Index
│   ├── alpha-tool/
│   │   └── CONTEXT.md         ← First tool
│   └── zulu-tool/
│       └── CONTEXT.md         ← Last tool
├── patches/
└── settings.json
\`\`\`

## Quick Navigation

| Want to... | Go here |
|------------|---------|
| Use alpha | \`docs/alpha-tool/CONTEXT.md\` (First tool) |
| Use zulu  | \`docs/zulu-tool/CONTEXT.md\` (Last tool) |

## Skills

Skills here.
`;

const INDEX_FIXTURE = `# Docs

## Existing Modifications

### 1. Alpha Tool
- **Date** : 2026-01-01
- **Doc** : [\`alpha-tool/CONTEXT.md\`](alpha-tool/CONTEXT.md)

### 2. Zulu Tool
- **Date** : 2026-01-01
- **Doc** : [\`zulu-tool/CONTEXT.md\`](zulu-tool/CONTEXT.md)
`;

// ── helpers ───────────────────────────────────────────────────

function setupHarness(): string {
  const home = join(tmpdir(), `bs-int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const agent = join(home, ".pi", "agent");
  mkdirSync(join(agent, "docs"), { recursive: true });
  writeFileSync(join(agent, "CONTEXT.md"), ROUTER_FIXTURE, "utf8");
  writeFileSync(join(agent, "docs", "CONTEXT.md"), INDEX_FIXTURE, "utf8");
  return home;
}

async function run(json: string, home: string) {
  const proc = Bun.spawn([SCRIPT], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HOME: home },
  });
  proc.stdin.write(json);
  proc.stdin.end();

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  return { stdout, stderr, exitCode: await proc.exited };
}

function makeJson(overrides: Record<string, string> = {}): string {
  return JSON.stringify({
    topic: "middle-tool",
    title: "Middle Tool",
    description: "In between",
    action: "Use middle",
    date: "2026-06-29",
    content: "# Middle Tool\n\n## Where / What\n\nMiddle.\n",
    ...overrides,
  });
}

// ── tests ─────────────────────────────────────────────────────

describe("bootstrap-docs CLI integration", () => {
  let home = "";

  beforeEach(() => { home = setupHarness(); });
  afterEach(() => { if (home) rmSync(home, { recursive: true, force: true }); });

  // ── validation ──────────────────────────────────────────

  describe("validation", () => {
    it("rejects malformed JSON", async () => {
      const { stderr, exitCode } = await run("not json", home);
      expect(exitCode).not.toBe(0);
      expect(stderr).toBeTruthy();
    });

    it("rejects empty topic", async () => {
      const { exitCode } = await run(makeJson({ topic: "" }), home);
      expect(exitCode).toBe(1);
    });
  });

  // ── CONTEXT.md ──────────────────────────────────────────

  describe("CONTEXT.md file", () => {
    it("creates folder and writes content", async () => {
      await run(makeJson({ topic: "test-tool" }), home);
      const doc = join(home, ".pi", "agent", "docs", "test-tool", "CONTEXT.md");
      expect(existsSync(doc)).toBe(true);
      expect(readFileSync(doc, "utf8")).toContain("Middle Tool");
    });
  });

  // ── index ───────────────────────────────────────────────

  describe("docs index", () => {
    it("appends entry with correct number", async () => {
      await run(makeJson(), home);
      const index = readFileSync(
        join(home, ".pi", "agent", "docs", "CONTEXT.md"), "utf8",
      );
      expect(index).toContain("### 3. Middle Tool");
    });
  });

  // ── QuickNav ────────────────────────────────────────────

  describe("Quick Navigation", () => {
    it("inserts row before ## Skills", async () => {
      await run(makeJson({ action: "Use middle" }), home);
      const router = readFileSync(
        join(home, ".pi", "agent", "CONTEXT.md"), "utf8",
      );
      const row = router.indexOf("| Use middle |");
      const skills = router.indexOf("\n## Skills");
      expect(row).toBeGreaterThan(0);
      expect(row).toBeLessThan(skills);
    });
  });

  // ── Folder Structure ────────────────────────────────────

  describe("Folder Structure", () => {
    it("inserts alphabetically with correct box-drawing chars", async () => {
      await run(makeJson({ topic: "gamma-tool", description: "Gamma" }), home);
      const router = readFileSync(
        join(home, ".pi", "agent", "CONTEXT.md"), "utf8",
      );

      // Order: alpha, gamma, zulu
      const ai = router.indexOf("│   ├── alpha-tool/");
      const gi = router.indexOf("│   ├── gamma-tool/");
      const zi = router.indexOf("│   └── zulu-tool/");
      expect(ai).toBeGreaterThan(0);
      expect(gi).toBeGreaterThan(ai);
      expect(zi).toBeGreaterThan(gi);

      // zulu was old last, gamma is in middle → zulu stays └──, gamma is ├──
      expect(router).toContain("│   ├── gamma-tool/");
      expect(router).toContain("│   └── zulu-tool/");
    });
  });

  // ── end-to-end ──────────────────────────────────────────

  describe("end-to-end", () => {
    it("simulates a real new extension documentation", async () => {
      const json = JSON.stringify({
        topic: "auto-compactor",
        title: "Auto Compactor",
        description: "Custom compaction rules per project",
        action: "Customize compaction behavior",
        date: "2026-06-29",
        content: "# Auto Compactor\n\n## Where / What\n\nLives at `extensions/auto-compactor.ts`.\n\n## How It Works\n\nHooks into `before_compaction`.\n\n## Background\n\nAdded for per-project tuning.\n",
      });

      const { exitCode, stdout } = await run(json, home);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("✓ docs/auto-compactor/CONTEXT.md");
      expect(stdout).toContain("✓ docs/CONTEXT.md (entry 3)");
      expect(stdout).toContain("✓ Quick Navigation row");
      expect(stdout).toContain("✓ Folder Structure (docs/auto-compactor/)");
      expect(stdout).toContain("Done.");

      const agent = join(home, ".pi", "agent");

      // File created
      const doc = readFileSync(
        join(agent, "docs", "auto-compactor", "CONTEXT.md"), "utf8",
      );
      expect(doc).toContain("# Auto Compactor");
      expect(doc).toContain("`extensions/auto-compactor.ts`");

      // Index updated
      const index = readFileSync(join(agent, "docs", "CONTEXT.md"), "utf8");
      expect(index).toContain("### 3. Auto Compactor");
      expect(index).toContain("2026-06-29");

      // Router has QuickNav + Folder Structure
      const router = readFileSync(join(agent, "CONTEXT.md"), "utf8");
      expect(router).toContain("Customize compaction behavior");
      expect(router).toContain("│   ├── auto-compactor/");
      expect(router).toContain("Custom compaction rules per project");
    });
  });
});
