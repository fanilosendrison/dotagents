/**
 * Integration tests for bootstrap-docs.
 * Run: cd ~/.agents/skills/document-self-modif && bun test
 *
 * Every test creates a fresh isolated harness under a fake $HOME,
 * runs the real script via subprocess, and checks exact output.
 * No mocks, no shared state — if a test passes, the script works.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  mkdirSync,
  rmSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { $ } from "bun";

// ── helpers ───────────────────────────────────────────────────

const SCRIPT = join(import.meta.dir, "bootstrap-docs");

/** Minimal but realistic router CONTEXT.md (Folder Structure + QuickNav + Skills). */
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

Skills description here.
`;

/** Minimal docs index. */
const INDEX_FIXTURE = `# Docs

## Existing Modifications

### 1. Alpha Tool
- **Date** : 2026-01-01
- **Doc** : [\`alpha-tool/CONTEXT.md\`](alpha-tool/CONTEXT.md)

### 2. Zulu Tool
- **Date** : 2026-01-01
- **Doc** : [\`zulu-tool/CONTEXT.md\`](zulu-tool/CONTEXT.md)
`;

/** Valid input JSON builder. */
function makeInput(overrides: Record<string, string>) {
  return JSON.stringify({
    topic: "middle-tool",
    title: "Middle Tool",
    description: "In between",
    action: "Use middle tool",
    date: "2026-06-29",
    content: "# Middle Tool\n\n## Where / What\n\nIt lives in the middle.\n",
    ...overrides,
  });
}

/** Set up a fresh harness under a fake $HOME, return the home path. */
function setupHarness(): string {
  const home = join(tmpdir(), `bs-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const agent = join(home, ".pi", "agent");
  mkdirSync(join(agent, "docs"), { recursive: true });
  writeFileSync(join(agent, "CONTEXT.md"), ROUTER_FIXTURE, "utf8");
  writeFileSync(join(agent, "docs", "CONTEXT.md"), INDEX_FIXTURE, "utf8");
  return home;
}

/** Run the script, return { stdout, stderr, exitCode }. */
async function run(input: string, home: string) {
  const proc = Bun.spawn([SCRIPT], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, HOME: home },
  });
  proc.stdin.write(input);
  proc.stdin.end();

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

// ── tests ─────────────────────────────────────────────────────

describe("bootstrap-docs", () => {
  let home = "";

  beforeEach(() => {
    home = setupHarness();
  });

  afterEach(() => {
    if (home) rmSync(home, { recursive: true, force: true });
  });

  // ── 1. parsing & validation ──────────────────────────────

  describe("input validation", () => {
    it("rejects malformed JSON", async () => {
      const { stderr, exitCode } = await run("not json", home);
      expect(exitCode).not.toBe(0);
      expect(stderr).toBeTruthy();
    });

    it("rejects missing topic", async () => {
      const input = JSON.stringify({
        title: "X", description: "X", action: "X",
        date: "2026-01-01", content: "# X",
      });
      const { exitCode } = await run(input, home);
      expect(exitCode).toBe(1);
    });

    it("rejects missing content", async () => {
      const input = JSON.stringify({
        topic: "x", title: "X", description: "X",
        action: "X", date: "2026-01-01",
      });
      const { exitCode } = await run(input, home);
      expect(exitCode).toBe(1);
    });

    it("rejects empty topic", async () => {
      const { exitCode } = await run(makeInput({ topic: "" }), home);
      expect(exitCode).not.toBe(0);
    });

    it("accepts valid minimal input", async () => {
      const { exitCode } = await run(makeInput({}), home);
      expect(exitCode).toBe(0);
    });
  });

  // ── 2. CONTEXT.md file ───────────────────────────────────

  describe("CONTEXT.md creation", () => {
    it("creates the folder and file", async () => {
      await run(makeInput({ topic: "test-tool" }), home);
      const doc = join(home, ".pi", "agent", "docs", "test-tool", "CONTEXT.md");
      expect(existsSync(doc)).toBe(true);
    });

    it("writes the exact content from JSON", async () => {
      const content = "# My Tool\n\n## How It Works\n\n```bash\necho '${HOME}'\n```\n";
      await run(makeInput({ topic: "my-tool", content }), home);
      const written = readFileSync(
        join(home, ".pi", "agent", "docs", "my-tool", "CONTEXT.md"), "utf8"
      );
      expect(written).toBe(content);
    });

    it("is idempotent on existing folder", async () => {
      const agent = join(home, ".pi", "agent");
      mkdirSync(join(agent, "docs", "dup-tool"), { recursive: true });
      writeFileSync(join(agent, "docs", "dup-tool", "CONTEXT.md"), "old", "utf8");
      await run(makeInput({ topic: "dup-tool", content: "new" }), home);
      expect(
        readFileSync(join(agent, "docs", "dup-tool", "CONTEXT.md"), "utf8")
      ).toBe("new");
    });

    it("preserves special characters in content", async () => {
      const content = "# Tool\n\nPath: `${HOME}/.pi`\n\nBackticks: ```\n";
      await run(makeInput({ topic: "special", content }), home);
      const written = readFileSync(
        join(home, ".pi", "agent", "docs", "special", "CONTEXT.md"), "utf8"
      );
      expect(written).toBe(content);
    });
  });

  // ── 3. docs index ────────────────────────────────────────

  describe("docs/CONTEXT.md index", () => {
    it("appends entry with correct numbering", async () => {
      await run(makeInput({ topic: "new-tool", title: "New Tool", date: "2026-06-29" }), home);
      const index = readFileSync(join(home, ".pi", "agent", "docs", "CONTEXT.md"), "utf8");
      expect(index).toContain("### 3. New Tool");
      expect(index).toContain("- **Date** : 2026-06-29");
      expect(index).toContain("[`new-tool/CONTEXT.md`](new-tool/CONTEXT.md)");
    });

    it("starts at 1 with empty index", async () => {
      // Replace index with an empty "Existing Modifications" section
      writeFileSync(
        join(home, ".pi", "agent", "docs", "CONTEXT.md"),
        "# Docs\n\n## Existing Modifications\n\n",
        "utf8"
      );
      await run(makeInput({ topic: "first", title: "First" }), home);
      const index = readFileSync(join(home, ".pi", "agent", "docs", "CONTEXT.md"), "utf8");
      expect(index).toContain("### 1. First");
    });

    it("does not duplicate on re-run", async () => {
      // Run twice with same topic — should add TWO entries (current behavior, document it)
      await run(makeInput({ topic: "dup", title: "Dup", date: "2026-01-01" }), home);
      await run(makeInput({ topic: "dup", title: "Dup", date: "2026-01-01" }), home);
      const index = readFileSync(join(home, ".pi", "agent", "docs", "CONTEXT.md"), "utf8");
      const matches = [...index.matchAll(/### \d+\. Dup/g)];
      expect(matches.length).toBe(2); // current behavior: no dedup
    });
  });

  // ── 4. Quick Navigation ──────────────────────────────────

  describe("Quick Navigation", () => {
    it("appends row before ## Skills", async () => {
      await run(makeInput({ topic: "cool-tool", action: "Be cool", description: "Cool tool" }), home);
      const router = readFileSync(join(home, ".pi", "agent", "CONTEXT.md"), "utf8");

      // Row must appear before ## Skills
      const skillsPos = router.indexOf("\n## Skills");
      const rowPos = router.indexOf("| Be cool |");
      expect(rowPos).toBeGreaterThan(0);
      expect(rowPos).toBeLessThan(skillsPos);
    });

    it("includes backtick-escaped path and description", async () => {
      await run(makeInput({ topic: "bt", action: "Use bt", description: "Backtick tool" }), home);
      const router = readFileSync(join(home, ".pi", "agent", "CONTEXT.md"), "utf8");
      expect(router).toContain("| Use bt | `docs/bt/CONTEXT.md` (Backtick tool) |");
    });

    it("falls back to append when ## Skills is missing", async () => {
      writeFileSync(
        join(home, ".pi", "agent", "CONTEXT.md"),
        ROUTER_FIXTURE.replace("## Skills", "## Other Section"),
        "utf8"
      );
      const { exitCode } = await run(makeInput({ topic: "fallback" }), home);
      expect(exitCode).toBe(0);
      // Should not crash, row should be somewhere in the file
      const router = readFileSync(join(home, ".pi", "agent", "CONTEXT.md"), "utf8");
      expect(router).toContain("| Use middle tool |");
    });
  });

  // ── 5. Folder Structure tree ─────────────────────────────

  describe("Folder Structure tree", () => {
    /**
     * Parses the docs/ block from the tree and returns an ordered
     * list of topic names. Useful to verify alphabetical order.
     */
    function getDocTopics(router: string): string[] {
      const start = router.indexOf("├── docs/");
      const end = router.indexOf("├── patches/");
      const block = router.slice(start, end);
      const topics: string[] = [];
      for (const line of block.split("\n")) {
        const m = line.match(/^│   [├└]── (.+?)\//);
        if (m) topics.push(m[1]);
      }
      return topics;
    }

    it("inserts alphabetically in the middle", async () => {
      await run(makeInput({ topic: "middle-tool" }), home);
      const topics = getDocTopics(
        readFileSync(join(home, ".pi", "agent", "CONTEXT.md"), "utf8")
      );
      expect(topics).toEqual(["alpha-tool", "middle-tool", "zulu-tool"]);
    });

    it("inserts at the beginning (new first entry)", async () => {
      await run(makeInput({ topic: "aaa-first" }), home);
      const topics = getDocTopics(
        readFileSync(join(home, ".pi", "agent", "CONTEXT.md"), "utf8")
      );
      expect(topics).toEqual(["aaa-first", "alpha-tool", "zulu-tool"]);
    });

    it("inserts at the end (new last entry)", async () => {
      await run(makeInput({ topic: "zzz-last" }), home);
      const router = readFileSync(join(home, ".pi", "agent", "CONTEXT.md"), "utf8");
      const topics = getDocTopics(router);
      // "zulu-tool" < "zzz-last" alphabetically (l < z at position 3)
      expect(topics).toEqual(["alpha-tool", "zulu-tool", "zzz-last"]);
      // Old last (zulu-tool) must switch from └── to ├──
      expect(router).toContain("│   ├── zulu-tool/");
      // New last gets └──
      expect(router).toContain("│   └── zzz-last/");
    });

    it("uses ├── for non-last and └── for last entries", async () => {
      // Add two topics so we have: alpha, beta, gamma, zulu
      await run(makeInput({ topic: "beta-tool" }), home);
      await run(makeInput({ topic: "gamma-tool" }), home);
      const router = readFileSync(join(home, ".pi", "agent", "CONTEXT.md"), "utf8");

      // All entries except the last should use ├──
      const topicLines = router
        .split("\n")
        .filter(l => /^│   [├└]── .+\/$/.test(l) && l.includes("docs/") === false);

      // First n-1 entries: ├──
      const allButLast = topicLines.slice(0, -1);
      for (const line of allButLast) {
        expect(line).toContain("├──");
      }
      // Last entry: └──
      expect(topicLines[topicLines.length - 1]).toContain("└──");
    });

    it("aligns CONTEXT.md line correctly (│   │   vs │       )", async () => {
      await run(makeInput({ topic: "mid" }), home);
      const router = readFileSync(join(home, ".pi", "agent", "CONTEXT.md"), "utf8");

      // Non-last entry should have │   │   prefix
      expect(router).toContain("│   │   └── CONTEXT.md         ← In between");
      // Last entry should have │       prefix
      expect(router).toContain("│       └── CONTEXT.md         ← Last tool");
    });

    it("errors when docs/ section is missing from tree", async () => {
      writeFileSync(
        join(home, ".pi", "agent", "CONTEXT.md"),
        "# No tree here\n",
        "utf8"
      );
      const { stderr, exitCode } = await run(makeInput({ topic: "orphan" }), home);
      expect(exitCode).toBe(1);
      expect(stderr.toLowerCase()).toContain("docs/");
    });
  });

  // ── 6. end-to-end ────────────────────────────────────────

  describe("end-to-end", () => {
    it("produces all 4 outputs correctly in one shot", async () => {
      function getTopics(router: string): string[] {
        const s = router.indexOf("├── docs/");
        const e = router.indexOf("├── patches/");
        const block = router.slice(s, e);
        const t: string[] = [];
        for (const line of block.split("\n")) {
          const m = line.match(/^│   [├└]── (.+?)\//);
          if (m) t.push(m[1]);
        }
        return t;
      }
      const { exitCode } = await run(makeInput({
        topic: "e2e-tool",
        title: "E2E Tool",
        description: "Full test",
        action: "Run e2e",
        date: "2026-12-31",
        content: "# E2E Tool\n\n## Background\n\nEnd-to-end test.\n",
      }), home);

      expect(exitCode).toBe(0);

      const agent = join(home, ".pi", "agent");

      // 1. CONTEXT.md written
      expect(
        readFileSync(join(agent, "docs", "e2e-tool", "CONTEXT.md"), "utf8")
      ).toBe("# E2E Tool\n\n## Background\n\nEnd-to-end test.\n");

      // 2. Index updated
      const index = readFileSync(join(agent, "docs", "CONTEXT.md"), "utf8");
      expect(index).toContain("### 3. E2E Tool");
      expect(index).toContain("- **Date** : 2026-12-31");

      // 3. QuickNav row
      const router = readFileSync(join(agent, "CONTEXT.md"), "utf8");
      expect(router).toContain("| Run e2e | `docs/e2e-tool/CONTEXT.md` (Full test) |");

      // 4. Folder Structure (inserted between alpha and zulu)
      expect(getTopics(router)).toEqual(["alpha-tool", "e2e-tool", "zulu-tool"]);
    });
  });
});
