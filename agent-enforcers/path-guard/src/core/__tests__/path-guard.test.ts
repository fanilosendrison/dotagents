import assert from "node:assert/strict";
import { homedir } from "node:os";
import { describe, test } from "node:test";
import { recognizeGitCommitsPushCommand } from "../../../../git-commits-push-enforcer/src/core/validator.ts";
import {
	checkBashCommand,
	checkPath,
	extractBashPaths,
	rewriteBashCommand,
} from "../path-guard.ts";

describe("path-guard Core Unit Tests", () => {
	// ── checkPath ───────────────────────────────────────────────────────────
	test("allows writes through ~/.pi/agent/", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		assert.strictEqual(checkPath(`${HOME}/.pi/agent/settings.json`).allowed, true);
	});

	test("blocks writes directly to dotpi/", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const result = checkPath(`${HOME}/Developper/Projects/dotpi/settings.json`);
		assert.strictEqual(result.allowed, false);
		assert.ok(result.gateway?.includes("~/.pi/agent/"));
	});

	// ── extractBashPaths ────────────────────────────────────────────────────
	test("extracts absolute paths from command arguments", () => {
		const paths = extractBashPaths("cat /tmp/test.txt /var/log/syslog");
		assert.ok((paths).includes("/tmp/test.txt"));
		assert.ok((paths).includes("/var/log/syslog"));
	});

	test("extracts redirect targets", () => {
		const paths = extractBashPaths("echo 'hello' > /tmp/out.txt");
		assert.ok((paths).includes("/tmp/out.txt"));
	});

	test("extracts quoted absolute paths from command arguments", () => {
		const paths = extractBashPaths('cat "/tmp/test file.txt"');
		assert.ok((paths).includes("/tmp/test file.txt"));
	});

	test("extracts quoted redirect targets", () => {
		const paths = extractBashPaths('echo "hello" > "/tmp/out file.txt"');
		assert.ok((paths).includes("/tmp/out file.txt"));
	});

	// ── rewriteBashCommand ──────────────────────────────────────────────────
	test("returns unmodified safe bash commands", () => {
		const cmd = "ls -la /tmp";
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, false);
		assert.strictEqual(result.newCommand, cmd);
	});

	test("rewrites redirect to dotpi/", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const cmd = `echo 'hello' > ${HOME}/Developper/Projects/dotpi/settings.json`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok((result.newCommand).includes(`${HOME}/.pi/agent/settings.json`));
	});

	test("blocks quoted dot repo paths", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const cmd = `cat "${HOME}/Developper/Projects/dotagents/AGENTS.md"`;
		const result = checkBashCommand(cmd);
		assert.strictEqual(result.allowed, false);
		assert.strictEqual(result.rewrittenPath, `${HOME}/.agents/AGENTS.md`);
	});

	test("rewrites quoted redirect targets", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const cmd = `echo 'hello' > "${HOME}/Developper/Projects/dotpi/settings.json"`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok((result.newCommand).includes(`${HOME}/.pi/agent/settings.json`));
	});

	test("allows pure git operations on dotpi", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const cmd = `cd ${HOME}/Developper/Projects/dotpi && git commit -m 'feat: test'`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, false);
	});
});

describe("git-commits-push canonical launch sanction", () => {
	const physicalDotPi = `${homedir()}/Developper/Projects/dotpi`;
	const canonicalLaunch = '"$HOME/.local/bin/git-commits-push"';
	const targetedLaunch = [
		canonicalLaunch,
		`--repository "${physicalDotPi}"`,
		"--push-remote origin",
		"--push-ref refs/heads/main",
	].join(" ");

	test("leaves a canonical global launch unchanged", () => {
		assert.strictEqual(
			recognizeGitCommitsPushCommand(canonicalLaunch),
			"binary-launch",
		);
		const result = rewriteBashCommand(canonicalLaunch);
		assert.strictEqual(result.rewritten, false);
		assert.strictEqual(result.newCommand, canonicalLaunch);
		assert.strictEqual(checkBashCommand(canonicalLaunch).allowed, true);
	});

	test("leaves a canonical targeted launch unchanged", () => {
		assert.strictEqual(
			recognizeGitCommitsPushCommand(targetedLaunch),
			"binary-launch",
		);
		const result = rewriteBashCommand(targetedLaunch);
		assert.strictEqual(result.rewritten, false);
		assert.strictEqual(result.newCommand, targetedLaunch);
	});

	test("allows a canonical targeted launch", () => {
		assert.strictEqual(checkBashCommand(targetedLaunch).allowed, true);
	});

	test("never substitutes the physical repository path", () => {
		const result = rewriteBashCommand(targetedLaunch);
		assert.ok(result.newCommand.includes(physicalDotPi));
		assert.strictEqual(result.newCommand.includes(`${homedir()}/.pi/agent`), false);
		assert.strictEqual(result.newCommand.includes("Silent redirection"), false);
	});

	test("still protects a direct write to a dot* repository", () => {
		const cmd = `echo 'hello' > ${physicalDotPi}/settings.json`;
		const rewritten = rewriteBashCommand(cmd);
		assert.strictEqual(rewritten.rewritten, true);
		assert.ok(rewritten.newCommand.includes(`${homedir()}/.pi/agent/settings.json`));
		assert.strictEqual(checkBashCommand(cmd).allowed, false);
	});

	test("does not exempt a launcher-like command that redirects", () => {
		const cmd = `${canonicalLaunch} --repository "${physicalDotPi}" > ${physicalDotPi}/out.txt`;
		assert.strictEqual(recognizeGitCommitsPushCommand(cmd), null);
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`${homedir()}/.pi/agent/out.txt`));
		assert.strictEqual(result.newCommand.includes(physicalDotPi), false);
	});

	const rejectedForms = [
		["env wrapper", `env GCP_TEST=1 ${canonicalLaunch} --repository "${physicalDotPi}"`],
		["&& chain", `${canonicalLaunch} --repository "${physicalDotPi}" && git push`],
		["; chain", `${canonicalLaunch} --repository "${physicalDotPi}" ; git commit -m x`],
		["pipeline", `${canonicalLaunch} --repository "${physicalDotPi}" | tee ${physicalDotPi}/out.txt`],
		["redirection", `${canonicalLaunch} --repository "${physicalDotPi}" > ${physicalDotPi}/out.txt`],
		["backgrounding", `${canonicalLaunch} --repository "${physicalDotPi}" &`],
		["command substitution", `${canonicalLaunch} --repository "$(git rev-parse --show-toplevel)" > ${physicalDotPi}/out.txt`],
		["backticks", `${canonicalLaunch} --repository \`pwd\` > ${physicalDotPi}/out.txt`],
		["process substitution", `${canonicalLaunch} --repository <(pwd) > ${physicalDotPi}/out.txt`],
		["slash form", `/git-commits-push --repository "${physicalDotPi}"`],
		["tilde form", `~/.local/bin/git-commits-push --repository "${physicalDotPi}"`],
		["unquoted canonical form", `$HOME/.local/bin/git-commits-push --repository "${physicalDotPi}"`],
	] as const;

	for (const [form, cmd] of rejectedForms) {
		test(`does not sanction the rejected ${form}`, () => {
			assert.strictEqual(recognizeGitCommitsPushCommand(cmd), null);
			assert.strictEqual(checkBashCommand(cmd).allowed, false);
			assert.strictEqual(rewriteBashCommand(cmd).rewritten, true);
		});
	}
});
