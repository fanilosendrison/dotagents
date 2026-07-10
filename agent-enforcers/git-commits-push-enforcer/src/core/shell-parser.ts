export type RawGitMutation = "commit" | "commit-tree" | "push";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════════════════
// Shell command parser (handles env prefixes, sudo, shell -c, etc.)
// ═══════════════════════════════════════════════════════════════════════════

export function splitShellSegments(command: string): string[] {
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

export function tokenizeShellSegment(segment: string): string[] {
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
