/**
 * Shared core for git-commits-push enforcement.
 *
 * All three harnesses (Pi, Codex, Antigravity) import from this single source
 * of truth. The robust shell-command parser handles obfuscation techniques
 * like env prefixes, sudo wrappers, and shell -c indirection.
 *
 * Trust tokens are provided by the versioned @git-commits-push/trust package.
 *
 * Exports:
 *   - detectRawGitMutation(command)      — does the command mutate via raw git?
 *   - recognizeGitCommitsPushCommand(cmd) — classify a canonical binary invocation
 *   - isGitCommitsPushSkillCommand(cmd)   — is it a recognized skill invocation?
 *   - detectCommitIntent(command)         — combined detection with classification
 *   - evaluateEnforcement(input)         — full enforcement decision (action + telemetry hint)
 *   - buildDirectGitDeniedReason(cmd)    — human-readable block reason
 *
 * Legacy (kept for other enforcers e.g. commit-msg-validator):
 *   - isGitCommit, extractMessage, isValidCC, hasPush
 */

import {
	detectRawGitMutation,
	type RawGitMutation,
	splitShellSegments,
	tokenizeShellSegment,
} from "./shell-parser.ts";
import { hasOnlyStaticShellArguments } from "./static-shell-arguments.ts";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type CommitIntentDetection = "git-commit" | "git-commits-push";
export type GitCommitsPushCommandRecognition = "binary-launch";
export type { RawGitMutation };

export interface EnforcementInput {
	/** The raw shell command to evaluate. */
	command: string;
	/** Whether the old BYPASS_GIT_ENFORCER=1 env var was set. */
	legacyBypassSet: boolean;
	/** Whether the trusted GIT_COMMITS_PUSH_ENFORCER_SOURCE=skill marker is present. */
	trustedSkillMarkerSet: boolean;
	/** The capability trust token (GIT_COMMITS_PUSH_ENFORCER_TOKEN). Only valid when trustedSkillMarkerSet is true. */
	trustToken?: string;
	/** Function to validate the trust token. Passed in so this module stays pure. */
	validateToken?: (token: string | undefined) => boolean;
	/**
	 * When true, legacy BYPASS_GIT_ENFORCER=1 is treated as a valid skip
	 * (transitional compatibility for Pi/Codex hooks).
	 * When false (Gravity), any attempt to use the legacy bypass is blocked.
	 */
	allowLegacyBypass?: boolean;
}

export interface EnforcementResult {
	/** What the enforcer should do. */
	action: "block" | "allow" | "skip";
	/** Human-readable block reason (present only when action === "block"). */
	deniedReason?: string;
	/** What mechanism detected the intent. */
	detectedBy: CommitIntentDetection | null;
	/** The specific git subcommand detected, if any. */
	mutation: RawGitMutation | null;
	/** Telemetry event type to emit. */
	eventType: "enforcer_triggered" | "blocked" | "skipped";
	/** Reason when eventType === "skipped". */
	skipReason?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants & Re-exports
// ═══════════════════════════════════════════════════════════════════════════

// Re-export Legacy APIs
export {
	extractMessage,
	hasPush,
	isGitCommit,
	isValidCC,
} from "./legacy-utils.ts";

// Re-export Shell Parser API
export { detectRawGitMutation } from "./shell-parser.ts";
/** Env var names used across processes (re-exported from the trust protocol). */
export {
	TRUSTED_MARKER_ENV,
	TRUSTED_MARKER_VALUE,
	TRUSTED_TOKEN_ENV,
} from "@git-commits-push/trust";

// ═══════════════════════════════════════════════════════════════════════════
// Public API — primary exports
// ═══════════════════════════════════════════════════════════════════════════

const CANONICAL_BINARY_LAUNCH = '"$HOME/.local/bin/git-commits-push"';

/**
 * Classify a complete canonical git-commits-push binary invocation.
 *
 * The stable executable may receive static CLI arguments. Shell wrappers,
 * operators, expansion, substitution, globbing, and redirection fail closed;
 * git-commits-push remains the sole authority for argument semantics.
 */
export function recognizeGitCommitsPushCommand(
	command: string,
): GitCommitsPushCommandRecognition | null {
	const trimmedCommand = command.trim();
	if (!trimmedCommand.startsWith(CANONICAL_BINARY_LAUNCH)) return null;

	const argumentText = trimmedCommand.slice(CANONICAL_BINARY_LAUNCH.length);
	if (argumentText.length > 0 && !/^\s/u.test(argumentText)) return null;
	return hasOnlyStaticShellArguments(argumentText) ? "binary-launch" : null;
}

/** True when the command is a recognized git-commits-push invocation. */
export function isGitCommitsPushSkillCommand(command: string): boolean {
	return recognizeGitCommitsPushCommand(command) !== null;
}

/**
 * Classify a command as either a skill invocation or a raw git mutation.
 * Returns null when the command is unrelated to git-commits-push.
 */
export function detectCommitIntent(
	command: string,
): CommitIntentDetection | null {
	if (
		isGitCommitsPushSkillCommand(command) ||
		isGitCommitsPushShellInvocationIntent(command)
	) {
		return "git-commits-push";
	}
	if (detectRawGitMutation(command)) return "git-commit";
	return null;
}

/**
 * Full enforcement decision — shared logic across all harnesses.
 *
 * Returns what action to take and what telemetry event to emit.
 * Each harness adapts the result to its own output format (Pi tool response,
 * Codex hook JSON, Gravity exit code).
 */
export function evaluateEnforcement(
	input: EnforcementInput,
): EnforcementResult {
	const { command, legacyBypassSet, trustedSkillMarkerSet, allowLegacyBypass } =
		input;

	// A trusted skill execution must carry a valid one-shot token.
	// Marker without valid token → forged attempt → block.
	if (trustedSkillMarkerSet) {
		const tokenValid = input.validateToken
			? input.validateToken(input.trustToken)
			: false;
		if (tokenValid) {
			return {
				action: "allow",
				detectedBy: "git-commits-push",
				mutation: null,
				eventType: "enforcer_triggered",
			};
		}
		return {
			action: "block",
			deniedReason:
				"Forged trusted marker detected (missing or invalid trust token). " +
				"Only the /git-commits-push skill can perform git mutations.",
			detectedBy: "git-commit",
			mutation: null,
			eventType: "blocked",
		};
	}

	const mutation = detectRawGitMutation(command);

	// A canonical installed binary invocation is logged and allowed.
	if (recognizeGitCommitsPushCommand(command) === "binary-launch") {
		return {
			action: "allow",
			detectedBy: "git-commits-push",
			mutation,
			eventType: "enforcer_triggered",
		};
	}

	if (isGitCommitsPushShellInvocationIntent(command)) {
		return {
			action: "block",
			deniedReason: [
				"Invalid git-commits-push shell launch.",
				`Run ${CANONICAL_BINARY_LAUNCH} with static arguments instead.`,
			].join("\n"),
			detectedBy: "git-commits-push",
			mutation,
			eventType: "blocked",
		};
	}

	// Not a commit-related command — skip.
	const detectedBy = detectCommitIntent(command);
	if (!detectedBy) {
		return {
			action: "skip",
			detectedBy: null,
			mutation: null,
			eventType: "skipped",
			skipReason: "not-commit-intent",
		};
	}

	// Legacy bypass handling.
	if (legacyBypassSet) {
		if (allowLegacyBypass) {
			return {
				action: "skip",
				detectedBy,
				mutation,
				eventType: "skipped",
				skipReason: "bypass-enforcer",
			};
		}
		// Gravity mode: legacy bypass attempts are blocked.
		return {
			action: "block",
			deniedReason:
				"BYPASS_GIT_ENFORCER is deprecated and blocked. " +
				"Use /git-commits-push in your AI agent instead.",
			detectedBy,
			mutation,
			eventType: "blocked",
		};
	}

	// Direct raw git mutation — block.
	return {
		action: "block",
		deniedReason: buildDirectGitDeniedReason(command),
		detectedBy,
		mutation,
		eventType: "blocked",
	};
}

/** Human-readable block reason. */
export function buildDirectGitDeniedReason(command: string): string {
	return [
		"Direct git commits are blocked. Use /git-commits-push instead.",
		"",
		`Got: "${truncateForReason(command)}"`,
	].join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function isGitCommitsPushShellInvocationIntent(command: string): boolean {
	const firstSegment = splitShellSegments(command)[0];
	if (firstSegment === undefined) return false;
	const executable = tokenizeShellSegment(firstSegment)[0] ?? "";
	return (
		executable === "/git-commits-push" ||
		executable === "git-commits-push" ||
		executable === "$HOME/.local/bin/git-commits-push" ||
		executable === "~/.local/bin/git-commits-push" ||
		executable.endsWith("/.local/bin/git-commits-push")
	);
}

function truncateForReason(command: string): string {
	return command.length <= 80 ? command : `${command.slice(0, 80)}...`;
}
