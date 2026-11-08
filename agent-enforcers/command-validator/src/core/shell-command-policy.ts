import { LangVariant, parseSync, walk, type Node, type Word, type WordPart } from "sh-syntax";

const FORBIDDEN_COMMANDS = new Set(["rm", "dd"]);
const SHELLS = new Set(["bash", "sh", "dash", "zsh", "ksh", "ash", "mksh"]);
const SUPPORTED_SHELLS = new Set(["bash", "sh", "dash"]);
const MAX_NESTED_SOURCE_DEPTH = 16;

/** Decode only static AST words; expansion is never executed to discover a name. */
function literalPart(part: WordPart, doubleQuoted = false): string | null {
	if (part.type === "Lit") {
		if (!doubleQuoted && /[*?\[~{}]/.test(part.value)) return null;
		return doubleQuoted
			? part.value.replace(/\\\n/g, "").replace(/\\([\$`"\\])/g, "$1")
			: part.value.replace(/\\\n/g, "").replace(/\\(.)/gs, "$1");
	}
	if (part.type === "SglQuoted" && !part.dollar) return part.value;
	if (part.type === "DblQuoted" && !part.dollar) {
		const parts = part.parts.map(child => literalPart(child, true));
		return parts.includes(null) ? null : parts.join("");
	}
	return null;
}

function literalWord(word: Word): string | null {
	const parts = word.parts.map(part => literalPart(part));
	return parts.includes(null) ? null : parts.join("");
}

function isShellAssignment(value: string | null | undefined): boolean {
	return value != null && /^[A-Za-z_][A-Za-z0-9_]*=/.test(value);
}

function inspectArguments(words: Word[], depth: number, insideSubstitution: boolean): string | null {
	if (words.length === 0) return null; // Assignment-only command.
	const values = words.map(literalWord);
	let index = 0;
	for (;;) {
		const value = values[index];
		if (value === null || value === undefined || value === "") {
			return "Unresolved executable while inspecting shell substitutions";
		}
		const name = value.split("/").at(-1)!.toLowerCase();
		if (insideSubstitution && FORBIDDEN_COMMANDS.has(name)) {
			return `Forbidden command in command substitution: ${name}`;
		}

		if (name === "builtin") {
			index++;
			if (values[index]?.startsWith("-")) return "Unresolved builtin dispatcher options";
			continue;
		}
		if (name === "command") {
			index++;
			while (values[index]?.startsWith("-")) {
				if (values[index] === "-v" || values[index] === "-V") return null;
				if (values[index] !== "-p" && values[index] !== "--") {
					return "Unresolved command wrapper in command substitution";
				}
				index++;
			}
			continue;
		}
		if (name === "env") {
			index++;
			while (index < values.length) {
				const argument = values[index];
				if (argument === null) return "Unresolved env wrapper in command substitution";
				if (isShellAssignment(argument)) {
					index++;
				} else if (["-u", "--unset", "-C", "--chdir"].includes(argument!)) {
					if (values[index + 1] == null) return "Unresolved env option in command substitution";
					index += 2;
				} else if (argument === "-S" || argument === "--split-string") {
					// env splitting is not Bash parsing; do not concatenate argv into code.
					return "Unsupported env split-string semantics";
				} else if (argument!.startsWith("--unset=") || argument!.startsWith("--chdir=") ||
					argument === "-i" || argument === "--ignore-environment" || argument === "--") {
					index++;
				} else if (argument!.startsWith("-")) {
					return "Unresolved env option in command substitution";
				} else break;
			}
			if (index === values.length) return null;
			continue;
		}
		if (name === "exec" || name === "nohup" || name === "sudo") {
			index++;
			while (values[index]?.startsWith("-")) {
				const option = values[index++]!;
				if (["-a", "-u", "-g", "-h", "-p", "-C", "-T", "-R", "-D"].includes(option)) {
					if (values[index] == null) return "Unresolved wrapper option in command substitution";
					index++;
				} else if (!["--", "-c", "-l", "-n", "-E", "-H"].includes(option)) {
					return "Unresolved execution wrapper in command substitution";
				}
			}
			if (name === "sudo") {
				while (isShellAssignment(values[index])) index++;
			}
			continue;
		}
		if (name === "busybox" || name === "toybox") {
			index++;
			continue;
		}
		if (name === "eval") {
			const source = values.slice(index + 1);
			if (source[0] === "--") source.shift();
			return source.includes(null)
				? "Unresolved eval source in shell command"
				: inspectSource(source.join(" "), depth + 1, insideSubstitution);
		}
		if (SHELLS.has(name)) {
			if (!SUPPORTED_SHELLS.has(name)) return "Unsupported executed shell dialect";
			const options = values.slice(index + 1);
			// Bash continues option processing after -c. Do not mistake -- or
			// another flag for its source: unsupported option layouts fail closed.
			if (!["-c", "-lc", "-cl"].includes(options[0] ?? "") ||
				options[1] == null || /^[-+]/.test(options[1])) {
				return "Unresolved shell source or options in shell command";
			}
			return inspectSource(options[1], depth + 1, insideSubstitution);
		}
		return null;
	}
}

function inspectNodes(root: Node, depth: number, insideSubstitution: boolean): string | null {
	let reason: string | null = null;
	walk(root, node => {
		if (reason !== null) return false;
		if (node.type === "CmdSubst" && !insideSubstitution) {
			reason = inspectNodes(node, depth, true);
			return false;
		}
		if (node.type === "CallExpr") {
			reason = inspectArguments(node.args, depth, insideSubstitution);
		}
		return reason === null;
	});
	return reason;
}

function inspectSource(source: string, depth: number, insideSubstitution: boolean): string | null {
	if (depth > MAX_NESTED_SOURCE_DEPTH) return "Command substitution source nesting exceeds policy limit";
	try {
		return inspectNodes(parseSync(source, { variant: LangVariant.LangBash }), depth, insideSubstitution);
	} catch {
		return "Unable to parse command substitution source";
	}
}

/** Find high-risk executable names, not matching text in arguments or closing quotes. */
export function dangerousShellCommand(source: string, names: readonly string[]): string | null {
	const candidates = new Set(names);
	try {
		let found: string | null = null;
		walk(parseSync(source, { variant: LangVariant.LangBash }), node => {
			if (found !== null) return false;
			if (node.type === "CallExpr" && node.args[0]) {
				const word = literalWord(node.args[0]);
				const name = word?.split("/").at(-1)?.toLowerCase();
				if (name && candidates.has(name)) found = name;
			}
			return found === null;
		});
		return found;
	} catch {
		// Never upgrade an unparseable candidate to an allowed command.
		return names.find(name => new RegExp(`\\b${name}\\b`, "i").test(source)) ?? null;
	}
}

/** Policy only: the maintained parser owns Bash grammar and substitution boundaries. */
export function commandSubstitutionViolation(source: string): string | null {
	if (!source.includes("$(") && !source.includes("`")) return null;
	return inspectSource(source, 0, false);
}
