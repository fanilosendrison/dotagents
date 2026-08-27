import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
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
	await Bun.write(scopeFile, `${JSON.stringify(manifest)}\n`);
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

		expect(
			resolvePackageManager(
				root,
				{ package_manager: "yarn" },
				{ packageManager: "pnpm@11.24.0" },
			),
		).toBe("yarn");
	});

	test("prefers the standard packageManager field over conflicting lockfiles", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);
		await writeRepositoryFile(root, "bun.lock", "");
		await writeRepositoryFile(root, "pnpm-lock.yaml", "");

		expect(
			resolvePackageManager(root, null, { packageManager: "npm@10.9.0" }),
		).toBe("npm");
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
			expect(resolvePackageManager(root, null, {})).toBe(
				expectedPackageManager,
			);
		}
	});

	test("fails closed when multiple lockfiles exist without a declaration", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);
		await writeRepositoryFile(root, "bun.lock", "");
		await writeRepositoryFile(root, "pnpm-lock.yaml", "");

		expect(() => resolvePackageManager(root, null, {})).toThrow(
			/Multiple package-manager lockfiles.*bun\.lock.*pnpm-lock\.yaml/i,
		);
	});

	test("fails closed on an unsupported packageManager declaration", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);

		expect(() =>
			resolvePackageManager(root, null, { packageManager: "deno@2.0.0" }),
		).toThrow(/Unsupported package manager.*package\.json.*deno/i);
	});

	test("preserves the npm fallback when no declaration or lockfile exists", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);

		expect(resolvePackageManager(root, null, {})).toBe("npm");
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
		expect(report.status).toBe("pass");
		expect(report.scope_digest).toBe(scopeDigest);
		expect(
			report.checks.map((check) => [
				check.name,
				check.status,
				check.output_tail,
			]),
		).toEqual([
			["test", "pass", "test"],
			["lint", "pass", "lint"],
			["typecheck", "pass", "typecheck"],
		]);
		expect(report.findings).toEqual([]);
	});

	test("marks absent checks as skipped", async () => {
		const { root, scopeFile } = await setup();
		const report = await runRuntimeGate({ repoRoot: root, scopeFile });
		expect(report.status).toBe("skipped");
		expect(report.checks).toEqual([
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

		await expect(runRuntimeGate({ repoRoot: root, scopeFile })).rejects.toThrow(
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
		expect(first.status).toBe("fail");
		expect(first.findings).toHaveLength(2);
		expect(first.findings.map((entry) => entry.id)).toEqual(
			second.findings.map((entry) => entry.id),
		);
		for (const entry of first.findings) {
			expect(entry).toMatchObject({
				source: "runtime-gate",
				axis: "runtime-failure",
				severity: "critical",
				file: "",
				line_start: null,
				line_end: null,
				fix_proposal: "Identify and fix the root cause of the failing check.",
			});
			expect(entry.problem).not.toMatch(/iter/i);
			expect(entry.evidence.length).toBeLessThanOrEqual(8192);
		}
	});

	test("copies the current iteration scope digest", async () => {
		const { root, scopeFile, scopeDigest } = await setup();
		const report = await runRuntimeGate({ repoRoot: root, scopeFile });
		expect(report.scope_digest).toBe(scopeDigest);
	});

	test("fails closed when same-status content changed after scope capture", async () => {
		const { root, scopeFile } = await setup(undefined, "dirty-v1\n");
		await writeRepositoryFile(root, "dirty.ts", "dirty-v2\n");
		await expect(runRuntimeGate({ repoRoot: root, scopeFile })).rejects.toThrow(
			/changed before runtime-gate/i,
		);
	});

	test("fails closed when a passing check mutates the worktree", async () => {
		const { root, scopeFile } = await setup(
			'test_command: "printf mutation >> baseline.txt"\n',
		);
		await expect(runRuntimeGate({ repoRoot: root, scopeFile })).rejects.toThrow(
			/modified.*worktree/i,
		);
	});
});
