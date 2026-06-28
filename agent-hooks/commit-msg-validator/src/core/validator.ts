import type { ValidationResult } from "./types";

const VALID_TYPES = [
	"feat",
	"fix",
	"docs",
	"style",
	"refactor",
	"perf",
	"test",
	"build",
	"ci",
	"chore",
	"revert",
] as const;

// type(scope)!: description
const COMMIT_MSG_REGEX = /^(\w+)(?:\(([^)]+)\))?(!)?\s*:\s(.+)$/;

const PAST_TENSE_PATTERN =
	/^(added|fixed|removed|updated|changed|deleted|created|modified|moved|renamed|resolved|refactored|implemented|improved)\b/i;

const GERUND_PATTERN =
	/^(adding|fixing|removing|updating|changing|deleting|creating|modifying|moving|renaming|resolving|refactoring|implementing|improving)\b/i;

const VAGUE_DESCRIPTIONS = [
	"fix bug",
	"fix bugs",
	"bug fix",
	"bugfix",
	"updates",
	"update",
	"stuff",
	"things",
	"changes",
	"change",
	"wip",
	"temp",
	"misc",
	"minor",
];

export function isGitCommit(command: string): boolean {
	return /\bgit\s+commit\b/.test(command);
}

export function extractCommitMessage(command: string): string | null {
	const heredocMatch = command.match(/<<'?EOF'?\s*\n([\s\S]*?)\n\s*EOF/);
	if (heredocMatch) {
		const lines = heredocMatch[1]
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);
		return lines[0] || null;
	}

	const doubleQuoteMatch = command.match(/-m\s+"([\s\S]*?)"/);
	if (doubleQuoteMatch) {
		return doubleQuoteMatch[1].split("\n")[0].trim() || null;
	}

	const singleQuoteMatch = command.match(/-m\s+'([\s\S]*?)'/);
	if (singleQuoteMatch) {
		return singleQuoteMatch[1].split("\n")[0].trim() || null;
	}

	return null;
}

export function validateCommitMessage(message: string): ValidationResult {
	const trimmed = message.trim();
	if (!trimmed) {
		return { valid: false, errors: ["Message de commit vide"] };
	}

	const errors: string[] = [];

	const match = trimmed.match(COMMIT_MSG_REGEX);
	if (!match) {
		return {
			valid: false,
			errors: ["Format invalide. Attendu: <type>(<scope>): <description>"],
		};
	}

	const [, type, , , description] = match;

	if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
		errors.push(
			`Type "${type}" invalide. Types autorisés: ${VALID_TYPES.join(", ")}`,
		);
	}

	if (/^[A-Z]/.test(description)) {
		errors.push(
			"La description ne doit pas commencer par une majuscule après le deux-points",
		);
	}

	if (description.endsWith(".")) {
		errors.push("La description ne doit pas se terminer par un point");
	}

	if (trimmed.length > 72) {
		errors.push(`Subject line trop long: ${trimmed.length}/72 caractères max`);
	}

	if (PAST_TENSE_PATTERN.test(description)) {
		errors.push(
			"Utiliser l'impératif présent (add, fix, remove) — pas le passé (added, fixed, removed)",
		);
	}

	if (GERUND_PATTERN.test(description)) {
		errors.push(
			"Utiliser l'impératif présent (add, fix, remove) — pas le gérondif (adding, fixing, removing)",
		);
	}

	if (VAGUE_DESCRIPTIONS.includes(description.toLowerCase())) {
		errors.push(
			`Description trop vague: "${description}". Être spécifique sur ce qui a changé`,
		);
	}

	return { valid: errors.length === 0, errors };
}
