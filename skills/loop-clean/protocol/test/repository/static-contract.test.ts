import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, test } from "node:test";

const repositoryRoot = resolve(import.meta.dirname, "../../../../..");
const read = (relativePath: string): string =>
	readFileSync(resolve(repositoryRoot, relativePath), "utf8");

const SKIP_DIRS = new Set(["node_modules", ".git"]);
const SKIP_FILES = new Set(["bun.lock"]);

function globFiles(root: string, pattern: string): string[] {
	const prefix = pattern.replace(/\/\*\*$/, "");
	const dir = join(root, prefix);
	if (!existsSync(dir)) return [];
	const result: string[] = [];
	function walk(d: string) {
		for (const name of readdirSync(d)) {
			const full = join(d, name);
			if (statSync(full).isDirectory()) {
				if (!SKIP_DIRS.has(name)) walk(full);
			} else if (!SKIP_FILES.has(name)) {
				result.push(relative(root, full));
			}
		}
	}
	walk(dir);
	return result;
}

function sourceFiles(directory: string): string[] {
	const files: string[] = [];
	for (const name of readdirSync(directory)) {
		const path = join(directory, name);
		if (statSync(path).isDirectory()) {
			if (!SKIP_DIRS.has(name)) files.push(...sourceFiles(path));
		} else if (path.endsWith(".ts") && !SKIP_FILES.has(name)) {
			files.push(path);
		}
	}
	return files;
}

describe("production protocol contract", () => {
	test("contains no executable mutating Git command in loop-clean production", () => {
		const productionFiles = [
			"skills/loop-clean/loop-clean.sh",
			"agents/loop-clean-orchestrator.md",
		];
		const mutatingCommand =
			/(?:^|[\s;&|`$(])git(?:\s+-C\s+(?:"[^"]+"|'[^']+'|\S+))*\s+(add|commit|push|reset|restore|checkout|switch|stash|clean|merge|rebase|cherry-pick)\b/;
		for (const relativePath of productionFiles) {
			const executableLines = read(relativePath)
				.split("\n")
				.filter((line) => !/^\s*#/.test(line))
				.filter(
					(line) =>
						!/\b(?:never|must not|do not|ne pas|interdit)\b/i.test(line),
				);
			assert.doesNotMatch(executableLines.join("\n"), mutatingCommand);
		}
	});

	test("allows only read-only Git subcommands in the technical package", () => {
		const forbiddenLiteral =
			/["'](add|commit|push|reset|restore|checkout|switch|stash|clean|merge|rebase|cherry-pick)["']/;
		const protocolSourceRoot = resolve(
			repositoryRoot,
			"skills/loop-clean/protocol/src",
		);
		for (const path of sourceFiles(protocolSourceRoot)) {
			const contents = readFileSync(path, "utf8");
			assert.doesNotMatch(contents, forbiddenLiteral);
			if (contents.includes('executeProcess("git"')) {
				assert.ok(contents.includes('["-C", repositoryRoot'));
				assert.ok(contents.includes('GIT_OPTIONAL_LOCKS: "0"'));
			}
		}
		assert.ok(
			read("skills/loop-clean/loop-clean.sh").includes(
				'_emit_export GIT_OPTIONAL_LOCKS "0"',
			),
		);
	});

	test("removes every legacy production feature from the production perimeter", () => {
		const productionGlobs = [
			"skills/loop-clean/**",
			"skills/fix-or-backlog/**",
			"skills/coding-standards/**",
			"skills/senior-review/**",
			"skills/dedup-codebase/**",
		];
		const productionAgentGlobs = ["agents/**"];
		const productionSourceGlobs = [
			"skills/loop-clean/protocol/src/**",
			"scripts/coding-standards-scanner/src/**",
			"scripts/coding-standards-consolidate/src/**",
		];
		const allProductionPaths = [
			...productionGlobs.flatMap((g) => globFiles(repositoryRoot, g)),
			...productionAgentGlobs.flatMap((g) => globFiles(repositoryRoot, g)),
			...productionSourceGlobs.flatMap((g) => globFiles(repositoryRoot, g)),
			"scripts/package.json",
		].filter((p) => !p.includes("/test/") && !p.endsWith(".test.ts"));
		const forbiddenLiteralTerms = [
			"LOOP_CLEAN_BASE_SHA",
			"LOOP_CLEAN_COMMIT_PER_ITER",
			"commit-iter",
			"cmd_commit_iter",
			"scope_mode",
			"--scope=audit",
			"direction-block",
			"drift_id",
		];
		for (const relativePath of allProductionPaths) {
			const contents = read(relativePath);
			for (const term of forbiddenLiteralTerms)
				assert.ok(!contents.includes(term));
			assert.doesNotMatch(contents, /spec[-_ ]drift/i);
		}
		assert.strictEqual(
			existsSync(resolve(repositoryRoot, "scripts/spec-drift")),
			false,
		);
		assert.strictEqual(
			existsSync(
				resolve(repositoryRoot, "skills/loop-clean/loop-clean-test.sh"),
			),
			false,
		);
	});

	test("registers the protocol suite once and no removed package scripts", () => {
		const rootPackageJson = JSON.parse(read("package.json"));
		const scriptsPackageJson = JSON.parse(read("scripts/package.json"));

		assert.ok(rootPackageJson.scripts.test.includes("test:protocol:bun"));
		assert.ok(
			rootPackageJson.scripts["test:protocol"].includes(
				"@dotagents/loop-clean-protocol",
			),
		);
		assert.ok(
			rootPackageJson.scripts["test:protocol:bun"].includes("test:bun"),
		);
		assert.ok(
			!scriptsPackageJson.scripts.test.includes("skills/loop-clean/protocol"),
		);
		for (const scriptName of Object.keys(scriptsPackageJson.scripts)) {
			assert.doesNotMatch(scriptName, /^spec-drift(?::|$)/);
			assert.doesNotMatch(scriptName, /^loop-clean-protocol/);
		}
		assert.doesNotMatch(scriptsPackageJson.scripts.test, /spec-drift/);
		assert.strictEqual(
			scriptsPackageJson.scripts.test,
			"node test/run-tests.mjs",
		);
		assert.ok(
			scriptsPackageJson.scripts["test:bun"].includes("lib/stack-tools"),
		);
	});

	test("loop-clean.sh passes bash syntax validation", () => {
		const result = spawnSync(
			"bash",
			["-n", "skills/loop-clean/loop-clean.sh"],
			{
				cwd: repositoryRoot,
				encoding: "utf8",
				shell: false,
			},
		);
		assert.strictEqual(result.status, 0);
		assert.strictEqual(result.stderr, "");
	});

	test("documents and enforces the exact orchestration order", () => {
		const orchestrator = read("agents/loop-clean-orchestrator.md");
		const orderedMarkers = [
			"prepare-iter",
			"coding-standards",
			"senior-review",
			"dedup-codebase",
			"runtime-gate",
			"collect-findings",
			"decide",
			"fix-or-backlog",
			"validate-routing",
		];
		const protocolList = [...orchestrator.matchAll(/^\d+\. `([^`]+)`/gm)].map(
			(match) => match[1],
		);
		assert.deepStrictEqual(
			protocolList.slice(0, orderedMarkers.length),
			orderedMarkers,
		);
		assert.ok(orchestrator.includes("four canonical sources"));
		assert.ok(orchestrator.includes("LOOP_CLEAN_SCOPE_FILE"));
		assert.ok(orchestrator.includes("must not recalculate the scope"));
	});

	test("makes findings.json the sole orchestrated routing input", () => {
		const skill = read("skills/fix-or-backlog/SKILL.md");
		assert.ok(skill.includes("$LOOP_CLEAN_FINDINGS_FILE"));
		for (const sourceReport of [
			"coding-standards.json",
			"senior-review.json",
			"dedup-codebase.json",
			"runtime-gate.json",
		]) {
			assert.ok(!skill.includes(sourceReport));
		}
		assert.ok(skill.includes("LOOP_CLEAN_BACKLOG_PATH"));
		assert.ok(skill.includes("LOOP_CLEAN_DESIGN_QUEUE_PATH"));
		assert.doesNotMatch(skill, />>\s*backlog\.md/);
	});

	test("requires every producer to consume and echo the manifest digest", () => {
		for (const relativePath of [
			"skills/coding-standards/SKILL.md",
			"skills/senior-review/SKILL.md",
			"skills/dedup-codebase/SKILL.md",
		]) {
			const contents = read(relativePath);
			assert.ok(contents.includes("LOOP_CLEAN_SCOPE_FILE"));
			assert.ok(contents.includes("scope_digest"));
		}
		const orchestrator = read("agents/loop-clean-orchestrator.md");
		assert.ok(orchestrator.includes("LOOP_CLEAN_SCOPE_DIGEST"));
	});

	test("contains no residual references to the old protocol location and no ~/.claude in canonical sources", () => {
		const productionGlobs = [
			"skills/loop-clean/**",
			"skills/fix-or-backlog/**",
			"skills/coding-standards/**",
			"skills/senior-review/**",
			"skills/dedup-codebase/**",
		];
		const productionAgentGlobs = ["agents/**"];
		const productionSourceGlobs = [
			"scripts/coding-standards-scanner/src/**",
			"scripts/coding-standards-consolidate/src/**",
			"scripts/lib/coding-standards-schema/src/**",
			"scripts/lib/stack-tools/src/**",
		];
		const allProductionPaths = [
			...productionGlobs.flatMap((g) => globFiles(repositoryRoot, g)),
			...productionAgentGlobs.flatMap((g) => globFiles(repositoryRoot, g)),
			...productionSourceGlobs.flatMap((g) => globFiles(repositoryRoot, g)),
			"scripts/package.json",
		].filter((p) => !p.includes("/test/") && !p.endsWith(".test.ts"));
		for (const relativePath of allProductionPaths) {
			const contents = read(relativePath);
			assert.ok(!contents.includes("scripts/loop-clean-protocol"));
			assert.doesNotMatch(contents, /~\/\.claude\//);
		}
	});

	test("old protocol directory no longer exists", () => {
		assert.strictEqual(
			existsSync(resolve(repositoryRoot, "scripts/loop-clean-protocol")),
			false,
		);
	});

	test("script libraries and runtime paths are canonical", () => {
		// stack-tools must be present
		assert.strictEqual(
			existsSync(
				resolve(repositoryRoot, "scripts/lib/stack-tools/src/index.ts"),
			),
			true,
		);
		// .agents/run is the canonical runtime
		const shellScript = read("skills/loop-clean/loop-clean.sh");
		assert.ok(shellScript.includes(".agents/run/loop-clean"));
		assert.doesNotMatch(shellScript, /\.claude\/run\/loop-clean/);
		// .claude/run exclusion for legacy ledgers
		const collectScope = read(
			"skills/loop-clean/protocol/src/scope/collect-scope.ts",
		);
		assert.ok(collectScope.includes(".claude/run"));
		assert.ok(collectScope.includes(".agents/run"));
	});

	test("protocol package is self-contained with package.json, bun.lock, and tsconfig.json", () => {
		const protocolRoot = resolve(repositoryRoot, "skills/loop-clean/protocol");
		assert.strictEqual(existsSync(resolve(protocolRoot, "package.json")), true);
		assert.strictEqual(existsSync(resolve(protocolRoot, "bun.lock")), true);
		assert.strictEqual(
			existsSync(resolve(protocolRoot, "tsconfig.json")),
			true,
		);
		assert.strictEqual(existsSync(resolve(protocolRoot, "bunfig.toml")), true);
	});

	test("loop-clean.sh points to the adjacent protocol CLI", () => {
		const shellScript = read("skills/loop-clean/loop-clean.sh");
		assert.ok(shellScript.includes("$SCRIPT_DIR/protocol/src/cli.ts"));
		assert.ok(!shellScript.includes("scripts/loop-clean-protocol"));
	});

	test("all protocol CLI calls go through _run_protocol with --no-install", () => {
		const shellScript = read("skills/loop-clean/loop-clean.sh");
		assert.match(
			shellScript,
			/_run_protocol\(\)\s*\{\s*node "\$PROTOCOL_CLI" "\$@"\s*\}/m,
		);
		assert.doesNotMatch(shellScript, /bun.*\$PROTOCOL_CLI/);
	});

	test("bunfig.toml disables runtime auto-install", () => {
		const bunfig = read("skills/loop-clean/protocol/bunfig.toml");
		assert.ok(bunfig.includes("[install]"));
		assert.ok(bunfig.includes('auto = "disable"'));
	});
});
