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
const CANONICAL_PNPM_LAUNCH =
	'cd "$HOME/Developper/Projects/git-commits-push" && pnpm --silent run start';

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

	test("accepts only the canonical pnpm shell launch", () => {
		assert.strictEqual(
			recognizeGitCommitsPushCommand(RETIRED_SKILL_DIRECTORY_LAUNCH),
			null,
		);
		assert.strictEqual(
			recognizeGitCommitsPushCommand(CANONICAL_PNPM_LAUNCH),
			"pnpm-launch",
		);
	});

	test("accepts absolute, home-variable, and tilde project paths", () => {
		for (const command of [
			CANONICAL_PNPM_LAUNCH,
			"cd ~/Developper/Projects/git-commits-push && pnpm --silent run start",
			"cd /Users/example/Developper/Projects/git-commits-push && pnpm --silent run start",
		]) {
			assert.notStrictEqual(recognizeGitCommitsPushCommand(command), null);
		}
	});

	test("rejects lookalike and incomplete launch commands", () => {
		for (const command of [
			"cat ~/Developper/Projects/git-commits-push/README.md",
			"cd ~/Developper/Projects/git-commits-push",
			"pnpm --silent run start",
			"cd ~/Developper/Projects/git-commits-push && pnpm run start",
			"cd ~/Developper/Projects/git-commits-push && npm run start",
			"cd ~/Developper/Projects/git-commits-push-copy && pnpm --silent run start",
			"cd /Users/*/Developper/Projects/git-commits-push && pnpm --silent run start",
			"cd /Users/[a-z]*/Developper/Projects/git-commits-push && pnpm --silent run start",
			'cd "/Users/${OTHER}/Developper/Projects/git-commits-push" && pnpm --silent run start',
			RETIRED_SKILL_DIRECTORY_LAUNCH,
			"echo '/git-commits-push'",
		]) {
			assert.strictEqual(recognizeGitCommitsPushCommand(command), null);
		}
	});

	test("rejects unsafe separators and appended commands", () => {
		for (const command of [
			"cd ~/Developper/Projects/git-commits-push; pnpm --silent run start",
			"cd ~/Developper/Projects/git-commits-push | pnpm --silent run start",
			"cd ~/Developper/Projects/git-commits-push || pnpm --silent run start",
			`${CANONICAL_PNPM_LAUNCH} && git commit -m 'unsafe'`,
			"/git-commits-push && git push",
			"/git-commits-push $(git push)",
			"/git-commits-push > /tmp/result",
			'cd "$(pwd)/Developper/Projects/git-commits-push" && pnpm --silent run start',
		]) {
			assert.strictEqual(recognizeGitCommitsPushCommand(command), null);
		}
	});
});

describe("shared launch recognition consumers", () => {
	test("keeps boolean and intent wrappers aligned", () => {
		for (const command of ["/git-commits-push", CANONICAL_PNPM_LAUNCH]) {
			assert.strictEqual(isGitCommitsPushSkillCommand(command), true);
			assert.strictEqual(detectCommitIntent(command), "git-commits-push");
		}
	});

	test("allows canonical launches and blocks appended raw mutations", () => {
		const launchResult = evaluateEnforcement({
			command: CANONICAL_PNPM_LAUNCH,
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(launchResult.action, "allow");
		assert.strictEqual(launchResult.detectedBy, "git-commits-push");

		const appendedMutationResult = evaluateEnforcement({
			command: `${CANONICAL_PNPM_LAUNCH} && git push`,
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(appendedMutationResult.action, "block");
		assert.strictEqual(appendedMutationResult.detectedBy, "git-commit");
		assert.strictEqual(appendedMutationResult.mutation, "push");
	});
});
