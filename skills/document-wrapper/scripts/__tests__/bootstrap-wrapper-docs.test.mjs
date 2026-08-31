import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
	new URL("../bootstrap-wrapper-docs.mjs", import.meta.url),
);

const routerFixture = `# Harness Config

## Folder Structure

\`\`\`
~/.gravity/
├── AGENTS.md
├── docs/
│   ├── CONTEXT.md          ← Index
│   ├── alpha-tool.md  ← First tool
│   └── zulu-tool.md   ← Last tool
├── patches/
└── settings.json
\`\`\`

## Quick Navigation

| Want to... | Go here |
|------------|---------|
| Use alpha | \`docs/alpha-tool.md\` (First tool) |
| Use zulu  | \`docs/zulu-tool.md\` (Last tool) |

## Skills

Skills here.
`;

const indexFixture = `# Docs

## Existing Modifications

### 1. Alpha Tool
- **Date** : 2026-01-01
- **Doc** : [\`alpha-tool.md\`](alpha-tool.md)

### 2. Zulu Tool
- **Date** : 2026-01-01
- **Doc** : [\`zulu-tool.md\`](zulu-tool.md)
`;

function setupHarness() {
	const home = mkdtempSync(join(tmpdir(), "bootstrap docs é-"));
	const agent = join(home, ".gravity");
	mkdirSync(join(agent, "docs"), { recursive: true });
	writeFileSync(join(agent, "CONTEXT.md"), routerFixture, "utf8");
	writeFileSync(join(agent, "docs", "CONTEXT.md"), indexFixture, "utf8");
	return home;
}

function run(input, home) {
	const result = spawnSync(process.execPath, [scriptPath], {
		encoding: "utf8",
		env: { ...process.env, HOME: home },
		input,
	});
	if (result.error) throw result.error;
	return {
		exitCode: result.status,
		stderr: result.stderr,
		stdout: result.stdout,
	};
}

function makeJson(overrides = {}) {
	return JSON.stringify({
		action: "Use middle",
		content: "# Middle Tool\n\n## Where / What\n\nMiddle.\n",
		date: "2026-06-29",
		description: "In between",
		title: "Middle Tool",
		topic: "middle-tool",
		...overrides,
	});
}

describe("bootstrap-wrapper-docs CLI integration", () => {
	let home = "";

	beforeEach(() => {
		home = setupHarness();
	});
	afterEach(() => {
		if (home) rmSync(home, { force: true, recursive: true });
	});

	describe("validation", () => {
		it("rejects malformed JSON", () => {
			const { stderr, exitCode } = run("not json", home);
			assert.equal(exitCode, 1);
			assert.equal(stderr, "ERROR: invalid JSON on stdin\n");
		});

		it("rejects empty topic", () => {
			const { stderr, exitCode } = run(makeJson({ topic: "" }), home);
			assert.equal(exitCode, 1);
			assert.equal(
				stderr,
				'ERROR: field "topic" is required and must not be empty\n',
			);
		});
	});

	describe("CONTEXT.md file", () => {
		it("creates file and writes content", () => {
			run(makeJson({ topic: "test-tool" }), home);
			const doc = join(home, ".gravity", "docs", "test-tool.md");
			assert.equal(existsSync(doc), true);
			assert.ok(readFileSync(doc, "utf8").includes("Middle Tool"));
		});
	});

	describe("docs index", () => {
		it("appends entry with correct number", () => {
			run(makeJson(), home);
			const index = readFileSync(
				join(home, ".gravity", "docs", "CONTEXT.md"),
				"utf8",
			);
			assert.ok(index.includes("### 3. Middle Tool"));
		});

		it("creates the wrapper index when it is absent", () => {
			const indexPath = join(home, ".gravity", "docs", "CONTEXT.md");
			rmSync(indexPath);
			const { exitCode } = run(makeJson(), home);
			assert.equal(exitCode, 0);
			const index = readFileSync(indexPath, "utf8");
			assert.ok(index.startsWith("# Wrapper Documentation\n\n## Wrappers\n"));
			assert.ok(index.includes("### 1. Middle Tool"));
		});
	});

	describe("Quick Navigation", () => {
		it("inserts row before ## Skills", () => {
			run(makeJson({ action: "Use middle" }), home);
			const router = readFileSync(join(home, ".gravity", "CONTEXT.md"), "utf8");
			const row = router.indexOf("| Use middle |");
			const skills = router.indexOf("\n## Skills");
			assert.ok(row > 0);
			assert.ok(row < skills);
		});
	});

	describe("Folder Structure", () => {
		it("inserts alphabetically with correct box-drawing chars", () => {
			run(makeJson({ topic: "gamma-tool", description: "Gamma" }), home);
			const router = readFileSync(join(home, ".gravity", "CONTEXT.md"), "utf8");
			const alphaIndex = router.indexOf("│   ├── alpha-tool.md");
			const gammaIndex = router.indexOf("│   ├── gamma-tool.md");
			const zuluIndex = router.indexOf("│   └── zulu-tool.md");
			assert.ok(alphaIndex > 0);
			assert.ok(gammaIndex > alphaIndex);
			assert.ok(zuluIndex > gammaIndex);
			assert.ok(router.includes("│   ├── gamma-tool.md"));
			assert.ok(router.includes("│   └── zulu-tool.md"));
		});
	});

	describe("end-to-end", () => {
		it("simulates a real new extension documentation", () => {
			const input = JSON.stringify({
				action: "Customize compaction behavior",
				content:
					"# Auto Compactor\n\n## Where / What\n\nLives at `extensions/auto-compactor.ts`.\n\n## How It Works\n\nHooks into `before_compaction`.\n\n## Background\n\nAdded for per-project tuning.\n",
				date: "2026-06-29",
				description: "Custom compaction rules per project",
				title: "Auto Compactor",
				topic: "auto-compactor",
			});
			const { exitCode, stdout } = run(input, home);
			assert.equal(exitCode, 0);
			assert.ok(stdout.includes("✓ docs/auto-compactor.md"));
			assert.ok(stdout.includes("✓ docs/CONTEXT.md (entry 3)"));
			assert.ok(stdout.includes("✓ Quick Navigation row"));
			assert.ok(stdout.includes("✓ Folder Structure (docs/auto-compactor.md)"));
			assert.ok(stdout.includes("Done."));

			const agent = join(home, ".gravity");
			const doc = readFileSync(
				join(agent, "docs", "auto-compactor.md"),
				"utf8",
			);
			assert.ok(doc.includes("# Auto Compactor"));
			assert.ok(doc.includes("`extensions/auto-compactor.ts`"));

			const index = readFileSync(join(agent, "docs", "CONTEXT.md"), "utf8");
			assert.ok(index.includes("### 3. Auto Compactor"));
			assert.ok(index.includes("2026-06-29"));

			const router = readFileSync(join(agent, "CONTEXT.md"), "utf8");
			assert.ok(router.includes("Customize compaction behavior"));
			assert.ok(router.includes("│   ├── auto-compactor.md"));
			assert.ok(router.includes("Custom compaction rules per project"));
		});
	});
});
