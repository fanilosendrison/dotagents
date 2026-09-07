import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { detectRawGitMutation } from "../validator.ts";

describe("detectRawGitMutation", () => {
	// Basic detection
	test("detects git commit", () => {
		assert.strictEqual(detectRawGitMutation("git commit -m 'msg'"), "commit");
	});

	test("detects git commit-tree", () => {
		assert.strictEqual(
			detectRawGitMutation("git commit-tree abc123"),
			"commit-tree",
		);
	});

	test("detects git push", () => {
		assert.strictEqual(detectRawGitMutation("git push origin main"), "push");
	});

	test("detects git push --force", () => {
		assert.strictEqual(detectRawGitMutation("git push --force"), "push");
	});

	test("returns null for non-mutation commands", () => {
		assert.strictEqual(detectRawGitMutation("git status"), null);
		assert.strictEqual(detectRawGitMutation("git diff"), null);
		assert.strictEqual(detectRawGitMutation("ls -la"), null);
	});

	// Git options before the subcommand
	test("skips git -C before subcommand", () => {
		assert.strictEqual(
			detectRawGitMutation("git -C /tmp commit -m 'x'"),
			"commit",
		);
	});

	test("skips git -c before subcommand", () => {
		assert.strictEqual(
			detectRawGitMutation("git -c user.name=Bot commit -m 'x'"),
			"commit",
		);
	});

	test("skips multiple git options", () => {
		assert.strictEqual(
			detectRawGitMutation("git -C /tmp -c user.name=Bot commit -m 'x'"),
			"commit",
		);
	});

	// Env prefix obfuscation
	test("detects env-prefixed git commit", () => {
		assert.strictEqual(
			detectRawGitMutation("GIT_AUTHOR_NAME=Bot git commit -m 'x'"),
			"commit",
		);
	});

	test("detects env-prefixed git push", () => {
		assert.strictEqual(
			detectRawGitMutation("GIT_SSH_COMMAND=ssh git push origin main"),
			"push",
		);
	});

	test("detects multiple env vars before git", () => {
		assert.strictEqual(
			detectRawGitMutation(
				"GIT_AUTHOR_NAME=Bot GIT_AUTHOR_EMAIL=b@t.com git commit -m 'x'",
			),
			"commit",
		);
	});

	// Shell -c obfuscation
	test("detects git commit through bash -c", () => {
		assert.strictEqual(
			detectRawGitMutation("bash -c 'git commit -m test'"),
			"commit",
		);
	});

	test("detects git push through sh -c", () => {
		assert.strictEqual(
			detectRawGitMutation("sh -c 'git push origin main'"),
			"push",
		);
	});

	test("detects git commit through zsh -c", () => {
		assert.strictEqual(
			detectRawGitMutation("zsh -c 'git commit -m msg'"),
			"commit",
		);
	});

	// Sudo obfuscation
	test("detects git commit through sudo", () => {
		assert.strictEqual(
			detectRawGitMutation("sudo git commit -m 'x'"),
			"commit",
		);
	});

	test("detects git push through sudo", () => {
		assert.strictEqual(
			detectRawGitMutation("sudo git push origin main"),
			"push",
		);
	});

	// Env with -S (split) flag
	test("detects git commit through env -S", () => {
		assert.strictEqual(
			detectRawGitMutation("env -S 'git commit -m test'"),
			"commit",
		);
	});

	// Command chaining
	test("detects git commit in chained commands", () => {
		assert.strictEqual(
			detectRawGitMutation("echo hello && git commit -m 'x'"),
			"commit",
		);
	});

	test("detects git push after semicolon", () => {
		assert.strictEqual(
			detectRawGitMutation("cd /tmp; git push origin main"),
			"push",
		);
	});

	// env command prefix
	test("detects git commit through env command", () => {
		assert.strictEqual(
			detectRawGitMutation("env VAR=1 git commit -m 'x'"),
			"commit",
		);
	});

	// BYPASS_GIT_ENFORCER=1 env prefix — should still be detected
	test("detects BYPASS_GIT_ENFORCER env-prefixed commit", () => {
		assert.strictEqual(
			detectRawGitMutation("BYPASS_GIT_ENFORCER=1 git commit -m 'x'"),
			"commit",
		);
	});

	// nohup, command, exec wrappers
	test("detects git commit through nohup", () => {
		assert.strictEqual(
			detectRawGitMutation("nohup git commit -m 'x'"),
			"commit",
		);
	});

	test("detects git commit through command wrapper", () => {
		assert.strictEqual(
			detectRawGitMutation("command git commit -m 'x'"),
			"commit",
		);
	});

	test("detects git commit through exec wrapper", () => {
		assert.strictEqual(
			detectRawGitMutation("exec git commit -m 'x'"),
			"commit",
		);
	});

	// Complex env with shell
	test("detects env-prefix + bash -c combo", () => {
		assert.strictEqual(
			detectRawGitMutation("VAR=x bash -c 'git commit -m test'"),
			"commit",
		);
	});

	// Edge cases
	test("returns null for git without subcommand", () => {
		assert.strictEqual(detectRawGitMutation("git"), null);
	});

	test("returns null for non-git command containing git word", () => {
		assert.strictEqual(
			detectRawGitMutation("echo 'use git commit to save'"),
			null,
		);
	});

	test("returns null for empty string", () => {
		assert.strictEqual(detectRawGitMutation(""), null);
	});

	// commit-tree with options
	test("detects git commit-tree with options", () => {
		assert.strictEqual(
			detectRawGitMutation("git commit-tree -p HEAD abc123"),
			"commit-tree",
		);
	});
});
