import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { validateBunPolicy } from "../validate-bun-policy.mjs";

function writeFile(path, contents) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, contents, "utf8");
}

function createRepository(t, permanentExceptions = []) {
	const root = mkdtempSync(join(tmpdir(), "bun policy "));
	t.after(() => rmSync(root, { force: true, recursive: true }));
	writeFile(join(root, "package.json"), '{"scripts":{"test":"node --test"}}\n');
	writeFile(
		join(root, "tests/example.test.mjs"),
		'import test from "node:test";\n',
	);
	writeFile(
		join(root, "docs/migrations/node-pnpm/test-parity.json"),
		`${JSON.stringify({
			surfaces: [
				{ parityStatus: "green", targetFile: "tests/example.test.mjs" },
			],
		})}\n`,
	);
	writeFile(
		join(root, "docs/migrations/node-pnpm/bun-allowlist.json"),
		`${JSON.stringify({
			version: 1,
			status: "active",
			default: "deny",
			testParityManifest: "docs/migrations/node-pnpm/test-parity.json",
			expectedGreenSurfaces: 1,
			excludedPathRules: [".git/**", "node_modules/**", "docs/archive/**"],
			permanentExceptions,
		})}\n`,
	);
	return root;
}

function assertPolicyViolation(root, pattern) {
	assert.throws(() => validateBunPolicy(root), pattern);
}

test("accepts a Node-only repository with complete green parity", (t) => {
	const root = createRepository(t);
	assert.deepEqual(validateBunPolicy(root), {
		exceptionCount: 0,
		greenSurfaceCount: 1,
	});
});

test("rejects active runtime globals and test imports", (t) => {
	const root = createRepository(t);
	writeFile(
		join(root, "src/runtime.mjs"),
		"export const value = Bun.file('x');\n",
	);
	writeFile(
		join(root, "tests/runtime.test.mjs"),
		'import { test } from "bun:test";\n',
	);
	assertPolicyViolation(
		root,
		/src\/runtime\.mjs: unallowlisted runtime reference/,
	);
	assertPolicyViolation(
		root,
		/tests\/runtime\.test\.mjs: test imports or uses/,
	);
});

test("rejects package scripts, dependencies, locks, and runtime config", (t) => {
	const root = createRepository(t);
	writeFile(
		join(root, "package.json"),
		'{"scripts":{"test":"bun test"},"devDependencies":{"@types/bun":"1.0.0"}}\n',
	);
	writeFile(join(root, "bun.lock"), "");
	writeFile(join(root, "config/bunfig.toml"), "");
	assertPolicyViolation(root, /package\.json: scripts\.test/);
	assertPolicyViolation(root, /package\.json: devDependencies\.@types\/bun/);
	assertPolicyViolation(root, /bun\.lock: retired lockfile/);
	assertPolicyViolation(root, /config\/bunfig\.toml: retired lockfile/);
});

test("allows only exact, live external-interoperability exceptions", (t) => {
	const exception = {
		path: "src/external-runner.ts",
		category: "external-project-interop",
		owner: "external-runner",
		removalCondition: "Remove when external package-manager support ends.",
		requiredLiterals: ['"bun"'],
		rationale: "Detects a package manager selected by an external repository.",
	};
	const root = createRepository(t, [exception]);
	writeFile(
		join(root, exception.path),
		'export const packageManagers = ["bun", "pnpm"];\n',
	);
	assert.equal(validateBunPolicy(root).exceptionCount, 1);

	writeFile(
		join(root, exception.path),
		'export const packageManagers = ["pnpm"];\n',
	);
	assertPolicyViolation(root, /missing required literal/);
});

test("rejects stale and duplicate permanent exceptions", (t) => {
	const exception = {
		path: "src/missing.ts",
		category: "external-project-interop",
		owner: "missing-runner",
		removalCondition: "Remove when external package-manager support ends.",
		requiredLiterals: ["bun"],
		rationale: "External package-manager compatibility.",
	};
	const root = createRepository(t, [exception, exception]);
	assertPolicyViolation(root, /duplicate permanent exception/);
	assertPolicyViolation(root, /stale exception path/);
});

test("ignores explicitly archived historical artifacts", (t) => {
	const root = createRepository(t);
	writeFile(join(root, "docs/archive/legacy.ts"), "Bun.write('x', 'y');\n");
	writeFile(join(root, "docs/archive/bun.lock"), "");
	assert.equal(validateBunPolicy(root).exceptionCount, 0);
});

test("fails closed when parity is incomplete", (t) => {
	const root = createRepository(t);
	writeFile(
		join(root, "docs/migrations/node-pnpm/test-parity.json"),
		'{"surfaces":[{"parityStatus":"pending","targetFile":"tests/example.test.mjs"}]}\n',
	);
	assertPolicyViolation(root, /expected 1\/1 green surfaces, got 0\/1/);
});
