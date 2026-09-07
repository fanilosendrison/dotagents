import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildDirectGitDeniedReason,
	detectCommitIntent,
	evaluateEnforcement,
	extractMessage,
	hasPush,
	isGitCommit,
	isGitCommitsPushSkillCommand,
	isValidCC,
	recognizeGitCommitsPushCommand,
} from "../validator.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Legacy utilities
// ═══════════════════════════════════════════════════════════════════════════

describe("legacy utilities", () => {
	test("isGitCommit detects git commit", () => {
		assert.strictEqual(isGitCommit("git commit -m 'msg'"), true);
		assert.strictEqual(isGitCommit("git push"), false);
	});

	test("extractMessage from double quotes", () => {
		assert.strictEqual(
			extractMessage('git commit -m "feat(api): add route"'),
			"feat(api): add route",
		);
	});

	test("extractMessage from single quotes", () => {
		assert.strictEqual(
			extractMessage("git commit -m 'fix(ui): button'"),
			"fix(ui): button",
		);
	});

	test("extractMessage from heredoc", () => {
		const cmd = `git commit -m <<'EOF'
feat(core): something
details
EOF`;
		assert.strictEqual(extractMessage(cmd), "feat(core): something");
	});

	test("extractMessage returns null when no -m", () => {
		assert.strictEqual(extractMessage("git commit"), null);
	});

	test("isValidCC accepts valid CC messages", () => {
		assert.strictEqual(isValidCC("feat(scope): add endpoint"), true);
		assert.strictEqual(isValidCC("fix: repair"), true);
	});

	test("isValidCC rejects invalid CC messages", () => {
		assert.strictEqual(isValidCC("WIP: something"), false);
		assert.strictEqual(isValidCC("feat: "), false);
	});

	test("hasPush detects git push", () => {
		assert.strictEqual(hasPush("git commit -m '...' && git push"), true);
		assert.strictEqual(hasPush("git commit"), false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// isGitCommitsPushSkillCommand
// ═══════════════════════════════════════════════════════════════════════════

describe("isGitCommitsPushSkillCommand", () => {
	test("detects /git-commits-push prefix", () => {
		assert.strictEqual(isGitCommitsPushSkillCommand("/git-commits-push"), true);
	});

	test("detects /git-commits-push with args", () => {
		assert.strictEqual(
			isGitCommitsPushSkillCommand("/git-commits-push --force"),
			true,
		);
	});

	test("accepts the canonical skill launch and rejects the retired launch", () => {
		const retiredLaunch =
			'cd "$HOME/.agents/skills/git-commits-push" && pnpm --silent run start';
		const canonicalLaunch =
			'cd "$HOME/Developper/Projects/git-commits-push" && pnpm --silent run start';
		assert.strictEqual(isGitCommitsPushSkillCommand(retiredLaunch), false);
		assert.strictEqual(recognizeGitCommitsPushCommand(retiredLaunch), null);
		assert.strictEqual(isGitCommitsPushSkillCommand(canonicalLaunch), true);
		assert.strictEqual(
			recognizeGitCommitsPushCommand(canonicalLaunch),
			"pnpm-launch",
		);
	});

	test("rejects unrelated commands", () => {
		assert.strictEqual(
			isGitCommitsPushSkillCommand("git commit -m 'test'"),
			false,
		);
		assert.strictEqual(isGitCommitsPushSkillCommand("ls -la"), false);
		assert.strictEqual(
			isGitCommitsPushSkillCommand(
				"cd ~/Developper/Projects/git-commits-push && pnpm run start",
			),
			false,
		);
		assert.strictEqual(
			isGitCommitsPushSkillCommand(
				"cd ~/.agents/skills/git-commits-push && pnpm --silent run start",
			),
			false,
		);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// detectCommitIntent
// ═══════════════════════════════════════════════════════════════════════════

describe("detectCommitIntent", () => {
	test("classifies raw git commit as git-commit", () => {
		assert.strictEqual(detectCommitIntent("git commit -m 'x'"), "git-commit");
	});

	test("classifies raw git push as git-commit", () => {
		assert.strictEqual(detectCommitIntent("git push"), "git-commit");
	});

	test("classifies skill invocation as git-commits-push", () => {
		assert.strictEqual(
			detectCommitIntent("/git-commits-push"),
			"git-commits-push",
		);
	});

	test("returns null for unrelated commands", () => {
		assert.strictEqual(detectCommitIntent("ls -la"), null);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// evaluateEnforcement
// ═══════════════════════════════════════════════════════════════════════════

describe("evaluateEnforcement", () => {
	// Trusted skill marker (with valid token)
	test("allows when trusted skill marker is set", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: false,
			trustedSkillMarkerSet: true,
			trustToken: "valid-token",
			validateToken: () => true,
		});
		assert.strictEqual(result.action, "allow");
		assert.strictEqual(result.eventType, "enforcer_triggered");
		assert.strictEqual(result.detectedBy, "git-commits-push");
	});

	// Forged marker (no valid token)
	test("blocks when trusted marker is set but no validateToken provided", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: false,
			trustedSkillMarkerSet: true,
		});
		assert.strictEqual(result.action, "block");
		assert.strictEqual(result.eventType, "blocked");
		assert.ok(result.deniedReason?.includes("Forged trusted marker"));
	});

	test("blocks when trusted marker is set but token is invalid", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: false,
			trustedSkillMarkerSet: true,
			trustToken: "bad-token",
			validateToken: () => false,
		});
		assert.strictEqual(result.action, "block");
		assert.ok(result.deniedReason?.includes("Forged trusted marker"));
	});

	// Skill invocations
	test("allows skill invocations", () => {
		const result = evaluateEnforcement({
			command: "/git-commits-push",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(result.action, "allow");
		assert.strictEqual(result.eventType, "enforcer_triggered");
		assert.strictEqual(result.detectedBy, "git-commits-push");
	});

	// Non-commit commands
	test("skips non-commit commands", () => {
		const result = evaluateEnforcement({
			command: "ls -la",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(result.action, "skip");
		assert.strictEqual(result.eventType, "skipped");
		assert.strictEqual(result.skipReason, "not-commit-intent");
	});

	// Direct raw git — block
	test("blocks direct git commit", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(result.action, "block");
		assert.strictEqual(result.eventType, "blocked");
		assert.strictEqual(result.detectedBy, "git-commit");
		assert.strictEqual(result.mutation, "commit");
		assert.ok(result.deniedReason?.includes("Direct git commits are blocked"));
	});

	test("blocks direct git push", () => {
		const result = evaluateEnforcement({
			command: "git push origin main",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		assert.strictEqual(result.action, "block");
		assert.strictEqual(result.mutation, "push");
	});

	// Legacy bypass — allow (Pi/Codex mode)
	test("skips with legacy bypass when allowed", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: true,
			trustedSkillMarkerSet: false,
			allowLegacyBypass: true,
		});
		assert.strictEqual(result.action, "skip");
		assert.strictEqual(result.eventType, "skipped");
		assert.strictEqual(result.skipReason, "bypass-enforcer");
	});

	// Legacy bypass — block (Gravity mode)
	test("blocks legacy bypass when not allowed (Gravity mode)", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: true,
			trustedSkillMarkerSet: false,
			allowLegacyBypass: false,
		});
		assert.strictEqual(result.action, "block");
		assert.strictEqual(result.eventType, "blocked");
		assert.ok(
			result.deniedReason?.includes("BYPASS_GIT_ENFORCER is deprecated"),
		);
	});

	// Env-prefix bypass attempt — still blocked (detected)
	test("blocks env-prefix bypass attempt with legacy bypass", () => {
		const result = evaluateEnforcement({
			command: "BYPASS_GIT_ENFORCER=1 git commit -m 'x'",
			legacyBypassSet: true,
			trustedSkillMarkerSet: false,
			allowLegacyBypass: false,
		});
		assert.strictEqual(result.action, "block");
		assert.strictEqual(result.detectedBy, "git-commit");
	});

	// Trusted marker overrides everything (with valid token)
	test("trusted marker overrides legacy bypass block", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: true,
			trustedSkillMarkerSet: true,
			trustToken: "tok",
			validateToken: () => true,
		});
		assert.strictEqual(result.action, "allow");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// buildDirectGitDeniedReason
// ═══════════════════════════════════════════════════════════════════════════

describe("buildDirectGitDeniedReason", () => {
	test("includes the command in the reason", () => {
		const reason = buildDirectGitDeniedReason("git commit -m 'x'");
		assert.ok(reason.includes("Direct git commits are blocked"));
		assert.ok(reason.includes("git commit -m 'x'"));
	});

	test("truncates long commands", () => {
		const longCmd = "git commit -m '" + "x".repeat(100) + "'";
		const reason = buildDirectGitDeniedReason(longCmd);
		assert.ok(reason.length < longCmd.length + 100);
		assert.ok(reason.includes("..."));
	});
});
