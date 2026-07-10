/**
 * Shared core for git-commits-push enforcement.
 *
 * All three harnesses (Pi, Codex, Antigravity) import from this single source
 * of truth. The robust shell-command parser handles obfuscation techniques
 * like env prefixes, sudo wrappers, and shell -c indirection.
 *
 * Trust tokens are managed by the sibling trust-store.ts module.
 *
 * Exports:
 *   - detectRawGitMutation(command)      — does the command mutate via raw git?
 *   - isGitCommitsPushSkillCommand(cmd)  — is it a /git-commits-push skill invocation?
 *   - detectCommitIntent(command)        — combined detection with classification
 *   - evaluateEnforcement(input)         — full enforcement decision (action + telemetry hint)
 *   - buildDirectGitDeniedReason(cmd)    — human-readable block reason
 *
 * Legacy (kept for other enforcers e.g. commit-msg-validator):
 *   - isGitCommit, extractMessage, isValidCC, hasPush
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type CommitIntentDetection = "git-commit" | "git-commits-push";
export type RawGitMutation = "commit" | "commit-tree" | "push";

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
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const SKILL_CMD = /\/git-commits-push(?:\s|$)/;
const SKILL_LAUNCH_PATH = /\.agents\/skills\/git-commits-push(?:\s|\/|$)/;
const RAW_GIT_MUTATIONS = new Set(["commit", "commit-tree", "push"]);
const GIT_OPTIONS_WITH_VALUE = new Set([
	"-C",
	"-c",
	"--git-dir",
	"--work-tree",
	"--namespace",
	"--exec-path",
	"--config-env",
	"--super-prefix",
]);
const GIT_OPTIONS_WITH_EQUALS_VALUE = [
	"--git-dir=",
	"--work-tree=",
	"--namespace=",
	"--exec-path=",
	"--config-env=",
	"--super-prefix=",
];
const SHELL_COMMANDS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);

/** Env var names used across processes (re-exported from trust-store). */
export {
	TRUSTED_MARKER_ENV,
	TRUSTED_MARKER_VALUE,
	TRUSTED_TOKEN_ENV,
} from "./trust-store";

// ═══════════════════════════════════════════════════════════════════════════
// Public API — primary exports
// ═══════════════════════════════════════════════════════════════════════════

/** True when the command is a /git-commits-push skill invocation. */
export function isGitCommitsPushSkillCommand(cmd: string): boolean {
	return SKILL_CMD.test(cmd) || SKILL_LAUNCH_PATH.test(cmd);
}

/**
 * Detect whether a shell command performs a raw git mutation (commit,
 * commit-tree, or push). Handles env prefixes, sudo, shell -c, etc.
 */
export function detectRawGitMutation(command: string): RawGitMutation | null {
	for (const segment of splitShellSegments(command)) {
		const mutation = detectRawGitMutationInTokens(
			tokenizeShellSegment(segment),
		);
		if (mutation) return mutation;
	}
	return null;
}

/**
 * Classify a command as either a skill invocation or a raw git mutation.
 * Returns null when the command is unrelated to git-commits-push.
 */
export function detectCommitIntent(
	command: string,
): CommitIntentDetection | null {
	if (isGitCommitsPushSkillCommand(command)) return "git-commits-push";
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

	const mutation = detectRawGitMutation(command);

	// Skill invocation — log and allow.
	if (detectedBy === "git-commits-push") {
		return {
			action: "allow",
			detectedBy,
			mutation,
			eventType: "enforcer_triggered",
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
// Shell command parser (handles env prefixes, sudo, shell -c, etc.)
// ═══════════════════════════════════════════════════════════════════════════

function splitShellSegments(command: string): string[] {
	const segments: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;

	const pushCurrent = () => {
		const trimmed = current.trim();
		if (trimmed.length > 0) segments.push(trimmed);
		current = "";
	};

	for (let i = 0; i < command.length; i++) {
		const char = command[i]!;

		if (quote !== "'" && char === "\\") {
			current += char;
			if (command[i + 1] !== undefined) {
				current += command[i + 1]!;
				i++;
			}
			continue;
		}

		if (quote) {
			current += char;
			if (char === quote) quote = null;
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			current += char;
			continue;
		}

		if (char === "\n" || char === ";") {
			pushCurrent();
			continue;
		}

		if (
			(char === "&" && command[i + 1] === "&") ||
			(char === "|" && command[i + 1] === "|")
		) {
			pushCurrent();
			i++;
			continue;
		}

		if (char === "|") {
			pushCurrent();
			continue;
		}

		current += char;
	}

	pushCurrent();
	return segments;
}

function tokenizeShellSegment(segment: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let quote: "'" | '"' | null = null;

	const pushCurrent = () => {
		if (current.length > 0) {
			tokens.push(current);
			current = "";
		}
	};

	for (let i = 0; i < segment.length; i++) {
		const char = segment[i]!;

		if (quote !== "'" && char === "\\") {
			const next = segment[i + 1];
			if (next !== undefined) {
				current += next;
				i++;
			}
			continue;
		}

		if (quote) {
			if (char === quote) {
				quote = null;
			} else {
				current += char;
			}
			continue;
		}

		if (char === "'" || char === '"') {
			quote = char;
			continue;
		}

		if (/\s/.test(char)) {
			pushCurrent();
			continue;
		}

		current += char;
	}

	pushCurrent();
	return tokens;
}

function commandName(token: string): string {
	return token.split("/").pop() || token;
}

function isAssignmentToken(token: string): boolean {
	return /^[A-Za-z_][A-Za-z0-9_]*=/.test(token);
}

function skipSudoOptions(tokens: string[], index: number): number {
	let i = index;
	while (i < tokens.length && tokens[i]?.startsWith("-")) {
		const option = tokens[i];
		i++;
		if (option === "-u" || option === "-g" || option === "-h") {
			i++;
		}
	}
	return i;
}

interface EnvPrefixResult {
	index: number;
	nestedMutation?: RawGitMutation;
}

function skipEnvPrefix(tokens: string[], index: number): EnvPrefixResult {
	let i = index;
	while (i < tokens.length) {
		const token = tokens[i];
		if (!token) break;
		if (isAssignmentToken(token)) {
			i++;
			continue;
		}
		if (token === "-u" || token === "--unset") {
			i += 2;
			continue;
		}
		if (token === "-C" || token === "--chdir") {
			i += 2;
			continue;
		}
		if (token === "-S" && tokens[i + 1]) {
			const nestedMutation = detectRawGitMutation(tokens[i + 1]!);
			return nestedMutation
				? { index: tokens.length, nestedMutation }
				: { index: i + 2 };
		}
		if (token === "-i" || token === "--ignore-environment" || token === "-0") {
			i++;
			continue;
		}
		if (token.startsWith("-")) {
			i++;
			continue;
		}
		break;
	}
	return { index: i };
}

function mutationFromGitArguments(
	tokens: string[],
	gitIndex: number,
): RawGitMutation | null {
	for (let i = gitIndex + 1; i < tokens.length; i++) {
		const token = tokens[i];
		if (!token) continue;

		if (GIT_OPTIONS_WITH_VALUE.has(token)) {
			i++;
			continue;
		}

		if (
			GIT_OPTIONS_WITH_EQUALS_VALUE.some((option) => token.startsWith(option))
		) {
			continue;
		}

		if (token.startsWith("-")) {
			continue;
		}

		return RAW_GIT_MUTATIONS.has(token) ? (token as RawGitMutation) : null;
	}

	return null;
}

function detectRawGitMutationInTokens(tokens: string[]): RawGitMutation | null {
	let index = 0;
	while (index < tokens.length && isAssignmentToken(tokens[index] || "")) {
		index++;
	}

	for (;;) {
		const name = commandName(tokens[index] || "");
		if (name === "env") {
			const envResult = skipEnvPrefix(tokens, index + 1);
			if (envResult.nestedMutation) return envResult.nestedMutation;
			index = envResult.index;
			continue;
		}
		if (name === "sudo") {
			index = skipSudoOptions(tokens, index + 1);
			continue;
		}
		if (name === "command" || name === "exec" || name === "nohup") {
			index++;
			continue;
		}
		break;
	}

	const name = commandName(tokens[index] || "");
	if (
		SHELL_COMMANDS.has(name) &&
		tokens[index + 1] === "-c" &&
		tokens[index + 2]
	) {
		return detectRawGitMutation(tokens[index + 2]!);
	}

	if (name !== "git") {
		return null;
	}

	return mutationFromGitArguments(tokens, index);
}

// ═══════════════════════════════════════════════════════════════════════════
// Legacy utilities (kept for other enforcers like commit-msg-validator)
// ═══════════════════════════════════════════════════════════════════════════

const GIT_COMMIT = /git\s+commit\b/;
const CC_REGEX = /^[a-z]+(\([^)]+\))?!?:\s\S/;

/** Detect whether the raw shell command contains a git commit (simple regex). */
export function isGitCommit(command: string): boolean {
	return GIT_COMMIT.test(command);
}

/**
 * Extract the commit message from a raw git-commit command.
 * Supports: -m "...", -m '...', heredoc <<'EOF' ... EOF
 */
export function extractMessage(command: string): string | null {
	const heredoc = command.match(/<<'?EOF'?\s*\n([\s\S]*?)\n\s*EOF/);
	if (heredoc) {
		const lines = heredoc[1]!
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l);
		return lines[0] || null;
	}
	const dq = command.match(/-m\s+"([\s\S]*?)"/);
	if (dq) return dq[1]!.split("\n")[0]!.trim() || null;
	const sq = command.match(/-m\s+'([\s\S]*?)'/);
	if (sq) return sq[1]!.split("\n")[0]!.trim() || null;
	return null;
}

/** Check if a commit message follows Conventional Commits format. */
export function isValidCC(message: string): boolean {
	return CC_REGEX.test(message.trim());
}

/** Check if the raw command includes a git push instruction (simple regex). */
export function hasPush(command: string): boolean {
	return /git\s+push/.test(command);
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function truncateForReason(command: string): string {
	return command.length <= 80 ? command : `${command.slice(0, 80)}...`;
}
