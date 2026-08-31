import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "..", "bootstrap-enforcer-docs");

const ROUTER_FIXTURE = `
## Folder Structure

\`\`\`
~/.agents/
├── AGENTS.md
├── docs/
│   ├── CONTEXT.md
│   ├── alpha-tool.md          ← First
│   └── zulu-tool.md           ← Last
├── agent-enforcers/
\`\`\`
`;

const INDEX_FIXTURE = `# Docs

## Existing Enforcers

### 1. Alpha Tool
- **Date** : 2026-01-01
- **Doc** : [\`alpha-tool.md\`](alpha-tool.md)

### 2. Zulu Tool
- **Date** : 2026-01-01
- **Doc** : [\`zulu-tool.md\`](zulu-tool.md)
`;

function setupHarness(): string {
	const home = join(
		tmpdir(),
		`bs-int-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
	);
	const agent = join(home, ".agents");
	mkdirSync(join(agent, "docs"), { recursive: true });
	writeFileSync(join(agent, "AGENTS.md"), ROUTER_FIXTURE, "utf8");
	writeFileSync(join(agent, "docs", "CONTEXT.md"), INDEX_FIXTURE, "utf8");
	return home;
}

async function run(json: string, home: string) {
	const proc = Bun.spawn([process.argv[0] || "bun", SCRIPT], {
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
		wiring: "Pi ext + pre-hook",
		trigger: "bash command",
		...overrides,
	});
}

describe("bootstrap-enforcer-docs CLI integration", () => {
	let home = "";

	beforeEach(() => {
		home = setupHarness();
	});
	afterEach(() => {
		if (home) rmSync(home, { recursive: true, force: true });
	});

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

	describe("docs file", () => {
		it("writes <topic>.md directly in docs/", async () => {
			await run(makeJson({ topic: "test-tool" }), home);
			const doc = join(home, ".agents", "docs", "test-tool.md");
			expect(existsSync(doc)).toBe(true);
			expect(readFileSync(doc, "utf8")).toContain("Middle Tool");
		});
	});

	describe("docs index", () => {
		it("appends entry with correct number", async () => {
			await run(makeJson(), home);
			const index = readFileSync(
				join(home, ".agents", "docs", "CONTEXT.md"),
				"utf8",
			);
			expect(index).toContain("### 3. Middle Tool");
		});

		it("includes wiring and trigger when provided", async () => {
			await run(
				makeJson({
					wiring: "Pi ext + pre-hook + Antigravity",
					trigger: "git commit",
				}),
				home,
			);
			const index = readFileSync(
				join(home, ".agents", "docs", "CONTEXT.md"),
				"utf8",
			);
			expect(index).toContain("- **Wiring** : Pi ext + pre-hook + Antigravity");
			expect(index).toContain("- **Trigger** : git commit");
		});
	});

	describe("Folder Structure", () => {
		it("inserts alphabetically with correct box-drawing chars", async () => {
			await run(makeJson({ topic: "gamma-tool", action: "Gamma tool" }), home);
			const router = readFileSync(join(home, ".agents", "AGENTS.md"), "utf8");

			const ai = router.indexOf("│   ├── alpha-tool.md");
			const ci = router.indexOf("│   ├── CONTEXT.md");
			const gi = router.indexOf("│   ├── gamma-tool.md");
			const zi = router.indexOf("│   └── zulu-tool.md");

			expect(ai).toBeGreaterThan(0);
			expect(ci).toBeGreaterThan(ai);
			expect(gi).toBeGreaterThan(ci);
			expect(zi).toBeGreaterThan(gi);
			expect(router).toContain("│   ├── gamma-tool.md  ← Gamma tool");
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
				wiring: "Pi ext + pre-hook",
				trigger: "Write/Edit/Bash to dot* paths",
				content: "# Path Guard\n",
			});

			const { exitCode, stdout } = await run(json, home);
			expect(exitCode).toBe(0);
			expect(stdout).toContain("✓ docs/path-guard.md");
			expect(stdout).toContain("✓ docs/CONTEXT.md (entry 3)");
			expect(stdout).toContain("✓ Folder Structure (docs/path-guard.md)");
			expect(stdout).toContain("Done.");

			const agent = join(home, ".agents");
			const doc = readFileSync(join(agent, "docs", "path-guard.md"), "utf8");
			expect(doc).toContain("# Path Guard");

			const index = readFileSync(join(agent, "docs", "CONTEXT.md"), "utf8");
			expect(index).toContain("### 3. Path Guard");
			expect(index).toContain("- **Wiring** : Pi ext + pre-hook");
			expect(index).toContain("- **Trigger** : Write/Edit/Bash to dot* paths");

			const router = readFileSync(join(agent, "AGENTS.md"), "utf8");
			expect(router).toContain("│   ├── alpha-tool.md  ← First");
			expect(router).toContain("│   ├── path-guard.md  ← Enforce paths");
			expect(router).toContain("│   └── zulu-tool.md   ← Last");
		});
	});
});
