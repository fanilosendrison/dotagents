import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import {
	chmod,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, test } from "node:test";
import { computeFindingId } from "../../src/findings/finding-id.ts";
import type { RoutingCategory } from "../../src/routing/routing-schema.ts";
import {
	createReadOnlyGitWrapper,
	createRepository,
	parseShellExports,
	removeRepository,
	runGit,
	runProcess,
	writeRepositoryFile,
} from "../helpers/git-fixture.ts";

const repositoryRoot = resolve(import.meta.dirname, "../../../../..");
const controller = join(repositoryRoot, "skills/loop-clean/loop-clean.sh");
const repositories: string[] = [];
const externalDirectories: string[] = [];
let sessionCounter = 0;

interface RunContext {
	readonly root: string;
	readonly cwd: string;
	readonly environment: Record<string, string>;
	readonly wrapperLog: string;
	readonly initialHead: string;
	readonly initialIndex: string;
}

async function createLoopRepository(): Promise<string> {
	const root = await createRepository();
	repositories.push(root);
	await writeRepositoryFile(root, ".gitignore", ".agents/run/\n.claude/run/\n");
	await runGit(root, ["add", ".gitignore"]);
	await runGit(root, ["commit", "--quiet", "-m", "ignore runtime state"]);
	return root;
}

async function startRun(options?: {
	readonly root?: string;
	readonly cwd?: string;
}): Promise<RunContext> {
	const root = options?.root ?? (await createLoopRepository());
	const cwd = options?.cwd ?? root;
	const wrapperParent = await mkdtemp(
		join(tmpdir(), "loop-clean-git-wrapper-"),
	);
	externalDirectories.push(wrapperParent);
	const wrapper = await createReadOnlyGitWrapper(wrapperParent);
	const initialHead = await runGit(root, ["rev-parse", "HEAD"]);
	const initialIndex = await runGit(root, ["ls-files", "--stage"]);
	const baseEnvironment: Record<string, string> = {
		LOOP_CLEAN_SESSION_ID: `e2e-${process.pid}-${sessionCounter++}`,
		PATH: `${wrapper.binDirectory}:${process.env.PATH ?? ""}`,
	};
	const init = await runProcess(["bash", controller, "init"], {
		cwd,
		env: baseEnvironment,
	});
	assert.strictEqual(init.exitCode, 0);
	const exported = parseShellExports(init.stdout);
	return {
		root,
		cwd,
		environment: { ...baseEnvironment, ...exported },
		wrapperLog: wrapper.logPath,
		initialHead,
		initialIndex,
	};
}

async function controllerCommand(context: RunContext, args: readonly string[]) {
	return await runProcess(["bash", controller, ...args], {
		cwd: context.cwd,
		env: context.environment,
	});
}

async function prepareIteration(
	context: RunContext,
	iteration: number,
): Promise<Record<string, string>> {
	const result = await controllerCommand(context, [
		"prepare-iter",
		String(iteration),
	]);
	assert.strictEqual(result.exitCode, 0);
	return parseShellExports(result.stdout);
}

const semanticFindingIds = new Map<string, string>();

function semanticFinding(
	source: string,
	label: string,
): Record<string, unknown> {
	const axis = source === "dedup-codebase" ? "duplication-intra" : "edge-cases";
	const problem = `${source} ${label} stable finding`;
	const id = computeFindingId(source, "fresh.ts", 1, axis, problem);
	semanticFindingIds.set(label, id);
	return {
		id,
		source,
		axis,
		severity: "major",
		file: "fresh.ts",
		line_start: 1,
		line_end: 1,
		problem,
		evidence: "evidence",
		fix_proposal: "fix",
	};
}

async function writeSemanticReports(
	iterationEnvironment: Record<string, string>,
	findings: Partial<
		Record<
			"coding-standards" | "senior-review" | "dedup-codebase",
			readonly Record<string, unknown>[]
		>
	> = {},
): Promise<void> {
	const digest = iterationEnvironment.LOOP_CLEAN_SCOPE_DIGEST;
	for (const [source, environmentName] of [
		["coding-standards", "LOOP_CLEAN_JSON_OUT_CODING_STANDARDS"],
		["senior-review", "LOOP_CLEAN_JSON_OUT_SENIOR_REVIEW"],
		["dedup-codebase", "LOOP_CLEAN_JSON_OUT_DEDUP_CODEBASE"],
	] as const) {
		await writeFile(
			iterationEnvironment[environmentName],
			`${JSON.stringify({
				skill: source,
				scope_digest: digest,
				findings: findings[source] ?? [],
			})}\n`,
		);
	}
}

async function runCollection(
	context: RunContext,
	iteration: number,
	iterationEnvironment: Record<string, string>,
): Promise<void> {
	Object.assign(context.environment, iterationEnvironment);
	const gate = await controllerCommand(context, [
		"runtime-gate",
		String(iteration),
	]);
	assert.strictEqual(gate.exitCode, 0);
	const collect = await controllerCommand(context, [
		"collect-findings",
		String(iteration),
	]);
	assert.strictEqual(collect.exitCode, 0);
}

function routingEntry(category: RoutingCategory, labelOrId: string) {
	const findingId = semanticFindingIds.get(labelOrId) ?? labelOrId;
	if (category === "fix_now_applied") {
		return {
			finding_id: findingId,
			files_touched: ["fresh.ts"],
			change_summary: "fixed demonstrated problem",
		};
	}
	if (category === "backlog_added" || category === "backlog_existing") {
		return {
			finding_id: findingId,
			file: "fresh.ts",
			severity: "major",
			reason: "bounded work deferred",
		};
	}
	if (
		category === "design_queue_added" ||
		category === "design_queue_existing"
	) {
		return {
			finding_id: findingId,
			file: "fresh.ts",
			reason: "human design decision required",
		};
	}
	return { finding_id: findingId, reason: "ambiguous outcome" };
}

async function writeRouting(
	iterationEnvironment: Record<string, string>,
	iteration: number,
	categories: Partial<Record<RoutingCategory, readonly string[]>>,
): Promise<void> {
	const routing: Record<string, unknown> = {
		skill: "fix-or-backlog",
		iteration,
		scope_digest: iterationEnvironment.LOOP_CLEAN_SCOPE_DIGEST,
		fix_now_applied: [],
		backlog_added: [],
		backlog_existing: [],
		design_queue_added: [],
		design_queue_existing: [],
		escalated: [],
		notes: [],
	};
	for (const [category, ids] of Object.entries(categories)) {
		routing[category] =
			ids?.map((value) => routingEntry(category as RoutingCategory, value)) ??
			[];
	}
	await writeFile(
		iterationEnvironment.LOOP_CLEAN_JSON_OUT_FIX_OR_BACKLOG,
		`${JSON.stringify(routing)}\n`,
	);
}

afterEach(async () => {
	for (const root of repositories.splice(0)) await removeRepository(root);
	for (const directory of externalDirectories.splice(0)) {
		await rm(directory, { recursive: true, force: true });
	}
});

describe("loop-clean controller E2E", () => {
	test("resolves the nearest Git root from a subdirectory and reports no changes", async () => {
		const root = await createLoopRepository();
		const subdirectory = join(root, "nested", "work");
		await mkdir(subdirectory, { recursive: true });
		const context = await startRun({ root, cwd: subdirectory });
		assert.strictEqual(context.environment.LOOP_CLEAN_REPO_ROOT, root);
		assert.strictEqual(context.environment.GIT_OPTIONAL_LOCKS, "0");
		assert.ok(
			context.environment.LOOP_CLEAN_RUN_DIR.startsWith(
				join(root, ".agents/run/loop-clean/"),
			),
		);
		assert.strictEqual(
			context.environment.LOOP_CLEAN_BACKLOG_PATH,
			join(root, "backlog.md"),
		);
		const iteration = await prepareIteration(context, 0);
		assert.strictEqual(Number(iteration.LOOP_CLEAN_AUDITABLE_COUNT), 0);
		Object.assign(context.environment, iteration);
		const decision = await controllerCommand(context, ["decide", "0"]);
		assert.strictEqual(decision.exitCode, 0);
		assert.strictEqual(decision.stdout.trim(), "EXIT_NO_CHANGES");
	});

	test("returns EXIT_CLEAN only after all four reports and a passing or skipped runtime gate", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		const iteration = await prepareIteration(context, 0);
		await writeSemanticReports(iteration);
		await runCollection(context, 0, iteration);
		const decision = await controllerCommand(context, ["decide", "0"]);
		assert.strictEqual(decision.stdout.trim(), "EXIT_CLEAN");
	});

	for (const source of [
		"coding-standards",
		"senior-review",
		"dedup-codebase",
	] as const) {
		test(`continues for a finding emitted only by ${source}`, async () => {
			const root = await createLoopRepository();
			await writeRepositoryFile(
				root,
				"fresh.ts",
				"export const fresh = true;\n",
			);
			const context = await startRun({ root });
			const iteration = await prepareIteration(context, 0);
			await writeSemanticReports(iteration, {
				[source]: [semanticFinding(source, `${source}-id`)],
			});
			await runCollection(context, 0, iteration);
			const decision = await controllerCommand(context, ["decide", "0"]);
			assert.strictEqual(decision.stdout.trim(), "CONTINUE");
		});
	}

	test("runtime failure is actionable before decision and prevents false CLEAN", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		await writeRepositoryFile(
			root,
			"STACK_EVAL.yaml",
			'test_command: "exit 5"\n',
		);
		const context = await startRun({ root });
		const iteration = await prepareIteration(context, 0);
		await writeSemanticReports(iteration);
		await runCollection(context, 0, iteration);
		const findings = JSON.parse(
			await readFile(iteration.LOOP_CLEAN_FINDINGS_FILE, "utf8"),
		);
		assert.strictEqual(findings.runtime_gate_status, "fail");
		assert.strictEqual(findings.actionable_findings[0].axis, "runtime-failure");
		const decision = await controllerCommand(context, ["decide", "0"]);
		assert.strictEqual(decision.stdout.trim(), "CONTINUE");
	});

	test("returns EXIT_HANDLED when every re-emitted finding was deferred", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		const first = await prepareIteration(context, 0);
		await writeSemanticReports(first, {
			"senior-review": [semanticFinding("senior-review", "deferred-id")],
		});
		await runCollection(context, 0, first);
		assert.strictEqual(
			(await controllerCommand(context, ["decide", "0"])).stdout.trim(),
			"CONTINUE",
		);
		await writeRouting(first, 0, { backlog_added: ["deferred-id"] });
		Object.assign(context.environment, first);
		assert.strictEqual(
			(await controllerCommand(context, ["validate-routing", "0"])).exitCode,
			0,
		);

		const second = await prepareIteration(context, 1);
		await writeSemanticReports(second, {
			"senior-review": [semanticFinding("senior-review", "deferred-id")],
		});
		await runCollection(context, 1, second);
		const decision = await controllerCommand(context, ["decide", "1"]);
		assert.strictEqual(decision.stdout.trim(), "EXIT_HANDLED");
	});

	test("detects actionable oscillation and treats a changed ID as new", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		for (const [iterationNumber, id] of [
			[0, "stable-id"],
			[1, "stable-id"],
		] as const) {
			const iteration = await prepareIteration(context, iterationNumber);
			await writeSemanticReports(iteration, {
				"coding-standards": [semanticFinding("coding-standards", id)],
			});
			await runCollection(context, iterationNumber, iteration);
			const decision = await controllerCommand(context, [
				"decide",
				String(iterationNumber),
			]);
			if (iterationNumber === 0) {
				assert.strictEqual(decision.stdout.trim(), "CONTINUE");
				await writeRouting(iteration, 0, { fix_now_applied: [id] });
				Object.assign(context.environment, iteration);
				assert.strictEqual(
					(await controllerCommand(context, ["validate-routing", "0"]))
						.exitCode,
					0,
				);
			} else {
				assert.strictEqual(decision.stdout.trim(), "EXIT_OSCILLATION");
			}
		}
	});

	test("recalculates scope so a file created by a fix appears next iteration", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		const first = await prepareIteration(context, 0);
		await writeRepositoryFile(
			root,
			"created-by-fix.ts",
			"export const created = true;\n",
		);
		const second = await prepareIteration(context, 1);
		assert.notStrictEqual(
			second.LOOP_CLEAN_SCOPE_DIGEST,
			first.LOOP_CLEAN_SCOPE_DIGEST,
		);
		const scope = JSON.parse(
			await readFile(second.LOOP_CLEAN_SCOPE_FILE, "utf8"),
		);
		assert.ok(
			scope.entries
				.map((entry: { path: string }) => entry.path)
				.includes("created-by-fix.ts"),
		);
	});

	test("fails closed when a source report is missing", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		const iteration = await prepareIteration(context, 0);
		Object.assign(context.environment, iteration);
		await writeFile(
			iteration.LOOP_CLEAN_JSON_OUT_CODING_STANDARDS,
			`${JSON.stringify({ skill: "coding-standards", scope_digest: iteration.LOOP_CLEAN_SCOPE_DIGEST, findings: [] })}\n`,
		);
		await writeFile(
			iteration.LOOP_CLEAN_JSON_OUT_SENIOR_REVIEW,
			`${JSON.stringify({ skill: "senior-review", scope_digest: iteration.LOOP_CLEAN_SCOPE_DIGEST, findings: [] })}\n`,
		);
		assert.strictEqual(
			(await controllerCommand(context, ["runtime-gate", "0"])).exitCode,
			0,
		);
		const collect = await controllerCommand(context, ["collect-findings", "0"]);
		assert.notStrictEqual(collect.exitCode, 0);
		const finalize = await controllerCommand(context, ["finalize"]);
		assert.notStrictEqual(finalize.exitCode, 0);
		assert.ok(finalize.stdout.includes("EXIT_PROTOCOL_ERROR"));
	});

	test("preserves HEAD and index and only invokes read-only Git through the wrapper", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		const iteration = await prepareIteration(context, 0);
		await writeSemanticReports(iteration);
		await runCollection(context, 0, iteration);
		assert.strictEqual(
			(await controllerCommand(context, ["decide", "0"])).stdout.trim(),
			"EXIT_CLEAN",
		);
		const finalize = await controllerCommand(context, ["finalize"]);
		assert.strictEqual(finalize.exitCode, 0);
		assert.strictEqual(
			await runGit(root, ["rev-parse", "HEAD"]),
			context.initialHead,
		);
		assert.strictEqual(
			await runGit(root, ["ls-files", "--stage"]),
			context.initialIndex,
		);
		const log = await readFile(context.wrapperLog, "utf8");
		assert.ok(!log.includes("BLOCKED_MUTATING_GIT_COMMAND"));
		for (const line of log.trim().split("\n")) {
			assert.match(
				line,
				/(?:^|\t)(rev-parse|status|diff|ls-files|show|cat-file|check-ignore)(?:\t|$)/,
			);
		}
		const blocked = await runProcess(["git", "-C", root, "add", "fresh.ts"], {
			cwd: root,
			env: context.environment,
		});
		assert.strictEqual(blocked.exitCode, 97);
		assert.ok(blocked.stderr.includes("BLOCKED_MUTATING_GIT_COMMAND add"));
	});

	test("finalize reports an external index mutation as a protocol error without restoring it", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		await runGit(root, ["add", "fresh.ts"]);
		const finalize = await controllerCommand(context, ["finalize"]);
		assert.notStrictEqual(finalize.exitCode, 0);
		assert.ok(finalize.stdout.includes("EXIT_PROTOCOL_ERROR"));
		assert.ok(finalize.stdout.includes("index changed"));
		assert.ok(
			(await runGit(root, ["diff", "--cached", "--name-only"])).includes(
				"fresh.ts",
			),
		);
	});

	test("runtime-gate rejects scope when index changed after capture", async () => {
		const root = await createLoopRepository();
		const context = await startRun({ root });
		await prepareIteration(context, 0);

		// Mutate the index without touching the worktree
		await runGit(root, ["update-index", "--chmod=+x", ".gitignore"]);

		// runtime-gate recalculates scope and must detect the index divergence
		const gate = await controllerCommand(context, ["runtime-gate", "0"]);
		assert.notStrictEqual(gate.exitCode, 0);
		assert.match(gate.stderr, /scope.*changed|index|diverg/i);
	});

	test("treats a deferred finding with a new ID as actionable", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		const first = await prepareIteration(context, 0);
		await writeSemanticReports(first, {
			"senior-review": [semanticFinding("senior-review", "old-id")],
		});
		await runCollection(context, 0, first);
		assert.strictEqual(
			(await controllerCommand(context, ["decide", "0"])).stdout.trim(),
			"CONTINUE",
		);
		await writeRouting(first, 0, { backlog_added: ["old-id"] });
		Object.assign(context.environment, first);
		assert.strictEqual(
			(await controllerCommand(context, ["validate-routing", "0"])).exitCode,
			0,
		);

		const second = await prepareIteration(context, 1);
		await writeSemanticReports(second, {
			"senior-review": [semanticFinding("senior-review", "new-id")],
		});
		await runCollection(context, 1, second);
		const findings = JSON.parse(
			await readFile(second.LOOP_CLEAN_FINDINGS_FILE, "utf8"),
		);
		assert.deepStrictEqual(
			findings.actionable_findings.map((entry: { id: string }) => entry.id),
			[semanticFindingIds.get("new-id")],
		);
		assert.strictEqual(
			(await controllerCommand(context, ["decide", "1"])).stdout.trim(),
			"CONTINUE",
		);
	});

	test("returns EXIT_CEILING at iteration nine with changing actionable IDs", async () => {
		const root = await createLoopRepository();
		await writeRepositoryFile(root, "fresh.ts", "export const fresh = true;\n");
		const context = await startRun({ root });
		for (let iterationNumber = 0; iterationNumber < 10; iterationNumber += 1) {
			const iteration = await prepareIteration(context, iterationNumber);
			const findingId = `ceiling-${iterationNumber}`;
			await writeSemanticReports(iteration, {
				"coding-standards": [semanticFinding("coding-standards", findingId)],
			});
			await runCollection(context, iterationNumber, iteration);
			const decision = await controllerCommand(context, [
				"decide",
				String(iterationNumber),
			]);
			if (iterationNumber === 9) {
				assert.strictEqual(decision.stdout.trim(), "EXIT_CEILING");
				break;
			}
			assert.strictEqual(decision.stdout.trim(), "CONTINUE");
			await writeRouting(iteration, iterationNumber, {
				fix_now_applied: [findingId],
			});
			Object.assign(context.environment, iteration);
			assert.strictEqual(
				(
					await controllerCommand(context, [
						"validate-routing",
						String(iterationNumber),
					])
				).exitCode,
				0,
			);
		}
	});

	test("finalize reports an external HEAD mutation without restoring it", async () => {
		const root = await createLoopRepository();
		const context = await startRun({ root });
		await runGit(root, [
			"commit",
			"--quiet",
			"--allow-empty",
			"-m",
			"external head change",
		]);
		const changedHead = await runGit(root, ["rev-parse", "HEAD"]);
		assert.notStrictEqual(changedHead, context.initialHead);
		const finalize = await controllerCommand(context, ["finalize"]);
		assert.notStrictEqual(finalize.exitCode, 0);
		assert.ok(finalize.stdout.includes("HEAD changed"));
		assert.strictEqual(await runGit(root, ["rev-parse", "HEAD"]), changedHead);
	});

	test("the dynamic Git wrapper blocks add, commit, and push", async () => {
		const root = await createLoopRepository();
		const context = await startRun({ root });
		for (const commandName of ["add", "commit", "push"]) {
			const blocked = await runProcess(["git", "-C", root, commandName], {
				cwd: root,
				env: context.environment,
			});
			assert.strictEqual(blocked.exitCode, 97);
			assert.ok(
				blocked.stderr.includes(`BLOCKED_MUTATING_GIT_COMMAND ${commandName}`),
			);
		}
	});

	test("rejects audit as an unknown argument", async () => {
		const root = await createLoopRepository();
		const result = await runProcess(["bash", controller, "init", "audit"], {
			cwd: root,
			env: { LOOP_CLEAN_SESSION_ID: "audit-is-removed" },
		});
		assert.strictEqual(result.exitCode, 2);
		assert.match(result.stderr, /unknown.*audit/i);
	});

	test("init rejects a malformed baseline and leaves no final file behind", async () => {
		const root = await createLoopRepository();
		const sessionId = `malformed-${process.pid}-${sessionCounter++}`;
		const mockDir = await mkdtemp(join(tmpdir(), "loop-clean-mock-"));
		externalDirectories.push(mockDir);

		// Mock protocol CLI that writes invalid JSON (wrong schema_version)
		const mockCli = join(mockDir, "mock-cli.ts");
		await writeFile(
			mockCli,
			`import { writeFile } from "node:fs/promises";
const [, , command, ...rest] = process.argv;
const args: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--output") args.output = rest[++i];
  else if (rest[i] === "--repo-root") args["repo-root"] = rest[++i];
}
if (command === "capture-git" && args.output) {
  await writeFile(args.output, JSON.stringify({ schema_version: 99, head: "UNBORN", index_digest: "0000000000000000000000000000000000000000000000000000000000000000" }));
}
`,
		);
		await chmod(mockCli, 0o755);

		const result = await runProcess(["bash", controller, "init"], {
			cwd: root,
			env: {
				LOOP_CLEAN_SESSION_ID: sessionId,
				LOOP_CLEAN_PROTOCOL_CLI: mockCli,
			},
		});
		assert.strictEqual(result.exitCode, 4);
		assert.match(result.stderr, /valid Git baseline/);

		// The invalid baseline must NOT exist at the final path
		const runDir = join(root, ".agents/run/loop-clean", sessionId);
		assert.strictEqual(existsSync(join(runDir, "git-baseline.json")), false);
	});

	test("same session ID can be re-initialized after a failed init", async () => {
		const root = await createLoopRepository();
		const sessionId = `recovery-${process.pid}-${sessionCounter++}`;
		const mockDir = await mkdtemp(join(tmpdir(), "loop-clean-recovery-mock-"));
		externalDirectories.push(mockDir);

		const mockCli = join(mockDir, "mock-cli.ts");
		await writeFile(
			mockCli,
			`import { writeFile } from "node:fs/promises";
const [, , command, ...rest] = process.argv;
const args: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--output") args.output = rest[++i];
  else if (rest[i] === "--repo-root") args["repo-root"] = rest[++i];
}
if (command === "capture-git" && args.output) {
  await writeFile(args.output, "not-json");
}
`,
		);
		await chmod(mockCli, 0o755);

		// First attempt: mock produces garbage, init must reject
		const first = await runProcess(["bash", controller, "init"], {
			cwd: root,
			env: {
				LOOP_CLEAN_SESSION_ID: sessionId,
				LOOP_CLEAN_PROTOCOL_CLI: mockCli,
			},
		});
		assert.strictEqual(first.exitCode, 4);

		// Second attempt with the same session ID: must succeed (no poisoned baseline)
		const second = await runProcess(["bash", controller, "init"], {
			cwd: root,
			env: { LOOP_CLEAN_SESSION_ID: sessionId },
		});
		assert.strictEqual(second.exitCode, 0);

		const runDir = join(root, ".agents/run/loop-clean", sessionId);
		assert.strictEqual(existsSync(join(runDir, "git-baseline.json")), true);
		// Commit marker present → all artifacts must be present.
		assert.strictEqual(
			existsSync(join(runDir, "deferred-findings.json")),
			true,
		);
	});

	test("a successful init publishes every artifact before the commit marker", async () => {
		const root = await createLoopRepository();
		const context = await startRun({ root });
		const runDir = context.environment.LOOP_CLEAN_RUN_DIR;

		// Invariant: if git-baseline.json exists, deferred-findings.json must exist.
		assert.strictEqual(existsSync(join(runDir, "git-baseline.json")), true);
		assert.strictEqual(
			existsSync(join(runDir, "deferred-findings.json")),
			true,
		);

		// deferred-findings.json must be valid JSON with the expected schema.
		const deferred = JSON.parse(
			await readFile(join(runDir, "deferred-findings.json"), "utf8"),
		);
		assert.strictEqual(deferred.schema_version, 1);
		assert.strictEqual(Array.isArray(deferred.entries), true);
	});

	test("CLI crash does not leave a partial baseline file", async () => {
		const root = await createLoopRepository();
		const sessionId = `crash-${process.pid}-${sessionCounter++}`;
		const mockDir = await mkdtemp(join(tmpdir(), "loop-clean-crash-mock-"));
		externalDirectories.push(mockDir);

		const mockCli = join(mockDir, "mock-cli.ts");
		await writeFile(
			mockCli,
			`import { writeFile } from "node:fs/promises";
const [, , command, ...rest] = process.argv;
const args: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--output") args.output = rest[++i];
  else if (rest[i] === "--repo-root") args["repo-root"] = rest[++i];
}
if (command === "capture-git" && args.output) {
  await writeFile(args.output, "partial garbage");
  process.exit(1);
}
`,
		);
		await chmod(mockCli, 0o755);

		const result = await runProcess(["bash", controller, "init"], {
			cwd: root,
			env: {
				LOOP_CLEAN_SESSION_ID: sessionId,
				LOOP_CLEAN_PROTOCOL_CLI: mockCli,
			},
		});
		assert.strictEqual(result.exitCode, 4);
		assert.match(result.stderr, /failed to capture Git invariants/);

		// No final file must remain after a crash
		const runDir = join(root, ".agents/run/loop-clean", sessionId);
		assert.strictEqual(existsSync(join(runDir, "git-baseline.json")), false);
	});

	test("concurrent init with same session ID: exactly one claims the marker", async () => {
		const root = await createLoopRepository();
		const sessionId = `concurrent-${process.pid}-${sessionCounter++}`;
		const coordDir = await mkdtemp(join(tmpdir(), "loop-clean-barrier-"));
		externalDirectories.push(coordDir);

		// Barrier mock CLI: both processes signal readiness, then wait until
		// both are ready before writing the baseline.  This guarantees they
		// both pass the pre-check and actually race on the ln marker claim.
		const mockDir = await mkdtemp(join(tmpdir(), "loop-clean-barrier-cli-"));
		externalDirectories.push(mockDir);
		const mockCli = join(mockDir, "barrier-cli.ts");
		await writeFile(
			mockCli,
			`import { readdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";

const coord = process.env.MOCK_COORDINATION_DIR!;
await writeFile(\`\${coord}/ready-\${process.pid}\`, "");

// Busy-wait until both callers are ready.
while (readdirSync(coord).length < 2) {
  await new Promise((r) => setTimeout(r, 5));
}

const [, , command, ...rest] = process.argv;
const args: Record<string, string> = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--output") args.output = rest[++i];
  else if (rest[i] === "--repo-root") args["repo-root"] = rest[++i];
}
if (command === "capture-git" && args.output) {
  await writeFile(args.output, JSON.stringify({
    schema_version: 1,
    head: "0000000000000000000000000000000000000000",
    index_digest: "0000000000000000000000000000000000000000000000000000000000000000",
  }));
}
`,
		);
		await chmod(mockCli, 0o755);

		const env = {
			LOOP_CLEAN_SESSION_ID: sessionId,
			LOOP_CLEAN_PROTOCOL_CLI: mockCli,
			MOCK_COORDINATION_DIR: coordDir,
		};

		const [a, b] = await Promise.all([
			runProcess(["bash", controller, "init"], { cwd: root, env }),
			runProcess(["bash", controller, "init"], { cwd: root, env }),
		]);

		const successes = [a, b].filter((r) => r.exitCode === 0);
		const alreadyClaimed = [a, b].filter((r) => r.exitCode === 2);

		assert.strictEqual(successes.length, 1);
		assert.strictEqual(alreadyClaimed.length, 1);
		assert.match(
			alreadyClaimed[0].stderr,
			/already initialized|concurrently claimed/,
		);

		// The winner must have produced both artifacts.
		const runDir = join(root, ".agents/run/loop-clean", sessionId);
		assert.strictEqual(existsSync(join(runDir, "git-baseline.json")), true);
		assert.strictEqual(
			existsSync(join(runDir, "deferred-findings.json")),
			true,
		);

		// No temp files must remain after init.
		for (const entry of readdirSync(runDir)) {
			assert.doesNotMatch(entry, /^\..*\.tmp\./);
		}
	});

	test("ln infrastructure failure returns exit 4, not exit 2", async () => {
		const root = await createLoopRepository();
		const sessionId = `lnfail-${process.pid}-${sessionCounter++}`;

		// Mock ln that always fails without creating its destination.
		const mockBinDir = await mkdtemp(join(tmpdir(), "loop-clean-ln-mock-"));
		externalDirectories.push(mockBinDir);
		const mockLn = join(mockBinDir, "ln");
		await writeFile(mockLn, "#!/usr/bin/env bash\nexit 1\n");
		await chmod(mockLn, 0o755);

		const result = await runProcess(["bash", controller, "init"], {
			cwd: root,
			env: {
				LOOP_CLEAN_SESSION_ID: sessionId,
				PATH: `${mockBinDir}:${process.env.PATH ?? ""}`,
			},
		});

		assert.strictEqual(result.exitCode, 4);
		assert.match(result.stderr, /failed to publish Git baseline/);
		assert.doesNotMatch(
			result.stderr,
			/already initialized|concurrently claimed/,
		);

		// No final baseline must exist (ln never created it).
		const runDir = join(root, ".agents/run/loop-clean", sessionId);
		assert.strictEqual(existsSync(join(runDir, "git-baseline.json")), false);
	});
});
