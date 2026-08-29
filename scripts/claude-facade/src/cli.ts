#!/usr/bin/env node

/**
 * Claude Code Facade Installer CLI
 *
 * Usage:
 *   node ~/.agents/scripts/claude-facade/src/cli.ts install [--repair] [--agents-root=<path>] [--claude-root=<path>]
 *   node ~/.agents/scripts/claude-facade/src/cli.ts check    [--agents-root=<path>] [--claude-root=<path>]
 *   node ~/.agents/scripts/claude-facade/src/cli.ts gitignore-rules
 */

import { checkAll, generateGitignoreRules, installAll } from "./facade.ts";

function parseArgs(args: string[]): {
	command: "install" | "check" | "gitignore-rules";
	repair: boolean;
	agentsRoot?: string;
	claudeRoot?: string;
} {
	let command: "install" | "check" | "gitignore-rules" | null = null;
	let repair = false;
	let agentsRoot: string | undefined;
	let claudeRoot: string | undefined;

	for (const arg of args) {
		if (arg === "install") command = "install";
		else if (arg === "check") command = "check";
		else if (arg === "gitignore-rules") command = "gitignore-rules";
		else if (arg === "--repair") repair = true;
		else if (arg.startsWith("--agents-root="))
			agentsRoot = arg.slice("--agents-root=".length);
		else if (arg.startsWith("--claude-root="))
			claudeRoot = arg.slice("--claude-root=".length);
	}

	if (!command) {
		console.error(
			"Usage: cli.ts <install|check|gitignore-rules> [--repair] [--agents-root=<path>] [--claude-root=<path>]",
		);
		process.exit(2);
	}

	return { command, repair, agentsRoot, claudeRoot };
}

function main() {
	const { command, repair, agentsRoot, claudeRoot } = parseArgs(
		process.argv.slice(2),
	);

	switch (command) {
		case "install": {
			const mode = repair ? "repair" : "install";
			console.log(`=== Claude Facade: ${mode} ===`);
			const report = installAll(agentsRoot, claudeRoot, mode);

			for (const r of report.results) {
				const marker = r.status === "OK" ? "✅" : "❌";
				const detail = r.detail ? ` — ${r.detail}` : "";
				console.log(`${marker} ${r.entry.destination}${detail}`);
			}

			console.log(
				`\n${report.okCount}/${report.results.length} OK, ${report.failCount} failed`,
			);
			process.exit(report.overallOk ? 0 : 1);
			return;
		}

		case "check": {
			console.log("=== Claude Facade: check ===");
			const report = checkAll(agentsRoot, claudeRoot);

			for (const r of report.results) {
				const marker = r.status === "OK" ? "✅" : "❌";
				const detail = r.detail ? ` — ${r.detail}` : "";
				console.log(`${marker} [${r.status}] ${r.entry.destination}${detail}`);
			}

			console.log(
				`\n${report.okCount}/${report.results.length} OK, ${report.failCount} failed`,
			);
			process.exit(report.failCount === 0 ? 0 : 1);
			return;
		}

		case "gitignore-rules": {
			const rules = generateGitignoreRules();
			for (const line of rules) {
				console.log(line);
			}
			process.exit(0);
		}
	}
}

main();
