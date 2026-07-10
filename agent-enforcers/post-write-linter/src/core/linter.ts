import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

export interface LintResult {
	success: boolean;
	output?: string;
}

export function checkFile(file: string): LintResult {
	if (!existsSync(file)) {
		return { success: true };
	}

	if (!file.match(/\.(ts|tsx|js|jsx|json)$/)) {
		return { success: true };
	}

	try {
		execSync(`"${process.execPath}" x @biomejs/biome format --write "${file}"`, {
			encoding: "utf-8",
			stdio: "pipe",
		});
		return { success: true };
	} catch (error: any) {
		const output = error.stdout || error.stderr || error.message;
		return { success: false, output };
	}
}
