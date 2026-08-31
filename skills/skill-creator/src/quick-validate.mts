import {
	existsSync,
	readdirSync,
	readFileSync,
	realpathSync,
	statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const TEMPLATE_MARKERS = [
	"[TODO: Complete and informative explanation",
	"[TODO: Choose the structure",
	"[TODO: 1-2 sentences explaining",
	"[TODO: Replace with the first main section",
	"[TODO: Add content here",
	'Delete this entire "Structuring This Skill" section',
];

const ALLOWED_PROPERTIES = new Set([
	"name",
	"description",
	"license",
	"allowed-tools",
	"metadata",
	"compatibility",
	"disable-model-invocation",
]);

export type ValidationResult = {
	errors: string[];
	warnings: string[];
};

function stripCodeBlocks(text: string): string {
	return text.replace(/```[\s\S]*?```/g, "");
}

function findFileReferences(body: string): Set<string> {
	const clean = stripCodeBlocks(body);
	const linkPattern = /\[[^\]]*\]\((scripts|references|assets)\/[\w._/-]+\)/g;
	const references = new Set<string>();

	for (const match of clean.matchAll(linkPattern)) {
		const url = match[0].slice(match[0].indexOf("(") + 1, -1);
		references.add(url);
	}
	return references;
}

function walkFiles(directory: string): string[] {
	const results: string[] = [];
	if (!existsSync(directory)) return results;

	for (const entry of readdirSync(directory)) {
		const fullPath = join(directory, entry);
		if (statSync(fullPath).isDirectory()) {
			results.push(...walkFiles(fullPath));
		} else {
			results.push(fullPath);
		}
	}
	return results;
}

export function validateSkillFull(skillPath: string): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const skillMarkdownPath = join(skillPath, "SKILL.md");

	if (!existsSync(skillMarkdownPath)) {
		return { errors: ["SKILL.md not found"], warnings: [] };
	}

	const content = readFileSync(skillMarkdownPath, "utf8");
	if (!content.startsWith("---")) {
		return { errors: ["No YAML frontmatter found"], warnings: [] };
	}

	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
	if (!frontmatterMatch) {
		return { errors: ["Invalid frontmatter format"], warnings: [] };
	}

	const frontmatterText = frontmatterMatch[1] ?? "";
	const body = content.slice(frontmatterMatch[0].length).trim();
	let frontmatter: Record<string, unknown>;

	try {
		const parsedFrontmatter = yaml.load(frontmatterText);
		if (
			!parsedFrontmatter ||
			typeof parsedFrontmatter !== "object" ||
			Array.isArray(parsedFrontmatter)
		) {
			return {
				errors: ["Frontmatter must be a YAML dictionary"],
				warnings: [],
			};
		}
		frontmatter = parsedFrontmatter as Record<string, unknown>;
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			errors: [`Invalid YAML in frontmatter: ${message}`],
			warnings: [],
		};
	}

	const unexpectedKeys = Object.keys(frontmatter).filter(
		(key) => !ALLOWED_PROPERTIES.has(key),
	);
	if (unexpectedKeys.length > 0) {
		errors.push(
			`Unexpected key(s) in frontmatter: ${unexpectedKeys.sort().join(", ")}. ` +
				`Allowed: ${[...ALLOWED_PROPERTIES].sort().join(", ")}`,
		);
	}

	const name = frontmatter.name;
	if (!name) {
		errors.push("Missing 'name' in frontmatter");
	} else if (typeof name !== "string") {
		errors.push(`Name must be a string, got ${typeof name}`);
	} else {
		const trimmedName = name.trim();
		if (!/^[a-z0-9-]+$/.test(trimmedName)) {
			errors.push(
				`Name '${trimmedName}' should be kebab-case (lowercase letters, digits, hyphens only)`,
			);
		}
		if (
			trimmedName.startsWith("-") ||
			trimmedName.endsWith("-") ||
			trimmedName.includes("--")
		) {
			errors.push(
				`Name '${trimmedName}' cannot start/end with hyphen or contain consecutive hyphens`,
			);
		}
		if (trimmedName.length > 64) {
			errors.push(`Name too long (${trimmedName.length} chars, max 64)`);
		}
	}

	const description = frontmatter.description;
	if (!description) {
		errors.push("Missing 'description' in frontmatter");
	} else if (typeof description !== "string") {
		errors.push(`Description must be a string, got ${typeof description}`);
	} else {
		const trimmedDescription = description.trim();
		if (trimmedDescription.includes("<") || trimmedDescription.includes(">")) {
			errors.push("Description cannot contain angle brackets (< or >)");
		}
		if (trimmedDescription.length > 1024) {
			errors.push(
				`Description too long (${trimmedDescription.length} chars, max 1024)`,
			);
		}
		if (trimmedDescription.includes("TODO")) {
			errors.push("Description contains TODO marker — must be completed");
		}
	}

	const compatibility = frontmatter.compatibility;
	if (compatibility) {
		if (typeof compatibility !== "string") {
			errors.push(
				`Compatibility must be a string, got ${typeof compatibility}`,
			);
		} else if (compatibility.length > 500) {
			errors.push(
				`Compatibility too long (${compatibility.length} chars, max 500)`,
			);
		}
	}

	const todoMatches = body.match(/\[TODO:.*?\]/g);
	if (todoMatches && todoMatches.length > 0) {
		errors.push(
			`Body contains ${todoMatches.length} TODO marker(s) — ` +
				`first: "${todoMatches[0]}"`,
		);
	}

	const templateHits = TEMPLATE_MARKERS.filter((marker) =>
		content.includes(marker),
	);
	if (templateHits.length > 0) {
		errors.push(
			`Uncustomized template content (${templateHits.length} marker(s)). ` +
				`First: "${templateHits[0]?.slice(0, 60)}"`,
		);
	}

	if (body.length < 50) {
		errors.push(`Body too short (${body.length} chars) — add real content`);
	}

	const referencedFiles = findFileReferences(body);
	for (const reference of [...referencedFiles].sort()) {
		if (!existsSync(join(skillPath, reference))) {
			warnings.push(`Referenced file not found: ${reference}`);
		}
	}

	for (const resourceDirectory of ["scripts", "references", "assets"]) {
		const directoryPath = join(skillPath, resourceDirectory);
		if (!existsSync(directoryPath)) continue;

		for (const filePath of walkFiles(directoryPath)) {
			const relativePath = relative(skillPath, filePath);
			if (!referencedFiles.has(relativePath)) {
				warnings.push(`Unreferenced file: ${relativePath}`);
			}
		}
	}

	return { errors, warnings };
}

function isMainModule(
	moduleUrl: string,
	argumentPath: string | undefined,
): boolean {
	if (!argumentPath) return false;
	try {
		return (
			realpathSync(fileURLToPath(moduleUrl)) ===
			realpathSync(resolve(argumentPath))
		);
	} catch {
		return false;
	}
}

export function runCli(args: string[]): number {
	if (args.length !== 1) {
		console.log("Usage: quick-validate <skill_directory>");
		return 1;
	}

	const skillPath = args[0];
	if (skillPath === undefined) {
		console.log("Usage: quick-validate <skill_directory>");
		return 1;
	}

	const { errors, warnings } = validateSkillFull(resolve(skillPath));
	for (const error of errors) {
		console.log(`  ✗ ${error}`);
	}
	for (const warning of warnings) {
		console.log(`  ⚠ ${warning}`);
	}

	if (errors.length > 0) {
		console.log(
			`\nFAIL — ${errors.length} error(s), ${warnings.length} warning(s)`,
		);
		return 1;
	}
	if (warnings.length > 0) {
		console.log(`\nPASS — 0 errors, ${warnings.length} warning(s)`);
		return 0;
	}

	console.log("\nPASS — all checks OK");
	return 0;
}

if (isMainModule(import.meta.url, process.argv[1])) {
	process.exitCode = runCli(process.argv.slice(2));
}
