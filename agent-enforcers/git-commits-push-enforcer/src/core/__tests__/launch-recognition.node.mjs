import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	detectCommitIntent,
	evaluateEnforcement,
	isGitCommitsPushSkillCommand,
	recognizeGitCommitsPushCommand,
} from "../validator.ts";

const RETIRED_SKILL_DIRECTORY_LAUNCH =
	'cd "$HOME/.agents/skills/git-commits-push" && pnpm --silent run start';
const RETIRED_PROJECT_LAUNCH =
	'cd "$HOME/Developper/Projects/git-commits-push" && pnpm --silent run start';
const CANONICAL_BINARY_LAUNCH = '"$HOME/.local/bin/git-commits-push"';

describe("recognizeGitCommitsPushCommand", () => {
	test("recognizes slash skill invocations", () => {
		assert.strictEqual(
			recognizeGitCommitsPushCommand("/git-commits-push"),
			"skill-invocation",
		);
		assert.strictEqual(
			recognizeGitCommitsPushCommand("  /git-commits-push --force  "),
			"skill-invocation",
		);
	});

	test("accepts the installed binary command without checkout knowledge", () => {
		for (const command of [
			CANONICAL_BINARY_LAUNCH,
			"git-commits-push",
			"$HOME/.local/bin/git-commits-push",
			"~/.local/bin/git-commits-push",
			"/Users/example/.local/bin/git-commits-push",
		]) {
			assert.strictEqual(
				recognizeGitCommitsPushCommand(command),
				"binary-launch",
				command,
			);
		}
	});

	test("rejects retired checkout launches and lookalikes", () => {
		for (const command of [
			RETIRED_SKILL_DIRECTORY_LAUNCH,
			RETIRED_PROJECT_LAUNCH,
			"git-commits-push-copy",
			"/usr/local/bin/git-commits-push",
			"/Users/*/.local/bin/git-commits-push",
			"echo 'git-commits-push'",
			"cat ~/.local/bin/git-commits-push",
		]) {
			assert.strictEqual(recognizeGitCommitsPushCommand(command), null, command);
		}
	});

	test("rejects arguments, wrappers, redirects, and appended commands", () => {
		for (const command of [
			"git-commits-push --force",
			"command git-commits-push",
			"env git-commits-push",
			"GCP_TEST=1 git-commits-push",
			`${CANONICAL_BINARY_LAUNCH} && git push`,
			"git-commits-push; git commit -m unsafe",
			"git-commits-push | tee /tmp/result",
			"git-commits-push > /tmp/result",
			"$(printf git-commits-push)",
			"`printf git-commits-push`",
			"/git-commits-push && git push",
			"/git-commits-push $(git push)",
			"/git-commits-push > /tmp/result",
		]) {
			assert.strictEqual(recognizeGitCommitsPushCommand(command), null, command);
		}
	});
});

describe("shared launch recognition consumers", () => {
	test("keeps boolean and intent wrappers aligned", () => {
		for (const command of ["/git-commits-push", CANONICAL_BINARY_LAUNCH]) {
			assert.strictEqual(isGitCommitsPushSkillCommand(command), true);
			assert.strictEqual(detectCommitIntent(command), "git-commits-push");
		}
	});

	test("allows the binary and blocks an appended raw mutation", () => {
		const launchResult = evaluateEnforcement({
			command: CANONICAL_BINARY_LAUNCH,
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(launchResult.action, "allow");
		assert.strictEqual(launchResult.detectedBy, "git-commits-push");

		const appendedMutationResult = evaluateEnforcement({
			command: `${CANONICAL_BINARY_LAUNCH} && git push`,
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(appendedMutationResult.action, "block");
		assert.strictEqual(appendedMutationResult.detectedBy, "git-commit");
		assert.strictEqual(appendedMutationResult.mutation, "push");
	});
});
