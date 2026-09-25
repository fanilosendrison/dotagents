import assert from "node:assert/strict";
import { homedir } from "node:os";
import { describe, test } from "node:test";
import { recognizeGitCommitsPushCommand } from "../../../../git-commits-push-enforcer/src/core/validator.ts";
import {
	checkBashCommand,
	checkPath,
	extractBashPaths,
	extractBashWriteTargetOccurrences,
	extractBashWriteTargets,
	rewriteBashCommand,
} from "../path-guard.ts";

describe("path-guard Core Unit Tests", () => {
	const HOME = homedir();
	const physicalDotPi = `${HOME}/Developper/Projects/dotpi`;
	const gatewayDotPi = `${HOME}/.pi/agent`;

	// ── checkPath ───────────────────────────────────────────────────────────
	test("allows writes through ~/.pi/agent/", () => {
		assert.strictEqual(checkPath(`${HOME}/.pi/agent/settings.json`).allowed, true);
	});

	test("blocks writes directly to dotpi/", () => {
		const result = checkPath(`${physicalDotPi}/settings.json`);
		assert.strictEqual(result.allowed, false);
		assert.ok(result.gateway?.includes("~/.pi/agent/"));
	});

	// ── extractBashWriteTargets — the enforcement abstraction ──────────────
	test("extracts every governed output redirect form", () => {
		const target = "/tmp/out.txt";
		const commands = [
			`echo 'hello' > ${target}`,
			`echo 'hello' >> ${target}`,
			`command 1> ${target}`,
			`command 1>> ${target}`,
			`command 2> ${target}`,
			`command 2>> ${target}`,
			`command &> ${target}`,
			`command &>> ${target}`,
			`echo 'hello' >${target}`,
			`command 2>>${target}`,
			`command &>${target}`,
		];
		for (const command of commands) {
			assert.deepEqual(extractBashWriteTargets(command), [target], command);
		}
	});

	test("extracts tee write targets", () => {
		assert.deepEqual(
			extractBashWriteTargets("cat /tmp/in.txt | tee -a /tmp/out.txt"),
			["/tmp/out.txt"],
		);
	});

	test("does not treat input redirections as write targets", () => {
		assert.deepEqual(extractBashWriteTargets("cat < /tmp/in.txt"), []);
		assert.deepEqual(extractBashWriteTargets("cat << /tmp/in.txt"), []);
	});

	test("does not extract ordinary arguments or arbitrary program paths", () => {
		const commands = [
			"ls relative/path",
			"grep pattern relative/path",
			"git diff -- relative/path",
			"cat /tmp/a /tmp/b",
			"some-program /tmp/data",
			"env my-var=1 some-program /tmp/data",
		];
		for (const command of commands) {
			assert.deepEqual(extractBashWriteTargets(command), [], command);
		}
	});

	test("does not resolve bare redirect targets against the guard cwd", () => {
		assert.deepEqual(extractBashWriteTargets("echo 'hello' > out.txt"), []);
	});

	// ── extractBashPaths — the non-enforcement "all paths" abstraction ─────
	test("keeps extracting every path-like token for non-enforcement consumers", () => {
		const paths = extractBashPaths("cat /tmp/test.txt relative/syslog");
		assert.ok(paths.includes("/tmp/test.txt"));
		assert.ok(paths.includes("relative/syslog"));
	});

	test("extracts redirect targets", () => {
		const paths = extractBashPaths("echo 'hello' > /tmp/out.txt");
		assert.ok(paths.includes("/tmp/out.txt"));
	});

	test("extracts quoted absolute paths from command arguments", () => {
		const paths = extractBashPaths('cat "/tmp/test file.txt"');
		assert.ok(paths.includes("/tmp/test file.txt"));
	});

	test("extracts quoted redirect targets", () => {
		const paths = extractBashPaths('echo "hello" > "/tmp/out file.txt"');
		assert.ok(paths.includes("/tmp/out file.txt"));
	});

	// ── rewriteBashCommand / checkBashCommand ──────────────────────────────
	test("returns unmodified safe bash commands", () => {
		const cmd = "ls -la /tmp";
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, false);
		assert.strictEqual(result.newCommand, cmd);
	});

	test("rewrites redirect to dotpi/", () => {
		const cmd = `echo 'hello' > ${physicalDotPi}/settings.json`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`${gatewayDotPi}/settings.json`));
	});

	test("rewrites append, stderr, and combined redirects to dotpi/", () => {
		const forms = [
			[`echo 'hello' >> ${physicalDotPi}/log.txt`, `${gatewayDotPi}/log.txt`],
			[`command 2> ${physicalDotPi}/err.log`, `${gatewayDotPi}/err.log`],
			[`command 2>> ${physicalDotPi}/err.log`, `${gatewayDotPi}/err.log`],
			[`command &> ${physicalDotPi}/all.log`, `${gatewayDotPi}/all.log`],
			[`echo 'hello' > "${physicalDotPi}/quoted file.txt"`, `${gatewayDotPi}/quoted file.txt`],
		] as const;
		for (const [cmd, rewrittenTarget] of forms) {
			const result = rewriteBashCommand(cmd);
			assert.strictEqual(result.rewritten, true, cmd);
			assert.ok(result.newCommand.includes(rewrittenTarget), cmd);
			assert.strictEqual(result.newCommand.includes(physicalDotPi), false, cmd);
		}
	});

	test("preserves quoted read-only dot repository arguments", () => {
		const cmd = `cat "${HOME}/Developper/Projects/dotagents/AGENTS.md"`;
		assert.strictEqual(checkBashCommand(cmd).allowed, true);
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, false);
		assert.strictEqual(result.newCommand, cmd);
	});

	test("preserves relative read arguments and Git relative pathspecs", () => {
		const commands = [
			"ls agent-enforcers/path-guard/src/core/",
			"grep -n sanctioned agent-enforcers/path-guard/src/core/path-guard.ts | head",
			"git show HEAD:agent-enforcers/path-guard/src/core/path-guard.ts",
			"printf start && git ls-tree HEAD agent-enforcers/path-guard/src/core/",
		];
		for (const cmd of commands) {
			assert.strictEqual(checkBashCommand(cmd).allowed, true, cmd);
			const result = rewriteBashCommand(cmd);
			assert.strictEqual(result.rewritten, false, cmd);
			assert.strictEqual(result.newCommand, cmd, cmd);
		}
	});

	test("rewrites only the governed write destination in a mixed command", () => {
		const input = `${physicalDotPi}/src/input.txt`;
		const output = `${physicalDotPi}/src/output.txt`;
		const cmd = `cat ${input} > ${output}`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		// The read argument keeps its exact physical spelling.
		assert.ok(result.newCommand.includes(input));
		assert.ok(result.newCommand.includes(`${gatewayDotPi}/src/output.txt`));
		assert.strictEqual(result.newCommand.includes(output), false);
	});

	test("preserves dot repository arguments of unknown programs (PG-5)", () => {
		const commands = [
			`some-program ${physicalDotPi}/path`,
			`my-program --repository ${physicalDotPi}`,
			`cp /tmp/source ${physicalDotPi}/target`,
		];
		for (const cmd of commands) {
			// Intentional: arbitrary process-internal mutations are outside the
			// path guard's guarantee, so the argument is not reinterpreted.
			assert.strictEqual(checkBashCommand(cmd).allowed, true, cmd);
			const result = rewriteBashCommand(cmd);
			assert.strictEqual(result.rewritten, false, cmd);
			assert.strictEqual(result.newCommand, cmd, cmd);
		}
	});

	test("allows pure git operations on dotpi", () => {
		const cmd = `cd ${physicalDotPi} && git commit -m 'feat: test'`;
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
		assert.strictEqual(result.newCommand.includes(`${physicalDotPi}/out.txt`), false);
		// The ordinary --repository argument is not reinterpreted.
		assert.ok(result.newCommand.includes(`--repository "${physicalDotPi}"`));
	});

	const refusedFormsWithoutWrite = [
		["env wrapper", `env GCP_TEST=1 ${canonicalLaunch} --repository "${physicalDotPi}"`],
		["&& chain", `${canonicalLaunch} --repository "${physicalDotPi}" && git push`],
		["; chain", `${canonicalLaunch} --repository "${physicalDotPi}" ; git commit -m x`],
		["backgrounding", `${canonicalLaunch} --repository "${physicalDotPi}" &`],
		["slash form", `/git-commits-push --repository "${physicalDotPi}"`],
		["tilde form", `~/.local/bin/git-commits-push --repository "${physicalDotPi}"`],
		["unquoted canonical form", `$HOME/.local/bin/git-commits-push --repository "${physicalDotPi}"`],
	] as const;

	for (const [form, cmd] of refusedFormsWithoutWrite) {
		test(`does not sanction the rejected ${form} and preserves its arguments`, () => {
			assert.strictEqual(recognizeGitCommitsPushCommand(cmd), null);
			assert.strictEqual(checkBashCommand(cmd).allowed, true);
			const result = rewriteBashCommand(cmd);
			assert.strictEqual(result.rewritten, false);
			assert.strictEqual(result.newCommand, cmd);
		});
	}

	const refusedFormsWithWrite = [
		["pipeline", `${canonicalLaunch} --repository "${physicalDotPi}" | tee ${physicalDotPi}/out.txt`],
		["redirection", `${canonicalLaunch} --repository "${physicalDotPi}" > ${physicalDotPi}/out.txt`],
		["command substitution", `${canonicalLaunch} --repository "$(git rev-parse --show-toplevel)" > ${physicalDotPi}/out.txt`],
		["backticks", `${canonicalLaunch} --repository \`pwd\` > ${physicalDotPi}/out.txt`],
		["process substitution", `${canonicalLaunch} --repository <(pwd) > ${physicalDotPi}/out.txt`],
	] as const;

	for (const [form, cmd] of refusedFormsWithWrite) {
		test(`does not sanction the rejected ${form} and still protects its write`, () => {
			assert.strictEqual(recognizeGitCommitsPushCommand(cmd), null);
			assert.strictEqual(checkBashCommand(cmd).allowed, false);
			const result = rewriteBashCommand(cmd);
			assert.strictEqual(result.rewritten, true);
			assert.ok(result.newCommand.includes(`${homedir()}/.pi/agent/out.txt`));
			assert.strictEqual(result.newCommand.includes(`${physicalDotPi}/out.txt`), false);
		});
	}
});

describe("path-guard PG-2 conformance (git-only cannot mask a governed write)", () => {
	const physicalDotPi = `${homedir()}/Developper/Projects/dotpi`;
	const gatewayDotPi = `${homedir()}/.pi/agent`;

	test("governs an output redirect on a pure git command", () => {
		const cmd = `git log > ${physicalDotPi}/out.txt`;
		assert.strictEqual(checkBashCommand(cmd).allowed, false);
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`${gatewayDotPi}/out.txt`));
		assert.strictEqual(result.newCommand.includes(`${physicalDotPi}/out.txt`), false);
	});

	test("governs an append redirect on a pure git command", () => {
		const cmd = `git diff >> ${physicalDotPi}/out.txt`;
		assert.strictEqual(checkBashCommand(cmd).allowed, false);
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`${gatewayDotPi}/out.txt`));
		assert.strictEqual(result.newCommand.includes(`${physicalDotPi}/out.txt`), false);
	});

	test("still leaves a pure git command without write targets unchanged", () => {
		const cmd = "git log";
		assert.strictEqual(checkBashCommand(cmd).allowed, true);
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, false);
		assert.strictEqual(result.newCommand, cmd);
	});

	test("still leaves cd + git unchanged", () => {
		const cmd = `cd ${physicalDotPi} && git diff`;
		assert.strictEqual(checkBashCommand(cmd).allowed, true);
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, false);
		assert.strictEqual(result.newCommand, cmd);
	});
});

describe("path-guard PG-3 conformance (only write-target occurrences are rewritten)", () => {
	const physicalDotPi = `${homedir()}/Developper/Projects/dotpi`;
	const gatewayDotPi = `${homedir()}/.pi/agent`;

	test("preserves a read occurrence identical to the redirect destination", () => {
		const path = `${physicalDotPi}/x`;
		const cmd = `cat ${path} > ${path}`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`cat ${path} > ${gatewayDotPi}/x`));
		assert.strictEqual(result.newCommand.split(path).length - 1, 1);
	});

	test("preserves a read occurrence identical to the tee destination", () => {
		const path = `${physicalDotPi}/x`;
		const cmd = `cat ${path} | tee ${path}`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`cat ${path} | tee ${gatewayDotPi}/x`));
		assert.strictEqual(result.newCommand.split(path).length - 1, 1);
	});

	test("rewrites every write occurrence of the same path", () => {
		const path = `${physicalDotPi}/x`;
		const cmd = `printf a > ${path} ; printf b >> ${path}`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.strictEqual(result.newCommand.includes(path), false);
		assert.strictEqual(result.newCommand.split(`${gatewayDotPi}/x`).length - 1, 2);
	});

	test("preserves a quoted read occurrence and rewrites only the quoted destination", () => {
		const path = `${physicalDotPi}/file name`;
		const cmd = `cat "${path}" > "${path}"`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`cat "${path}" > "${gatewayDotPi}/file name"`));
		assert.strictEqual(result.newCommand.split(path).length - 1, 1);
	});

	test("rewrites an attached redirect occurrence positionally", () => {
		const path = `${physicalDotPi}/x`;
		const cmd = `cat ${path} >${path}`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`cat ${path} >${gatewayDotPi}/x`));
		assert.strictEqual(result.newCommand.split(path).length - 1, 1);
	});

	test("reports occurrence spans that address the write destination only", () => {
		const cmd = `cat /tmp/read.txt | tee /tmp/write.txt`;
		const occurrences = extractBashWriteTargetOccurrences(cmd);
		assert.strictEqual(occurrences.length, 1);
		const occurrence = occurrences[0];
		assert.ok(occurrence);
		assert.strictEqual(occurrence.path, "/tmp/write.txt");
		assert.strictEqual(cmd.slice(occurrence.start, occurrence.end), "/tmp/write.txt");
	});
});

describe("path-guard positional extraction inside command wrappers", () => {
	const physicalDotPi = `${homedir()}/Developper/Projects/dotpi`;
	const gatewayDotPi = `${homedir()}/.pi/agent`;

	test("rewrites a governed destination inside an unwrapped bash -c wrapper", () => {
		const cmd = `env FOO=bar bash -c 'echo x > ${physicalDotPi}/wrapped.txt'`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`bash -c 'echo x > ${gatewayDotPi}/wrapped.txt'`));
		assert.strictEqual(result.newCommand.includes(`${physicalDotPi}/wrapped.txt`), false);
	});

	test("preserves a read occurrence inside a wrapper while rewriting the write", () => {
		const path = `${physicalDotPi}/x`;
		const cmd = `bash -c 'cat ${path} > ${path}'`;
		const result = rewriteBashCommand(cmd);
		assert.strictEqual(result.rewritten, true);
		assert.ok(result.newCommand.includes(`bash -c 'cat ${path} > ${gatewayDotPi}/x'`));
		assert.strictEqual(result.newCommand.split(path).length - 1, 1);
	});
});
