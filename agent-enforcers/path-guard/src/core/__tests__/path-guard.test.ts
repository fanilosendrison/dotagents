import { describe, expect, test } from "bun:test";
import {
	checkBashCommand,
	checkPath,
	extractBashPaths,
	rewriteBashCommand,
} from "../path-guard";

describe("path-guard Core Unit Tests", () => {
	// ── checkPath ───────────────────────────────────────────────────────────
	test("allows writes through ~/.pi/agent/", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		expect(checkPath(`${HOME}/.pi/agent/settings.json`).allowed).toBe(true);
	});

	test("blocks writes directly to dotpi/", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const result = checkPath(`${HOME}/Developper/Projects/dotpi/settings.json`);
		expect(result.allowed).toBe(false);
		expect(result.gateway).toContain("~/.pi/agent/");
	});

	// ── extractBashPaths ────────────────────────────────────────────────────
	test("extracts absolute paths from command arguments", () => {
		const paths = extractBashPaths("cat /tmp/test.txt /var/log/syslog");
		expect(paths).toContain("/tmp/test.txt");
		expect(paths).toContain("/var/log/syslog");
	});

	test("extracts redirect targets", () => {
		const paths = extractBashPaths("echo 'hello' > /tmp/out.txt");
		expect(paths).toContain("/tmp/out.txt");
	});

	test("extracts quoted absolute paths from command arguments", () => {
		const paths = extractBashPaths('cat "/tmp/test file.txt"');
		expect(paths).toContain("/tmp/test file.txt");
	});

	test("extracts quoted redirect targets", () => {
		const paths = extractBashPaths('echo "hello" > "/tmp/out file.txt"');
		expect(paths).toContain("/tmp/out file.txt");
	});

	// ── rewriteBashCommand ──────────────────────────────────────────────────
	test("returns unmodified safe bash commands", () => {
		const cmd = "ls -la /tmp";
		const result = rewriteBashCommand(cmd);
		expect(result.rewritten).toBe(false);
		expect(result.newCommand).toBe(cmd);
	});

	test("rewrites redirect to dotpi/", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const cmd = `echo 'hello' > ${HOME}/Developper/Projects/dotpi/settings.json`;
		const result = rewriteBashCommand(cmd);
		expect(result.rewritten).toBe(true);
		expect(result.newCommand).toContain(`${HOME}/.pi/agent/settings.json`);
	});

	test("blocks quoted dot repo paths", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const cmd = `cat "${HOME}/Developper/Projects/dotagents/AGENTS.md"`;
		const result = checkBashCommand(cmd);
		expect(result.allowed).toBe(false);
		expect(result.rewrittenPath).toBe(`${HOME}/.agents/AGENTS.md`);
	});

	test("rewrites quoted redirect targets", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const cmd = `echo 'hello' > "${HOME}/Developper/Projects/dotpi/settings.json"`;
		const result = rewriteBashCommand(cmd);
		expect(result.rewritten).toBe(true);
		expect(result.newCommand).toContain(`${HOME}/.pi/agent/settings.json`);
	});

	test("allows pure git operations on dotpi", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const cmd = `cd ${HOME}/Developper/Projects/dotpi && git commit -m 'feat: test'`;
		const result = rewriteBashCommand(cmd);
		expect(result.rewritten).toBe(false);
	});
});
