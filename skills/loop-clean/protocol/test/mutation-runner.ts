#!/usr/bin/env node
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	decodeProcessOutput,
	executeProcess,
} from "../src/shared/execute-process.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../../..");

type TestRuntime = "bun" | "node";

interface MutationDefinition {
	readonly name: string;
	readonly testFile: string;
	readonly apply: (mutantRoot: string) => Promise<void>;
}

async function replaceExactly(
	path: string,
	oldText: string,
	newText: string,
): Promise<void> {
	const contents = await readFile(path, "utf8");
	const first = contents.indexOf(oldText);
	if (first < 0 || contents.indexOf(oldText, first + oldText.length) >= 0) {
		throw new Error(
			`mutation target must occur exactly once in ${path}: ${oldText}`,
		);
	}
	await writeFile(path, contents.replace(oldText, newText));
}

function testInvocation(
	testRuntime: TestRuntime,
	testPath: string,
): { readonly command: string; readonly args: readonly string[] } {
	if (testRuntime === "bun") {
		return {
			command: "bun",
			args: ["test", "--timeout", "60000", testPath],
		};
	}
	return {
		command: process.execPath,
		args: ["--test", "--test-concurrency=1", "--test-timeout=180000", testPath],
	};
}

async function runTest(
	mutantRoot: string,
	testFile: string,
	testRuntime: TestRuntime,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const invocation = testInvocation(
		testRuntime,
		join(mutantRoot, "skills/loop-clean/protocol/test", testFile),
	);
	const result = await executeProcess(invocation.command, invocation.args, {
		cwd: join(mutantRoot, "skills/loop-clean/protocol"),
	});
	return {
		stdout: decodeProcessOutput(result.stdout),
		stderr: result.stderr,
		exitCode: result.exitCode,
	};
}

async function requireTestPasses(
	mutantRoot: string,
	testFile: string,
	label: string,
	testRuntime: TestRuntime,
): Promise<void> {
	const result = await runTest(mutantRoot, testFile, testRuntime);
	if (result.exitCode !== 0) {
		throw new Error(
			`${label} baseline failed before mutation was applied:\n${result.stdout}\n${result.stderr}`,
		);
	}
}

// ── Portable mutations: copy only skills/loop-clean/ ──

async function installMutantDependencies(
	protocolDirectory: string,
	label: string,
): Promise<void> {
	const result = await executeProcess(
		"pnpm",
		["install", "--ignore-scripts", "--no-frozen-lockfile"],
		{ cwd: protocolDirectory },
	);
	if (result.exitCode !== 0) {
		throw new Error(`${label} dependency install failed: ${result.stderr}`);
	}
}

async function copyPortableMutant(): Promise<string> {
	const mutantRoot = await mkdtemp(
		join(tmpdir(), "loop-clean-mutant-portable-"),
	);
	await mkdir(join(mutantRoot, "skills"), { recursive: true });
	await cp(
		join(repositoryRoot, "skills/loop-clean"),
		join(mutantRoot, "skills/loop-clean"),
		{
			recursive: true,
			filter: (src) => !src.includes("node_modules"),
		},
	);
	const protocolDir = join(mutantRoot, "skills/loop-clean/protocol");
	await installMutantDependencies(protocolDir, "portable mutant");
	return mutantRoot;
}

// ── Repository mutations: copy minimal dotagents fixture ──

async function copyRepositoryMutant(): Promise<string> {
	const mutantRoot = await mkdtemp(join(tmpdir(), "loop-clean-mutant-repo-"));
	await mkdir(join(mutantRoot, "skills"), { recursive: true });
	await mkdir(join(mutantRoot, "scripts"), { recursive: true });

	// Copy loop-clean skill (excluding node_modules)
	await cp(
		join(repositoryRoot, "skills/loop-clean"),
		join(mutantRoot, "skills/loop-clean"),
		{
			recursive: true,
			filter: (src) => !src.includes("node_modules"),
		},
	);

	// Copy agents
	await cp(join(repositoryRoot, "agents"), join(mutantRoot, "agents"), {
		recursive: true,
	});

	// Copy skills referenced by static-contract — these must exist
	for (const skill of [
		"fix-or-backlog",
		"coding-standards",
		"senior-review",
		"dedup-codebase",
	]) {
		const src = join(repositoryRoot, "skills", skill);
		const dst = join(mutantRoot, "skills", skill);
		if (!existsSync(src)) {
			throw new Error(`required skill fixture missing: ${src}`);
		}
		await cp(src, dst, { recursive: true });
	}

	// Copy scripts referenced by static-contract — these must exist
	for (const scriptDir of [
		"coding-standards-scanner",
		"coding-standards-consolidate",
		"lib/coding-standards-schema",
		"lib/stack-tools",
	]) {
		const src = join(repositoryRoot, "scripts", scriptDir);
		if (!existsSync(src)) {
			throw new Error(`required script fixture missing: ${src}`);
		}
		await cp(src, join(mutantRoot, "scripts", scriptDir), { recursive: true });
	}

	for (const fixturePath of [
		"package.json",
		"pnpm-lock.yaml",
		"scripts/package.json",
	]) {
		const fixtureSource = join(repositoryRoot, fixturePath);
		if (!existsSync(fixtureSource)) {
			throw new Error(`required fixture missing: ${fixturePath}`);
		}
		await cp(fixtureSource, join(mutantRoot, fixturePath));
	}

	// Install protocol dependencies.
	const protocolDir = join(mutantRoot, "skills/loop-clean/protocol");
	await installMutantDependencies(protocolDir, "repository mutant");

	return mutantRoot;
}

// ── Mutation definitions ──

const portableMutations: readonly MutationDefinition[] = [
	{
		name: "untracked paths removed from scope",
		testFile: "portable/scope.test.ts",
		apply: async (root) => {
			await replaceExactly(
				join(
					root,
					"skills/loop-clean/protocol/src/scope/parse-porcelain-v2.ts",
				),
				'\t\tif (record.startsWith("? ")) {',
				'\t\tif (false && record.startsWith("? ")) {',
			);
		},
	},
	{
		name: "coding-standards source removed from aggregation",
		testFile: "portable/findings.test.ts",
		apply: async (root) => {
			await replaceExactly(
				join(
					root,
					"skills/loop-clean/protocol/src/findings/findings-schema.ts",
				),
				'\t"coding-standards",\n',
				"",
			);
		},
	},
	{
		name: "scope digest check disabled",
		testFile: "portable/findings.test.ts",
		apply: async (root) => {
			await replaceExactly(
				join(
					root,
					"skills/loop-clean/protocol/src/findings/collect-findings.ts",
				),
				"\t\tif (report.scope_digest !== scope.digest) {",
				"\t\tif (false && report.scope_digest !== scope.digest) {",
			);
		},
	},
	{
		name: "forgotten routing ID accepted",
		testFile: "portable/routing.test.ts",
		apply: async (root) => {
			await replaceExactly(
				join(
					root,
					"skills/loop-clean/protocol/src/routing/validate-routing.ts",
				),
				"\tif (missingIds.length > 0) {",
				"\tif (false && missingIds.length > 0) {",
			);
		},
	},
	{
		name: "exclusive session claim replaced by overwriting move",
		testFile: "portable/controller-e2e.test.ts",
		apply: async (root) => {
			await replaceExactly(
				join(root, "skills/loop-clean/loop-clean.sh"),
				'if ! ln "$baseline_tmp" "$baseline_file" 2>/dev/null; then',
				'if ! mv "$baseline_tmp" "$baseline_file" 2>/dev/null; then',
			);
		},
	},
];

const repositoryMutations: readonly MutationDefinition[] = [
	{
		name: "iteration history command reintroduced",
		testFile: "repository/static-contract.test.ts",
		apply: async (root) => {
			const path = join(root, "skills/loop-clean/loop-clean.sh");
			const contents = await readFile(path, "utf8");
			await writeFile(
				path,
				`${contents}\ncmd_commit_iter() { git -C "$LOOP_CLEAN_REPO_ROOT" commit -m mutant; }\n`,
			);
		},
	},
	{
		name: "backlog path made relative to cwd",
		testFile: "repository/static-contract.test.ts",
		apply: async (root) => {
			const path = join(root, "skills/fix-or-backlog/SKILL.md");
			const contents = await readFile(path, "utf8");
			await writeFile(path, `${contents}\n\`echo mutant >> backlog.md\`\n`);
		},
	},
	{
		name: "runtime gate moved after decision",
		testFile: "repository/static-contract.test.ts",
		apply: async (root) => {
			const path = join(root, "agents/loop-clean-orchestrator.md");
			await replaceExactly(
				path,
				"5. `runtime-gate`\n6. `collect-findings`\n7. `decide`",
				"5. `collect-findings`\n6. `decide`\n7. `runtime-gate`",
			);
		},
	},
	{
		name: "removed package script restored",
		testFile: "repository/static-contract.test.ts",
		apply: async (root) => {
			const path = join(root, "scripts/package.json");
			const packageJson = JSON.parse(await readFile(path, "utf8"));
			packageJson.scripts["spec-drift:test"] = "node --test spec-drift";
			await writeFile(path, `${JSON.stringify(packageJson, null, 2)}\n`);
		},
	},
];

const allMutations = [...portableMutations, ...repositoryMutations];
export const mutationNames = allMutations.map(
	(m) => m.name,
) as readonly string[];

async function runMutationBatch(
	mutations: readonly MutationDefinition[],
	copyFn: () => Promise<string>,
	label: string,
	testRuntime: TestRuntime,
): Promise<readonly string[]> {
	// Establish baseline for every unique test file used by mutations
	const baselineTests = [...new Set(mutations.map((m) => m.testFile))];
	for (const testFile of baselineTests) {
		const baselineRoot = await copyFn();
		try {
			await requireTestPasses(
				baselineRoot,
				testFile,
				`${label} baseline ${testFile}`,
				testRuntime,
			);
		} finally {
			await rm(baselineRoot, { recursive: true, force: true });
		}
	}

	const detected: string[] = [];
	for (const mutation of mutations) {
		const mutantRoot = await copyFn();
		try {
			await mutation.apply(mutantRoot);
			const { stdout, stderr, exitCode } = await runTest(
				mutantRoot,
				mutation.testFile,
				testRuntime,
			);
			if (exitCode === 0) {
				throw new Error(
					`mutation survived: ${mutation.name}\n${stdout}\n${stderr}`,
				);
			}
			detected.push(mutation.name);
		} finally {
			await rm(mutantRoot, { recursive: true, force: true });
		}
	}
	return detected;
}

export async function runMutationSuite(
	testRuntime: TestRuntime = "node",
): Promise<readonly string[]> {
	const portableDetected = await runMutationBatch(
		portableMutations,
		copyPortableMutant,
		"portable",
		testRuntime,
	);
	const repositoryDetected = await runMutationBatch(
		repositoryMutations,
		copyRepositoryMutant,
		"repository",
		testRuntime,
	);
	return [...portableDetected, ...repositoryDetected];
}

function requestedTestRuntime(argument: string | undefined): TestRuntime {
	if (argument === undefined || argument === "--test-runtime=node")
		return "node";
	if (argument === "--test-runtime=bun") return "bun";
	throw new Error(`unknown mutation runner argument: ${argument}`);
}

function isDirectEntrypoint(): boolean {
	const entrypointPath = process.argv[1];
	return (
		entrypointPath !== undefined &&
		pathToFileURL(resolve(entrypointPath)).href === import.meta.url
	);
}

if (isDirectEntrypoint()) {
	const detected = await runMutationSuite(
		requestedTestRuntime(process.argv[2]),
	);
	for (const name of detected) process.stdout.write(`DETECTED ${name}\n`);
	process.stdout.write(
		`MUTATION_RESULT ${detected.length}/${allMutations.length}\n`,
	);
}
