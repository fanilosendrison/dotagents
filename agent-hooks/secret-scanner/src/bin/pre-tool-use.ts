#!/usr/bin/env bun

import { detectRuntime } from "../../../shared/runtime/detect-runtime";
import {
	getSessionId,
	getToolCommand,
	readHookInput,
} from "../../../shared/runtime/read-hook-input";
import {
	exitAllow,
	respondPreToolDecision,
	respondPreToolDeny,
} from "../../../shared/runtime/respond";
import { scanDiff } from "../core/scanner";
import type { Finding } from "../core/types";
import { recordCleanScan } from "../runtime/scan-state";

function isGitCommit(command: string): boolean {
	return /\bgit\s+commit\b/.test(command);
}

async function getStagedDiff(): Promise<string | null> {
	try {
		const proc = Bun.spawn(["git", "diff", "--cached", "--diff-filter=ACMR"], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const output = await new Response(proc.stdout).text();
		await proc.exited;
		return output;
	} catch {
		return null;
	}
}

async function main() {
	const input = await readHookInput();
	if (!input || input.tool_name !== "Bash") {
		process.exit(0);
	}

	const rawCommand = getToolCommand(input);
	const command = typeof rawCommand === "string" ? rawCommand : "";
	if (!command || !isGitCommit(command)) {
		process.exit(0);
	}

	const diff = await getStagedDiff();
	if (diff === null) {
		process.exit(0);
	}

	const result = scanDiff(diff);
	if (result.clean) {
		const additionalContext =
			"[secret-scanner] ✅ aucun secret détecté dans le diff staged";
		if (detectRuntime(input) === "claude") {
			respondPreToolDecision(
				"allow",
				"[secret-scanner] ✅ aucun secret dans le diff staged",
				additionalContext,
			);
		}

		await recordCleanScan(getSessionId(input), command);
		exitAllow();
	}

	respondPreToolDeny(formatSecretFindings(result.findings));
}

function formatSecretFindings(findings: Finding[]): string {
	return [
		"Secrets détectés dans les fichiers staged :",
		"",
		...findings.map(
			(finding) =>
				`  [${finding.name}] ligne ${finding.lineNumber}: ${finding.line.substring(0, 80)}`,
		),
		"",
		"Retirer les secrets du staging avant de committer.",
		"Utiliser .gitignore ou .env pour les données sensibles.",
	].join("\n");
}

main().catch((error) => {
	console.error("secret-scanner pre-tool-use error:", error);
	process.exit(2);
});
