/**
 * Boundary proof for governed Bash write targets and argument preservation.
 *
 * The unit regressions assert the extraction and rewriting decisions inside the
 * shared core. This file proves the property at the real boundary: a fixture
 * whose working directory is inside a physical `dot*` Git worktree, real calls
 * to `checkPath()` and `rewriteBashCommand()`, and relative path arguments that
 * resolve into that worktree.
 *
 * Under the old all-paths extraction, a relative token was resolved against the
 * working directory and rewritten to an absolute gateway path, which changed
 * what the argument meant. The accepted boundary (#6) preserves it because a
 * path reference is not write evidence. The same fixture proves that an
 * explicit write destination is still governed.
 *
 * The fixture uses an isolated temporary HOME, so no machine-specific path is
 * involved.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";

const CORE_PATH = join(dirname(import.meta.dirname), "path-guard.ts");
const RELATIVE_FILE = "relative/file.txt";
const RELATIVE_DIRECTORY = "relative/";

interface ProbeResult {
	readonly relativeCheck: {
		readonly allowed: boolean;
		readonly rewrittenPath?: string;
	};
	readonly commands: ReadonlyArray<{
		readonly command: string;
		readonly allowed: boolean;
		readonly rewritten: boolean;
		readonly newCommand: string;
	}>;
}

const PROBE_SCRIPT = `
import { pathToFileURL } from "node:url";

const core = await import(pathToFileURL(process.env.PATH_GUARD_CORE).href);
const commands = JSON.parse(process.env.PROBE_COMMANDS);

const relativeCheck = core.checkPath(process.env.PROBE_RELATIVE);
const results = commands.map((command) => {
  const decision = core.checkBashCommand(command);
  const rewrite = core.rewriteBashCommand(command);
  return {
    command,
    allowed: decision.allowed,
    rewritten: rewrite.rewritten,
    newCommand: rewrite.newCommand,
  };
});

process.stdout.write(JSON.stringify({ relativeCheck, commands: results }));
`;

describe("path-guard relative argument boundary", () => {
	let fixtureRoot: string;
	let home: string;
	let physicalWorktree: string;
	let probePath: string;

	before(() => {
		// realpath avoids the macOS /var -> /private/var alias so that the
		// temporary home and the physical worktree agree on one path spelling.
		fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), "path-guard-relative-")));
		home = join(fixtureRoot, "home");
		physicalWorktree = join(home, "Developper", "Projects", "dotprobe");

		mkdirSync(join(physicalWorktree, "relative"), { recursive: true });
		writeFileSync(join(physicalWorktree, "relative", "file.txt"), "fixture\n");

		const init = spawnSync("git", ["init", physicalWorktree], { encoding: "utf8" });
		assert.strictEqual(init.status, 0, init.stderr);

		probePath = join(fixtureRoot, "probe.mjs");
		writeFileSync(probePath, PROBE_SCRIPT);
	});

	after(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	function runProbe(commands: readonly string[]): ProbeResult {
		const probe = spawnSync(process.execPath, [probePath], {
			cwd: physicalWorktree,
			encoding: "utf8",
			env: {
				...process.env,
				HOME: home,
				PATH_GUARD_CORE: CORE_PATH,
				PROBE_COMMANDS: JSON.stringify(commands),
				PROBE_RELATIVE: RELATIVE_FILE,
			},
			shell: false,
		});
		assert.strictEqual(probe.status, 0, probe.stderr);
		return JSON.parse(probe.stdout) as ProbeResult;
	}

	test("the relative token resolves into the physical dot* worktree", () => {
		const result = runProbe([]);

		// The old enforcement fed this resolved path to checkPath(), which is
		// why the relative argument used to become an absolute gateway path.
		assert.strictEqual(result.relativeCheck.allowed, false);
		assert.strictEqual(
			result.relativeCheck.rewrittenPath,
			join(home, ".probe", RELATIVE_FILE),
		);
	});

	test("read-only relative arguments stay byte-for-byte identical", () => {
		const commands = [
			`ls ${RELATIVE_FILE}`,
			`grep -n fixture ${RELATIVE_FILE} | head`,
			`git --git-dir="${physicalWorktree}/.git" --work-tree="${physicalWorktree}" ls-tree -r --name-only HEAD ${RELATIVE_DIRECTORY}`,
			`printf start && git --git-dir="${physicalWorktree}/.git" --work-tree="${physicalWorktree}" ls-tree -r --name-only HEAD ${RELATIVE_DIRECTORY}`,
		];

		const result = runProbe(commands);

		assert.strictEqual(result.commands.length, commands.length);
		for (const entry of result.commands) {
			assert.strictEqual(entry.allowed, true, entry.command);
			assert.strictEqual(entry.rewritten, false, entry.command);
			assert.strictEqual(entry.newCommand, entry.command);
		}
	});

	test("an explicit write destination is still governed", () => {
		const output = join(physicalWorktree, "relative", "output.txt");
		const command = `printf fixture > "${output}"`;

		const result = runProbe([command]);
		const [entry] = result.commands;

		assert.ok(entry);
		assert.strictEqual(entry.allowed, false);
		assert.strictEqual(entry.rewritten, true);
		assert.ok(entry.newCommand.includes(join(home, ".probe", "relative", "output.txt")));
		assert.strictEqual(entry.newCommand.includes(output), false);
	});
});
