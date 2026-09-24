const UNSAFE_UNQUOTED_STATIC_ARGUMENT_CHARACTERS = new Set([
	";",
	"&",
	"|",
	"<",
	">",
	"(",
	")",
	"`",
	"#",
	"$",
	"{",
	"}",
	"*",
	"?",
	"[",
	"]",
	"~",
]);

/**
 * Return whether shell arguments contain only static words.
 *
 * Quoting and escaping are accepted, but shell control operators, expansions,
 * globbing, comments, substitutions, and unterminated words fail closed. This
 * parser intentionally owns shell safety only; the invoked CLI owns argument
 * semantics.
 */
export function hasOnlyStaticShellArguments(argumentText: string): boolean {
	let quote: "'" | '"' | null = null;

	for (let index = 0; index < argumentText.length; index++) {
		const character = argumentText[index]!;
		if (character === "\n" || character === "\r") return false;

		if (quote === "'") {
			if (character === "'") quote = null;
			continue;
		}

		if (quote === '"') {
			if (character === '"') {
				quote = null;
				continue;
			}
			if (character === "$" || character === "`") return false;
			if (character === "\\") {
				const next = argumentText[index + 1];
				if (next === undefined || next === "\n" || next === "\r") {
					return false;
				}
				index++;
			}
			continue;
		}

		if (character === "'" || character === '"') {
			quote = character;
			continue;
		}
		if (character === "\\") {
			const next = argumentText[index + 1];
			if (next === undefined || next === "\n" || next === "\r") return false;
			index++;
			continue;
		}
		if (UNSAFE_UNQUOTED_STATIC_ARGUMENT_CHARACTERS.has(character)) {
			return false;
		}
	}

	return quote === null;
}
