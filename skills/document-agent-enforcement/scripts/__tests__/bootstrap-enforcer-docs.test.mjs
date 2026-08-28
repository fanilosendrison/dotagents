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
	new URL("../bootstrap-enforcer-docs.mjs", import.meta.url),
);

const routerFixture = `
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

const indexFixture = `# Docs

## Existing Enforcers

### 1. Alpha Tool
- **Date** : 2026-01-01
- **Doc** : [\`alpha-tool.md\`](alpha-tool.md)

### 2. Zulu Tool
- **Date** : 2026-01-01
- **Doc** : [\`zulu-tool.md\`](zulu-tool.md)
`;

function setupHarness() {
	const home = mkdtempSync(join(tmpdir(), "bootstrap enforcer docs é-"));
	const agent = join(home, ".agents");
	mkdirSync(join(agent, "docs"), { recursive: true });
	writeFileSync(join(agent, "AGENTS.md"), routerFixture, "utf8");
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
		trigger: "bash command",
		wiring: "Pi ext + pre-hook",
		...overrides,
	});
}

describe("bootstrap-enforcer-docs CLI integration", () => {
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

	describe("docs file", () => {
		it("writes <topic>.md directly in docs/", () => {
			run(makeJson({ topic: "test-tool" }), home);
			const doc = join(home, ".agents", "docs", "test-tool.md");
			assert.equal(existsSync(doc), true);
			assert.ok(readFileSync(doc, "utf8").includes("Middle Tool"));
		});
	});

	describe("docs index", () => {
		it("appends entry with correct number", () => {
			run(makeJson(), home);
			const index = readFileSync(
				join(home, ".agents", "docs", "CONTEXT.md"),
				"utf8",
			);
			assert.ok(index.includes("### 3. Middle Tool"));
		});

		it("includes wiring and trigger when provided", () => {
			run(
				makeJson({
					trigger: "git commit",
					wiring: "Pi ext + pre-hook + Antigravity",
				}),
				home,
			);
			const index = readFileSync(
				join(home, ".agents", "docs", "CONTEXT.md"),
				"utf8",
			);
			assert.ok(
				index.includes("- **Wiring** : Pi ext + pre-hook + Antigravity"),
			);
			assert.ok(index.includes("- **Trigger** : git commit"));
		});
	});

	describe("Folder Structure", () => {
		it("inserts alphabetically with correct box-drawing chars", () => {
			run(makeJson({ topic: "gamma-tool", action: "Gamma tool" }), home);
			const router = readFileSync(join(home, ".agents", "AGENTS.md"), "utf8");
			const alphaIndex = router.indexOf("│   ├── alpha-tool.md");
			const contextIndex = router.indexOf("│   ├── CONTEXT.md");
			const gammaIndex = router.indexOf("│   ├── gamma-tool.md");
			const zuluIndex = router.indexOf("│   └── zulu-tool.md");
			assert.ok(alphaIndex > 0);
			assert.ok(contextIndex > alphaIndex);
			assert.ok(gammaIndex > contextIndex);
			assert.ok(zuluIndex > gammaIndex);
			assert.ok(router.includes("│   ├── gamma-tool.md  ← Gamma tool"));
		});
	});

	describe("end-to-end", () => {
		it("simulates a real new extension documentation", () => {
			const input = JSON.stringify({
				action: "Enforce paths",
				content: "# Path Guard\n",
				date: "2026-06-29",
				description: "Blocks restricted paths",
				title: "Path Guard",
				topic: "path-guard",
				trigger: "Write/Edit/Bash to dot* paths",
				wiring: "Pi ext + pre-hook",
			});
			const { exitCode, stdout } = run(input, home);
			assert.equal(exitCode, 0);
			assert.ok(stdout.includes("✓ docs/path-guard.md"));
			assert.ok(stdout.includes("✓ docs/CONTEXT.md (entry 3)"));
			assert.ok(stdout.includes("✓ Folder Structure (docs/path-guard.md)"));
			assert.ok(stdout.includes("Done."));

			const agent = join(home, ".agents");
			assert.ok(
				readFileSync(join(agent, "docs", "path-guard.md"), "utf8").includes(
					"# Path Guard",
				),
			);
			const index = readFileSync(join(agent, "docs", "CONTEXT.md"), "utf8");
			assert.ok(index.includes("### 3. Path Guard"));
			assert.ok(index.includes("- **Wiring** : Pi ext + pre-hook"));
			assert.ok(
				index.includes("- **Trigger** : Write/Edit/Bash to dot* paths"),
			);
			const router = readFileSync(join(agent, "AGENTS.md"), "utf8");
			assert.ok(router.includes("│   ├── alpha-tool.md  ← First"));
			assert.ok(router.includes("│   ├── path-guard.md  ← Enforce paths"));
			assert.ok(router.includes("│   └── zulu-tool.md   ← Last"));
		});
	});
});
