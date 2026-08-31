import assert from "node:assert/strict";
import { describe, test } from "node:test";
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
