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

const CREATE_LAUNCH = `${CANONICAL_BINARY_LAUNCH} --repository "/tmp/task worktree" --push-remote "origin" --push-ref "refs/heads/feat/task" --create-if-absent --base-ref "refs/heads/main" --base-sha "${"a".repeat(40)}"`;

describe("conditional creation shell boundary", () => {
	test("accepts static complete creation arguments without owning CLI semantics", () => {
		assert.equal(recognizeGitCommitsPushCommand(CREATE_LAUNCH), "binary-launch");
		assert.equal(evaluateEnforcement({ command: CREATE_LAUNCH, legacyBypassSet: false, trustedSkillMarkerSet: false }).action, "allow");
	});
	test("refuses dynamic authority, wrappers and raw publication", () => {
		for (const command of [
			CREATE_LAUNCH.replace(`"${"a".repeat(40)}"`, '"$BASE_SHA"'),
			CREATE_LAUNCH.replace(`"${"a".repeat(40)}"`, '"$(git rev-parse HEAD)"'),
			`env ${CREATE_LAUNCH}`, `timeout 60 ${CREATE_LAUNCH}`,
			`${CREATE_LAUNCH} && git push`, `${CREATE_LAUNCH} > /tmp/result`,
			"git push origin HEAD:refs/heads/feat/task",
		]) {
			assert.equal(recognizeGitCommitsPushCommand(command), null, command);
			// Recognition refusal means no canonical-launch sanction. Wrapper intent
			// detection is a separate existing boundary, not extended by these flags.
			if (command.startsWith("git ") || command.startsWith(CANONICAL_BINARY_LAUNCH)) {
				assert.equal(evaluateEnforcement({ command, legacyBypassSet: false, trustedSkillMarkerSet: false }).action, "block", command);
			}
		}
	});
});

describe("recognizeGitCommitsPushCommand", () => {
	test("accepts the canonical installed binary with static arguments", () => {
		for (const command of [
			CANONICAL_BINARY_LAUNCH,
			`${CANONICAL_BINARY_LAUNCH} --resume --run-id run-123`,
			`${CANONICAL_BINARY_LAUNCH} --repository "/tmp/task worktree" --push-remote origin --push-ref refs/heads/main`,
		]) {
			assert.strictEqual(
				recognizeGitCommitsPushCommand(command),
				"binary-launch",
				command,
			);
		}
	});

	test("rejects slash-form shell commands, noncanonical binaries, and lookalikes", () => {
		for (const command of [
			"/git-commits-push",
			"/git-commits-push --repository /tmp/repo --push-remote origin --push-ref refs/heads/main",
			RETIRED_SKILL_DIRECTORY_LAUNCH,
			RETIRED_PROJECT_LAUNCH,
			"git-commits-push",
			"git-commits-push-copy",
			"$HOME/.local/bin/git-commits-push",
			"~/.local/bin/git-commits-push",
			"/Users/example/.local/bin/git-commits-push",
			"/usr/local/bin/git-commits-push",
			"echo 'git-commits-push'",
			"cat ~/.local/bin/git-commits-push",
		]) {
			assert.strictEqual(recognizeGitCommitsPushCommand(command), null, command);
		}
	});

	test("rejects wrappers, dynamic shell syntax, redirects, and appended commands", () => {
		for (const command of [
			`command ${CANONICAL_BINARY_LAUNCH}`,
			`env ${CANONICAL_BINARY_LAUNCH}`,
			`GCP_TEST=1 ${CANONICAL_BINARY_LAUNCH}`,
			`${CANONICAL_BINARY_LAUNCH} && git push`,
			`${CANONICAL_BINARY_LAUNCH}; git commit -m unsafe`,
			`${CANONICAL_BINARY_LAUNCH} | tee /tmp/result`,
			`${CANONICAL_BINARY_LAUNCH} > /tmp/result`,
			`${CANONICAL_BINARY_LAUNCH} &`,
			`${CANONICAL_BINARY_LAUNCH} --repository "$(git rev-parse --show-toplevel)"`,
			`${CANONICAL_BINARY_LAUNCH} --repository \`pwd\``,
			`${CANONICAL_BINARY_LAUNCH} --repository <(pwd)`,
		]) {
			assert.strictEqual(recognizeGitCommitsPushCommand(command), null, command);
		}
	});
});

describe("shared launch recognition consumers", () => {
	test("keeps boolean and intent wrappers aligned with binary launches", () => {
		const targetedLaunch = `${CANONICAL_BINARY_LAUNCH} --repository /tmp/repo --push-remote origin --push-ref refs/heads/main`;
		for (const command of [CANONICAL_BINARY_LAUNCH, targetedLaunch]) {
			assert.strictEqual(isGitCommitsPushSkillCommand(command), true);
			assert.strictEqual(detectCommitIntent(command), "git-commits-push");
		}
		assert.strictEqual(isGitCommitsPushSkillCommand("/git-commits-push"), false);
	});

	test("allows targeted binary arguments and blocks slash-form shell calls", () => {
		const targetedLaunch = `${CANONICAL_BINARY_LAUNCH} --repository /tmp/repo --push-remote origin --push-ref refs/heads/main`;
		const launchResult = evaluateEnforcement({
			command: targetedLaunch,
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(launchResult.action, "allow");
		assert.strictEqual(launchResult.detectedBy, "git-commits-push");

		const slashResult = evaluateEnforcement({
			command: "/git-commits-push --repository /tmp/repo --push-remote origin --push-ref refs/heads/main",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(slashResult.action, "block");
		assert.match(slashResult.deniedReason ?? "", /\$HOME\/\.local\/bin\/git-commits-push/);
	});

	test("blocks unsafe or noncanonical launch attempts", () => {
		for (const command of [
			"git-commits-push --force",
			"$HOME/.local/bin/git-commits-push",
			`${CANONICAL_BINARY_LAUNCH} --repository "$(git push)"`,
		]) {
			const result = evaluateEnforcement({
				command,
				legacyBypassSet: false,
				trustedSkillMarkerSet: false,
			});
			assert.strictEqual(result.action, "block", command);
			assert.strictEqual(result.detectedBy, "git-commits-push", command);
		}
	});

	test("blocks an appended raw mutation", () => {
		const appendedMutationResult = evaluateEnforcement({
			command: `${CANONICAL_BINARY_LAUNCH} && git push`,
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(appendedMutationResult.action, "block");
		assert.strictEqual(appendedMutationResult.mutation, "push");
	});
});
