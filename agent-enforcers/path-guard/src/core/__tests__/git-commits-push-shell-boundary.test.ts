/**
 * Shell-boundary proof for the git-commits-push path-guard sanction.
 *
 * The unit regressions assert that the shared core leaves a canonical launch
 * unchanged. This file proves the stronger property across the real boundary
 * that this repository owns: the command produced by the path guard is handed
 * to a real shell, executed by a real process, and the executable receives the
 * caller's exact physical worktree and can resolve it with Git.
 *
 * The fixture runs in an isolated temporary `HOME`, so the physical repository
 * is a temporary `dot*` worktree and the canonical executable path resolves to
 * a harmless probe under that same temporary home.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	chmodSync,
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
const CANONICAL_LAUNCH = '"$HOME/.local/bin/git-commits-push"';

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
if (process.env.PROBE_EXECUTE === "1") {
  try {
    stdout = execFileSync("/bin/bash", ["-c", result.newCommand], {
      encoding: "utf8",
    });
  } catch (error) {
    executionError = error instanceof Error ? error.message : String(error);
  }
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

const PROBE_EXECUTABLE = `#!/usr/bin/env bash
set -euo pipefail
repository=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --repository)
      repository="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
printf 'repository=%s\\n' "$repository"
printf 'toplevel=%s\\n' "$(git -C "$repository" rev-parse --show-toplevel)"
`;

describe("git-commits-push path guard shell boundary", () => {
	let fixtureRoot: string;
	let home: string;
	let physicalWorktree: string;
	let probePath: string;

	before(() => {
		// realpath avoids the macOS /var -> /private/var alias so that the
		// temporary home, the physical worktree, and the guard's project root
		// all agree on one path spelling.
		fixtureRoot = realpathSync(mkdtempSync(join(tmpdir(), "path-guard-boundary-")));
		home = join(fixtureRoot, "home");
		physicalWorktree = join(home, "Developper", "Projects", "dotprobe");

		mkdirSync(join(home, ".local", "bin"), { recursive: true });
		writeFileSync(join(home, ".local", "bin", "git-commits-push"), PROBE_EXECUTABLE);
		chmodSync(join(home, ".local", "bin", "git-commits-push"), 0o755);

		mkdirSync(physicalWorktree, { recursive: true });
		const init = spawnSync("git", ["init", physicalWorktree], { encoding: "utf8" });
		assert.strictEqual(init.status, 0, init.stderr);

		probePath = join(fixtureRoot, "probe.mjs");
		writeFileSync(probePath, PROBE_SCRIPT);
	});

	after(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	function runProbe(command: string, execute: boolean): ProbeResult {
		const probe = spawnSync(process.execPath, [probePath], {
			encoding: "utf8",
			env: {
				...process.env,
				HOME: home,
				PATH_GUARD_CORE: CORE_PATH,
				PROBE_COMMAND: command,
				PROBE_EXECUTE: execute ? "1" : "0",
			},
			shell: false,
		});
		assert.strictEqual(probe.status, 0, probe.stderr);
		return JSON.parse(probe.stdout) as ProbeResult;
	}

	test("delivers the caller's exact physical worktree to the executable", () => {
		const command = [
			CANONICAL_LAUNCH,
			`--repository "${physicalWorktree}"`,
			"--push-remote origin",
			"--push-ref refs/heads/main",
		].join(" ");

		const result = runProbe(command, true);

		assert.strictEqual(result.allowed, true);
		assert.strictEqual(result.rewritten, false);
		assert.strictEqual(result.newCommand, command);
		assert.strictEqual(result.executionError, null);
		assert.strictEqual(
			result.stdout,
			`repository=${physicalWorktree}\ntoplevel=${physicalWorktree}\n`,
		);
	});

	test("does not sanction a launcher-like command the recognizer refuses", () => {
		const command = `${CANONICAL_LAUNCH} --repository "${physicalWorktree}" > "${physicalWorktree}/out.txt"`;

		const result = runProbe(command, false);

		// The refused form receives no exemption, so its redirect destination is
		// still a governed write target and is rewritten to the gateway.
		assert.strictEqual(result.rewritten, true);
		assert.strictEqual(
			result.newCommand.includes(`${physicalWorktree}/out.txt`),
			false,
		);
		assert.ok(result.newCommand.includes(`${home}/.probe/out.txt`));
		// The ordinary --repository argument is preserved byte-for-byte.
		assert.ok(
			result.newCommand.includes(`--repository "${physicalWorktree}"`),
		);
	});
});
