/**
 * Shell-boundary proof that wrapper quoting is preserved when a governed
 * write destination is rewritten inside `bash -c`.
 *
 * The unit regressions assert the encoded command string. This file proves
 * the property across a real boundary: the rewritten command is handed to a
 * real `/bin/bash`, executed by a real process, and the test observes the
 * write, the wrapper arguments, and the read argument of the inner command.
 *
 * The fixture uses an isolated temporary `HOME`, so the physical repository is
 * a temporary `dot*` worktree and the gateway resolves under that same home.
 * No machine-specific path is involved.
 */

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";

const CORE_PATH = join(dirname(import.meta.dirname), "path-guard.ts");

interface ProbeResult {
	readonly allowed: boolean;
	readonly rewritten: boolean;
	readonly newCommand: string;
	readonly stdout: string | null;
	readonly executionError: string | null;
}

const PROBE_SCRIPT = `
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const core = await import(pathToFileURL(process.env.PATH_GUARD_CORE).href);
const command = process.env.PROBE_COMMAND;

const decision = core.checkBashCommand(command);
const result = core.rewriteBashCommand(command);

let stdout = null;
let executionError = null;
try {
  stdout = execFileSync("/bin/bash", ["-c", result.newCommand], {
    encoding: "utf8",
  });
} catch (error) {
  executionError = error instanceof Error ? error.message : String(error);
}

process.stdout.write(
  JSON.stringify({
    allowed: decision.allowed,
    rewritten: result.rewritten,
    newCommand: result.newCommand,
    stdout,
    executionError,
  }),
);
`;

describe("path-guard wrapper quoting shell boundary", () => {
	let fixtureRoot: string;
	let home: string;
	let physicalWorktree: string;
	let gatewayWorktree: string;
	let probePath: string;

	before(() => {
		// realpath avoids the macOS /var -> /private/var alias so that the
		// temporary home, the physical worktree, and the guard's project root
		// all agree on one path spelling.
		fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), "path-guard-wrapper-")));
		home = join(fixtureRoot, "home");
		physicalWorktree = join(home, "Developper", "Projects", "dotprobe");
		gatewayWorktree = join(home, ".probe");

		mkdirSync(physicalWorktree, { recursive: true });
		mkdirSync(gatewayWorktree, { recursive: true });
		writeFileSync(join(physicalWorktree, "in file.txt"), "input-data\n");

		probePath = join(fixtureRoot, "probe.mjs");
		writeFileSync(probePath, PROBE_SCRIPT);
	});

	after(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	function runProbe(command: string): ProbeResult {
		const probe = spawnSync(process.execPath, [probePath], {
			encoding: "utf8",
			env: {
				...process.env,
				HOME: home,
				PATH_GUARD_CORE: CORE_PATH,
				PROBE_COMMAND: command,
			},
			shell: false,
		});
		assert.strictEqual(probe.status, 0, probe.stderr);
		return JSON.parse(probe.stdout) as ProbeResult;
	}

	test("preserves bash -c semantics and writes to the gateway", () => {
		const physicalInput = join(physicalWorktree, "in file.txt");
		const physicalOutput = join(physicalWorktree, "out file.txt");
		const gatewayOutput = join(gatewayWorktree, "out file.txt");
		const escapedInput = physicalInput.replace(/ /g, "\\ ");
		const escapedOutput = physicalOutput.replace(/ /g, "\\ ");

		const command = [
			"bash -c",
			`'cat ${escapedInput} > ${escapedOutput}; printf "argv0=%s\\nargc=%s\\narg1=%s\\n" "$0" "$#" "$1"'`,
			"guard-probe",
			"extra-arg",
		].join(" ");

		const result = runProbe(command);

		assert.strictEqual(result.allowed, false);
		assert.strictEqual(result.rewritten, true);
		assert.strictEqual(result.executionError, null);

		// The read argument keeps its exact physical spelling.
		assert.ok(result.newCommand.includes(`cat ${escapedInput} >`));
		// The physical write destination is gone from the rewritten command.
		assert.strictEqual(result.newCommand.includes(escapedOutput), false);

		// The wrapper still receives one command string and its positional
		// arguments are intact.
		assert.strictEqual(
			result.stdout,
			"argv0=guard-probe\nargc=1\narg1=extra-arg\n",
		);

		// The write landed on the gateway, not on the physical worktree.
		assert.strictEqual(existsSync(physicalOutput), false);
		assert.strictEqual(readFileSync(gatewayOutput, "utf8"), "input-data\n");
	});
});
