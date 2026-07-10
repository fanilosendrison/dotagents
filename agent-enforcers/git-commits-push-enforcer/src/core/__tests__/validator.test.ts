import { describe, expect, test } from "bun:test";
import {
	detectRawGitMutation,
	detectCommitIntent,
	isGitCommitsPushSkillCommand,
	evaluateEnforcement,
	buildDirectGitDeniedReason,
	TRUSTED_MARKER_ENV,
	TRUSTED_MARKER_VALUE,
	// Legacy
	isGitCommit,
	extractMessage,
	isValidCC,
	hasPush,
} from "../validator";

// ═══════════════════════════════════════════════════════════════════════════
// Legacy utilities
// ═══════════════════════════════════════════════════════════════════════════

describe("legacy utilities", () => {
	test("isGitCommit detects git commit", () => {
		expect(isGitCommit("git commit -m 'msg'")).toBe(true);
		expect(isGitCommit("git push")).toBe(false);
	});

	test("extractMessage from double quotes", () => {
		expect(extractMessage('git commit -m "feat(api): add route"')).toBe(
			"feat(api): add route",
		);
	});

	test("extractMessage from single quotes", () => {
		expect(extractMessage("git commit -m 'fix(ui): button'")).toBe(
			"fix(ui): button",
		);
	});

	test("extractMessage from heredoc", () => {
		const cmd = `git commit -m <<'EOF'
feat(core): something
details
EOF`;
		expect(extractMessage(cmd)).toBe("feat(core): something");
	});

	test("extractMessage returns null when no -m", () => {
		expect(extractMessage("git commit")).toBeNull();
	});

	test("isValidCC accepts valid CC messages", () => {
		expect(isValidCC("feat(scope): add endpoint")).toBe(true);
		expect(isValidCC("fix: repair")).toBe(true);
	});

	test("isValidCC rejects invalid CC messages", () => {
		expect(isValidCC("WIP: something")).toBe(false);
		expect(isValidCC("feat: ")).toBe(false);
	});

	test("hasPush detects git push", () => {
		expect(hasPush("git commit -m '...' && git push")).toBe(true);
		expect(hasPush("git commit")).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// isGitCommitsPushSkillCommand
// ═══════════════════════════════════════════════════════════════════════════

describe("isGitCommitsPushSkillCommand", () => {
	test("detects /git-commits-push prefix", () => {
		expect(isGitCommitsPushSkillCommand("/git-commits-push")).toBe(true);
	});

	test("detects /git-commits-push with args", () => {
		expect(isGitCommitsPushSkillCommand("/git-commits-push --force")).toBe(true);
	});

	test("detects skill launch path", () => {
		expect(
			isGitCommitsPushSkillCommand(
				"cd /Users/me/.agents/skills/git-commits-push && bun run start",
			),
		).toBe(true);
	});

	test("rejects unrelated commands", () => {
		expect(isGitCommitsPushSkillCommand("git commit -m 'test'")).toBe(false);
		expect(isGitCommitsPushSkillCommand("ls -la")).toBe(false);
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// detectRawGitMutation
// ═══════════════════════════════════════════════════════════════════════════

describe("detectRawGitMutation", () => {
	// Basic detection
	test("detects git commit", () => {
		expect(detectRawGitMutation("git commit -m 'msg'")).toBe("commit");
	});

	test("detects git commit-tree", () => {
		expect(detectRawGitMutation("git commit-tree abc123")).toBe("commit-tree");
	});

	test("detects git push", () => {
		expect(detectRawGitMutation("git push origin main")).toBe("push");
	});

	test("detects git push --force", () => {
		expect(detectRawGitMutation("git push --force")).toBe("push");
	});

	test("returns null for non-mutation commands", () => {
		expect(detectRawGitMutation("git status")).toBeNull();
		expect(detectRawGitMutation("git diff")).toBeNull();
		expect(detectRawGitMutation("ls -la")).toBeNull();
	});

	// Git options before the subcommand
	test("skips git -C before subcommand", () => {
		expect(detectRawGitMutation("git -C /tmp commit -m 'x'")).toBe("commit");
	});

	test("skips git -c before subcommand", () => {
		expect(
			detectRawGitMutation("git -c user.name=Bot commit -m 'x'"),
		).toBe("commit");
	});

	test("skips multiple git options", () => {
		expect(
			detectRawGitMutation("git -C /tmp -c user.name=Bot commit -m 'x'"),
		).toBe("commit");
	});

	// Env prefix obfuscation
	test("detects env-prefixed git commit", () => {
		expect(detectRawGitMutation("GIT_AUTHOR_NAME=Bot git commit -m 'x'")).toBe(
			"commit",
		);
	});

	test("detects env-prefixed git push", () => {
		expect(
			detectRawGitMutation("GIT_SSH_COMMAND=ssh git push origin main"),
		).toBe("push");
	});

	test("detects multiple env vars before git", () => {
		expect(
			detectRawGitMutation(
				"GIT_AUTHOR_NAME=Bot GIT_AUTHOR_EMAIL=b@t.com git commit -m 'x'",
			),
		).toBe("commit");
	});

	// Shell -c obfuscation
	test("detects git commit through bash -c", () => {
		expect(
			detectRawGitMutation("bash -c 'git commit -m test'"),
		).toBe("commit");
	});

	test("detects git push through sh -c", () => {
		expect(
			detectRawGitMutation("sh -c 'git push origin main'"),
		).toBe("push");
	});

	test("detects git commit through zsh -c", () => {
		expect(
			detectRawGitMutation("zsh -c 'git commit -m msg'"),
		).toBe("commit");
	});

	// Sudo obfuscation
	test("detects git commit through sudo", () => {
		expect(detectRawGitMutation("sudo git commit -m 'x'")).toBe("commit");
	});

	test("detects git push through sudo", () => {
		expect(detectRawGitMutation("sudo git push origin main")).toBe("push");
	});

	// Env with -S (split) flag
	test("detects git commit through env -S", () => {
		expect(
			detectRawGitMutation("env -S 'git commit -m test'"),
		).toBe("commit");
	});

	// Command chaining
	test("detects git commit in chained commands", () => {
		expect(
			detectRawGitMutation("echo hello && git commit -m 'x'"),
		).toBe("commit");
	});

	test("detects git push after semicolon", () => {
		expect(
			detectRawGitMutation("cd /tmp; git push origin main"),
		).toBe("push");
	});

	// env command prefix
	test("detects git commit through env command", () => {
		expect(
			detectRawGitMutation("env VAR=1 git commit -m 'x'"),
		).toBe("commit");
	});

	// BYPASS_GIT_ENFORCER=1 env prefix — should still be detected
	test("detects BYPASS_GIT_ENFORCER env-prefixed commit", () => {
		expect(
			detectRawGitMutation("BYPASS_GIT_ENFORCER=1 git commit -m 'x'"),
		).toBe("commit");
	});

	// nohup, command, exec wrappers
	test("detects git commit through nohup", () => {
		expect(detectRawGitMutation("nohup git commit -m 'x'")).toBe("commit");
	});

	test("detects git commit through command wrapper", () => {
		expect(detectRawGitMutation("command git commit -m 'x'")).toBe("commit");
	});

	test("detects git commit through exec wrapper", () => {
		expect(detectRawGitMutation("exec git commit -m 'x'")).toBe("commit");
	});

	// Complex env with shell
	test("detects env-prefix + bash -c combo", () => {
		expect(
			detectRawGitMutation("VAR=x bash -c 'git commit -m test'"),
		).toBe("commit");
	});

	// Edge cases
	test("returns null for git without subcommand", () => {
		expect(detectRawGitMutation("git")).toBeNull();
	});

	test("returns null for non-git command containing git word", () => {
		expect(detectRawGitMutation("echo 'use git commit to save'")).toBeNull();
	});

	test("returns null for empty string", () => {
		expect(detectRawGitMutation("")).toBeNull();
	});

	// commit-tree with options
	test("detects git commit-tree with options", () => {
		expect(
			detectRawGitMutation("git commit-tree -p HEAD abc123"),
		).toBe("commit-tree");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// detectCommitIntent
// ═══════════════════════════════════════════════════════════════════════════

describe("detectCommitIntent", () => {
	test("classifies raw git commit as git-commit", () => {
		expect(detectCommitIntent("git commit -m 'x'")).toBe("git-commit");
	});

	test("classifies raw git push as git-commit", () => {
		expect(detectCommitIntent("git push")).toBe("git-commit");
	});

	test("classifies skill invocation as git-commits-push", () => {
		expect(detectCommitIntent("/git-commits-push")).toBe("git-commits-push");
	});

	test("returns null for unrelated commands", () => {
		expect(detectCommitIntent("ls -la")).toBeNull();
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// evaluateEnforcement
// ═══════════════════════════════════════════════════════════════════════════

describe("evaluateEnforcement", () => {
	// Trusted skill marker
	test("allows when trusted skill marker is set", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: false,
			trustedSkillMarkerSet: true,
		});
		expect(result.action).toBe("allow");
		expect(result.eventType).toBe("enforcer_triggered");
		expect(result.detectedBy).toBe("git-commits-push");
	});

	// Skill invocations
	test("allows skill invocations", () => {
		const result = evaluateEnforcement({
			command: "/git-commits-push",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		expect(result.action).toBe("allow");
		expect(result.eventType).toBe("enforcer_triggered");
		expect(result.detectedBy).toBe("git-commits-push");
	});

	// Non-commit commands
	test("skips non-commit commands", () => {
		const result = evaluateEnforcement({
			command: "ls -la",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		expect(result.action).toBe("skip");
		expect(result.eventType).toBe("skipped");
		expect(result.skipReason).toBe("not-commit-intent");
	});

	// Direct raw git — block
	test("blocks direct git commit", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		expect(result.action).toBe("block");
		expect(result.eventType).toBe("blocked");
		expect(result.detectedBy).toBe("git-commit");
		expect(result.mutation).toBe("commit");
		expect(result.deniedReason).toContain("Direct git commits are blocked");
	});

	test("blocks direct git push", () => {
		const result = evaluateEnforcement({
			command: "git push origin main",
			legacyBypassSet: false,
			trustedSkillMarkerSet: false,
		});
		expect(result.action).toBe("block");
		expect(result.mutation).toBe("push");
	});

	// Legacy bypass — allow (Pi/Codex mode)
	test("skips with legacy bypass when allowed", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: true,
			trustedSkillMarkerSet: false,
			allowLegacyBypass: true,
		});
		expect(result.action).toBe("skip");
		expect(result.eventType).toBe("skipped");
		expect(result.skipReason).toBe("bypass-enforcer");
	});

	// Legacy bypass — block (Gravity mode)
	test("blocks legacy bypass when not allowed (Gravity mode)", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: true,
			trustedSkillMarkerSet: false,
			allowLegacyBypass: false,
		});
		expect(result.action).toBe("block");
		expect(result.eventType).toBe("blocked");
		expect(result.deniedReason).toContain("BYPASS_GIT_ENFORCER is deprecated");
	});

	// Env-prefix bypass attempt — still blocked (detected)
	test("blocks env-prefix bypass attempt with legacy bypass", () => {
		const result = evaluateEnforcement({
			command: "BYPASS_GIT_ENFORCER=1 git commit -m 'x'",
			legacyBypassSet: true,
			trustedSkillMarkerSet: false,
			allowLegacyBypass: false,
		});
		expect(result.action).toBe("block");
		expect(result.detectedBy).toBe("git-commit");
	});

	// Trusted marker overrides everything
	test("trusted marker overrides legacy bypass block", () => {
		const result = evaluateEnforcement({
			command: "git commit -m 'x'",
			legacyBypassSet: true,
			trustedSkillMarkerSet: true,
		});
		expect(result.action).toBe("allow");
	});
});

// ═══════════════════════════════════════════════════════════════════════════
// buildDirectGitDeniedReason
// ═══════════════════════════════════════════════════════════════════════════

describe("buildDirectGitDeniedReason", () => {
	test("includes the command in the reason", () => {
		const reason = buildDirectGitDeniedReason("git commit -m 'x'");
		expect(reason).toContain("Direct git commits are blocked");
		expect(reason).toContain('git commit -m \'x\'');
	});

	test("truncates long commands", () => {
		const longCmd = "git commit -m '" + "x".repeat(100) + "'";
		const reason = buildDirectGitDeniedReason(longCmd);
		expect(reason.length).toBeLessThan(longCmd.length + 100);
		expect(reason).toContain("...");
	});
});
