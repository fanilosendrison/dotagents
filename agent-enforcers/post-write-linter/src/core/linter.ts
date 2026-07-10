import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

export interface LintResult {
	success: boolean;
	output?: string;
}

/** Resolve the biome binary path. Returns null if not available. */
function resolveBiomeBinary(): string | null {
	// Try local node_modules first (fast, no download).
	const candidates = [
		"node_modules/.bin/biome",
		"node_modules/@biomejs/biome/bin/biome",
	];
	for (const rel of candidates) {
		if (existsSync(rel)) return rel;
	}

	// Try global / PATH.
	try {
		return execSync("which biome", {
			encoding: "utf-8",
			stdio: "pipe",
		}).trim() || null;
	} catch {
		return null;
	}
}

export function checkFile(file: string): LintResult {
	if (!existsSync(file)) {
		return { success: true };
	}

	if (!file.match(/\.(ts|tsx|js|jsx|json)$/)) {
		return { success: true };
	}

	const biomeBin = resolveBiomeBinary();
	if (!biomeBin) {
		// Biome not installed — skip silently, no lint errors.
		return { success: true };
	}

	try {
		execSync(`"${biomeBin}" format --write "${file}"`, {
			encoding: "utf-8",
			stdio: "pipe",
		});
		return { success: true };
	} catch (error: any) {
		const output = error.stdout || error.stderr || error.message;
		return { success: false, output };
	}
}
