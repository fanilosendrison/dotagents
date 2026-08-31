import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	detectCommitIntent,
	evaluateEnforcement,
	isGitCommitsPushSkillCommand,
	recognizeGitCommitsPushCommand,
} from "../validator.ts";

const RETIRED_BUN_LAUNCH =
	"cd /Users/example/.agents/skills/git-commits-push && bun run start";
const CANONICAL_PNPM_LAUNCH =
	'cd "$HOME/.agents/skills/git-commits-push" && pnpm --silent run start';

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
			recognizeGitCommitsPushCommand(RETIRED_BUN_LAUNCH),
			null,
		);
		assert.strictEqual(
			recognizeGitCommitsPushCommand(CANONICAL_PNPM_LAUNCH),
			"pnpm-launch",
		);
	});

	test("accepts absolute, home-variable, and tilde gateway paths", () => {
		for (const command of [
			CANONICAL_PNPM_LAUNCH,
			"cd ~/.agents/skills/git-commits-push && pnpm --silent run start",
		]) {
			assert.notStrictEqual(recognizeGitCommitsPushCommand(command), null);
		}
	});

	test("rejects lookalike and incomplete launch commands", () => {
		for (const command of [
			"cat ~/.agents/skills/git-commits-push/README.md",
			"cd ~/.agents/skills/git-commits-push",
			"pnpm --silent run start",
			"cd ~/.agents/skills/git-commits-push && pnpm run start",
			"cd ~/.agents/skills/git-commits-push && npm run start",
			"cd ~/.agents/skills/git-commits-push-copy && bun run start",
			"echo '/git-commits-push'",
		]) {
			assert.strictEqual(recognizeGitCommitsPushCommand(command), null);
		}
	});

	test("rejects unsafe separators and appended commands", () => {
		for (const command of [
			"cd ~/.agents/skills/git-commits-push; bun run start",
			"cd ~/.agents/skills/git-commits-push | bun run start",
			"cd ~/.agents/skills/git-commits-push || bun run start",
			`${CANONICAL_PNPM_LAUNCH} && git commit -m 'unsafe'`,
			"/git-commits-push && git push",
			"/git-commits-push $(git push)",
			"/git-commits-push > /tmp/result",
			'cd "$(pwd)/.agents/skills/git-commits-push" && bun run start',
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
