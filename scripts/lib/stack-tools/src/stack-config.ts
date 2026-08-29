import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseYaml } from "../../../../packages/node-runtime/src/index.ts";

const STACK_EVAL_FILENAME = "STACK_EVAL.yaml";

/** Walk up from filePath to find STACK_EVAL.yaml. Returns path or null. */
export function findStackEval(filePath: string): string | null {
	let dir = dirname(filePath);
	const root = "/";

	while (true) {
		const candidate = join(dir, STACK_EVAL_FILENAME);
		if (existsSync(candidate)) return candidate;

		const parent = dirname(dir);
		if (parent === dir || dir === root) return null;
		dir = parent;
	}
}

export interface StackConfig {
	linter: string | null;
	typeChecker: string | null;
}

/** Parse STACK_EVAL.yaml and extract linter + type_checker. "none" → null. */
export async function readStackConfig(
	stackEvalPath: string,
): Promise<StackConfig> {
	const content = await readFile(stackEvalPath, "utf8");
	const parsed = parseYaml(content);
	const decisions =
		isRecord(parsed) && isRecord(parsed.decisions) ? parsed.decisions : {};

	const rawLinter = decisions.linter ?? null;
	const rawTypeChecker = decisions.type_checker ?? null;

	return {
		linter: normalizeValue(rawLinter),
		typeChecker: normalizeValue(rawTypeChecker),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize: "none" and empty strings → null, otherwise lowercase trimmed. */
function normalizeValue(value: unknown): string | null {
	if (value == null) return null;
	const str = String(value).trim().toLowerCase();
	if (str === "" || str === "none") return null;
	return str;
}
