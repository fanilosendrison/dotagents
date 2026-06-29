import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SCRIPT = join(import.meta.dir, "..", "bootstrap-enforcer-docs");

const ROUTER_FIXTURE = `
## Folder Structure

\`\`\`
~/.agents/
├── AGENTS.md
├── docs/
│   ├── CONTEXT.md
│   └── alpha-tool/
│       └── CONTEXT.md        ← First
├── agent-enforcers/
\`\`\`
`;

const INDEX_FIXTURE = `# Docs

## Existing Enforcers

### 1. Alpha Tool
- **Date** : 2026-01-01
- **Doc** : [\`alpha-tool/CONTEXT.md\`](alpha-tool/CONTEXT.md)

### 2. Zulu Tool
- **Date** : 2026-01-01
- **Doc** : [\`zulu-tool/CONTEXT.md\`](zulu-tool/CONTEXT.md)
`;

function setupHarness(): string {
  const home = join(tmpdir(), `bs-int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const agent = join(home, ".agents");
  mkdirSync(join(agent, "docs"), { recursive: true });
  writeFileSync(join(agent, "AGENTS.md"), ROUTER_FIXTURE, "utf8");
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

describe("bootstrap-enforcer-docs CLI integration", () => {
  let home = "";

  beforeEach(() => { home = setupHarness(); });
  afterEach(() => { if (home) rmSync(home, { recursive: true, force: true }); });

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

  describe("CONTEXT.md file", () => {
    it("creates folder and writes content", async () => {
      await run(makeJson({ topic: "test-tool" }), home);
      const doc = join(home, ".agents", "docs", "test-tool", "CONTEXT.md");
      expect(existsSync(doc)).toBe(true);
      expect(readFileSync(doc, "utf8")).toContain("Middle Tool");
    });
  });

  describe("docs index", () => {
    it("appends entry with correct number", async () => {
      await run(makeJson(), home);
      const index = readFileSync(
        join(home, ".agents", "docs", "CONTEXT.md"), "utf8",
      );
      expect(index).toContain("### 3. Middle Tool");
    });
  });

  describe("Folder Structure", () => {
    it("inserts alphabetically with correct box-drawing chars", async () => {
      await run(makeJson({ topic: "gamma-tool", action: "Gamma" }), home);
      const router = readFileSync(join(home, ".agents", "AGENTS.md"), "utf8");
      expect(router).toContain("│   ├── alpha-tool/");
      expect(router).toContain("│   └── gamma-tool/");
      expect(router).toContain("│       └── CONTEXT.md        ← Gamma");
    });
  });

  describe("end-to-end", () => {
    it("simulates a real new extension documentation", async () => {
      const json = JSON.stringify({
        topic: "path-guard",
        title: "Path Guard",
        description: "Blocks restricted paths",
        action: "Enforce paths",
        date: "2026-06-29",
        content: "# Path Guard\n",
      });

      const { exitCode, stdout } = await run(json, home);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("✓ docs/path-guard/CONTEXT.md");
      expect(stdout).toContain("✓ docs/CONTEXT.md (entry 3)");
      expect(stdout).toContain("✓ Folder Structure (docs/path-guard/)");
      expect(stdout).toContain("Done.");

      const agent = join(home, ".agents");
      const doc = readFileSync(join(agent, "docs", "path-guard", "CONTEXT.md"), "utf8");
      expect(doc).toContain("# Path Guard");

      const index = readFileSync(join(agent, "docs", "CONTEXT.md"), "utf8");
      expect(index).toContain("### 3. Path Guard");

      const router = readFileSync(join(agent, "AGENTS.md"), "utf8");
      expect(router).toContain("│   ├── alpha-tool/");
      expect(router).toContain("│   └── path-guard/");
      expect(router).toContain("│       └── CONTEXT.md        ← Enforce paths");
    });
  });
});
