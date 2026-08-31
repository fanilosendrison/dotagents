import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, test } from "node:test";
import {
	resolvePackageManager,
	runRuntimeGate,
} from "../../src/runtime/run-runtime-gate.ts";
import { collectScope } from "../../src/scope/collect-scope.ts";
import {
	createRepository,
	removeRepository,
	writeRepositoryFile,
} from "../helpers/git-fixture.ts";

const repositories: string[] = [];

async function setup(
	stackEvaluation?: string,
	initialDirtyContent?: string,
	repositoryFiles: Readonly<Record<string, string>> = {},
): Promise<{
	readonly root: string;
	readonly scopeFile: string;
	readonly scopeDigest: string;
}> {
	const root = await createRepository();
	repositories.push(root);
	if (stackEvaluation !== undefined) {
		await writeRepositoryFile(root, "STACK_EVAL.yaml", stackEvaluation);
	}
	if (initialDirtyContent !== undefined) {
		await writeRepositoryFile(root, "dirty.ts", initialDirtyContent);
	}
	for (const [relativePath, contents] of Object.entries(repositoryFiles).sort(
		([left], [right]) => left.localeCompare(right),
	)) {
		await writeRepositoryFile(root, relativePath, contents);
	}
	const manifest = await collectScope(root);
	const scopeFile = join(root, ".git", "loop-clean-runtime-scope.json");
	await writeFile(scopeFile, `${JSON.stringify(manifest)}\n`);
	return { root, scopeFile, scopeDigest: manifest.digest };
}

afterEach(async () => {
	for (const root of repositories.splice(0)) await removeRepository(root);
});

describe("resolvePackageManager", () => {
	test("prefers an explicit STACK_EVAL declaration over package.json and lockfiles", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);
		await writeRepositoryFile(root, "bun.lock", "");
		await writeRepositoryFile(root, "pnpm-lock.yaml", "");

		assert.strictEqual(
			resolvePackageManager(
				root,
				{ package_manager: "yarn" },
				{ packageManager: "pnpm@11.24.0" },
			),
			"yarn",
		);
	});

	test("prefers the standard packageManager field over conflicting lockfiles", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);
		await writeRepositoryFile(root, "bun.lock", "");
		await writeRepositoryFile(root, "pnpm-lock.yaml", "");

		assert.strictEqual(
			resolvePackageManager(root, null, { packageManager: "npm@10.9.0" }),
			"npm",
		);
	});

	test("recognizes every supported unique lockfile", async () => {
		for (const [lockfile, expectedPackageManager] of [
			["bun.lock", "bun"],
			["bun.lockb", "bun"],
			["pnpm-lock.yaml", "pnpm"],
			["yarn.lock", "yarn"],
			["package-lock.json", "npm"],
			["npm-shrinkwrap.json", "npm"],
		] as const) {
			const root = await createRepository({ withBaseline: false });
			repositories.push(root);
			await writeRepositoryFile(root, lockfile, "");
			assert.strictEqual(
				resolvePackageManager(root, null, {}),
				expectedPackageManager,
			);
		}
	});

	test("fails closed when multiple lockfiles exist without a declaration", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);
		await writeRepositoryFile(root, "bun.lock", "");
		await writeRepositoryFile(root, "pnpm-lock.yaml", "");

		assert.throws(
			() => resolvePackageManager(root, null, {}),
			/Multiple package-manager lockfiles.*bun\.lock.*pnpm-lock\.yaml/i,
		);
	});

	test("fails closed on an unsupported packageManager declaration", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);

		assert.throws(
			() => resolvePackageManager(root, null, { packageManager: "deno@2.0.0" }),
			/Unsupported package manager.*package\.json.*deno/i,
		);
	});

	test("preserves the npm fallback when no declaration or lockfile exists", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);

		assert.strictEqual(resolvePackageManager(root, null, {}), "npm");
	});
});

describe("runRuntimeGate", () => {
	test("runs configured test, lint, and typecheck commands in protocol order", async () => {
		const { root, scopeFile, scopeDigest } = await setup(
			[
				'test_command: "printf test"',
				'lint_command: "printf lint"',
				'typecheck_command: "printf typecheck"',
				"",
			].join("\n"),
		);
		const report = await runRuntimeGate({ repoRoot: root, scopeFile });
		assert.strictEqual(report.status, "pass");
		assert.strictEqual(report.scope_digest, scopeDigest);
		assert.deepStrictEqual(
			report.checks.map((check) => [
				check.name,
				check.status,
				check.output_tail,
			]),
			[
				["test", "pass", "test"],
				["lint", "pass", "lint"],
				["typecheck", "pass", "typecheck"],
			],
		);
		assert.deepStrictEqual(report.findings, []);
	});

	test("marks absent checks as skipped", async () => {
		const { root, scopeFile } = await setup();
		const report = await runRuntimeGate({ repoRoot: root, scopeFile });
		assert.strictEqual(report.status, "skipped");
		assert.deepStrictEqual(report.checks, [
			{
				name: "test",
				command: "",
				status: "skipped",
				exit_code: null,
				output_tail: "",
			},
			{
				name: "lint",
				command: "",
				status: "skipped",
				exit_code: null,
				output_tail: "",
			},
			{
				name: "typecheck",
				command: "",
				status: "skipped",
				exit_code: null,
				output_tail: "",
			},
		]);
	});

	test("fails closed before checks when package-manager lockfiles are ambiguous", async () => {
		const { root, scopeFile } = await setup(undefined, undefined, {
			"bun.lock": "",
			"package.json": `${JSON.stringify({ scripts: { test: "printf test" } })}\n`,
			"pnpm-lock.yaml": "",
		});

		await assert.rejects(
			runRuntimeGate({ repoRoot: root, scopeFile }),
			/Multiple package-manager lockfiles.*bun\.lock.*pnpm-lock\.yaml/i,
		);
	});

	test("emits stable critical findings for every failed check", async () => {
		const { root, scopeFile } = await setup(
			[
				'test_command: "printf test-failed; exit 7"',
				'lint_command: "printf lint-ok"',
				'typecheck_command: "printf type-failed; exit 9"',
				"",
			].join("\n"),
		);
		const first = await runRuntimeGate({ repoRoot: root, scopeFile });
		const second = await runRuntimeGate({ repoRoot: root, scopeFile });
		assert.strictEqual(first.status, "fail");
		assert.strictEqual(first.findings.length, 2);
		assert.deepStrictEqual(
			first.findings.map((entry) => entry.id),
			second.findings.map((entry) => entry.id),
		);
		for (const entry of first.findings) {
			assert.partialDeepStrictEqual(entry, {
				source: "runtime-gate",
				axis: "runtime-failure",
				severity: "critical",
				file: "",
				line_start: null,
				line_end: null,
				fix_proposal: "Identify and fix the root cause of the failing check.",
			});
			assert.doesNotMatch(entry.problem, /iter/i);
			assert.ok(entry.evidence.length <= 8192);
		}
	});

	test("copies the current iteration scope digest", async () => {
		const { root, scopeFile, scopeDigest } = await setup();
		const report = await runRuntimeGate({ repoRoot: root, scopeFile });
		assert.strictEqual(report.scope_digest, scopeDigest);
	});

	test("fails closed when same-status content changed after scope capture", async () => {
		const { root, scopeFile } = await setup(undefined, "dirty-v1\n");
		await writeRepositoryFile(root, "dirty.ts", "dirty-v2\n");
		await assert.rejects(
			runRuntimeGate({ repoRoot: root, scopeFile }),
			/changed before runtime-gate/i,
		);
	});

	test("fails closed when a passing check mutates the worktree", async () => {
		const { root, scopeFile } = await setup(
			'test_command: "printf mutation >> baseline.txt"\n',
		);
		await assert.rejects(
			runRuntimeGate({ repoRoot: root, scopeFile }),
			/modified.*worktree/i,
		);
	});
});
