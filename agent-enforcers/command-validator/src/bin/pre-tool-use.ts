#!/usr/bin/env bun

import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ValidationResult } from "../core/types";
import { CommandValidator } from "../core/validator";
import {
	createApprovalToken,
	consumeOverride,
} from "../runtime/override-store";
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

const LOG_FILE = join(import.meta.dir, "../../data/security.log");

async function logSecurityEvent(
	command: string,
	toolName: string,
	result: ValidationResult,
	sessionId: string,
	source: string,
	overrideAllowed = false,
) {
	const logEntry = {
		timestamp: new Date().toISOString(),
		sessionId,
		toolName,
		command: command.substring(0, 500),
		blocked: result.action !== "allow" && !overrideAllowed,
		severity: result.severity,
		violations: result.violations,
		action: overrideAllowed ? "allow" : result.action,
		source,
	};

	try {
		await mkdir(dirname(LOG_FILE), { recursive: true });
		await appendFile(LOG_FILE, `${JSON.stringify(logEntry)}\n`);
	} catch (error) {
		console.error("Failed to write security log:", error);
	}
}

async function main() {
	const input = await readHookInput();
	if (!input) {
		process.exit(0);
	}

	const runtime = detectRuntime(input);
	const validator = new CommandValidator();
	const toolName = input.tool_name || "Unknown";
	const sessionId = getSessionId(input);

	if (toolName !== "Bash") {
		process.exit(0);
	}

	const rawCommand = getToolCommand(input);
	const command = typeof rawCommand === "string" ? rawCommand : "";
	const result = validator.validate(rawCommand, toolName);

	if (
		runtime === "codex" &&
		result.action === "ask" &&
		typeof rawCommand === "string" &&
		(await consumeOverride(sessionId, rawCommand))
	) {
		await logSecurityEvent(
			command,
			toolName,
			result,
			sessionId,
			"codex-hook",
			true,
		);
		exitAllow();
	}

	await logSecurityEvent(command, toolName, result, sessionId, `${runtime}-hook`);

	if (result.action === "allow") {
		exitAllow();
	}

	if (runtime === "claude") {
		const message =
			result.action === "deny"
				? `Command blocked!\n\nCommand: ${command}\nReason: ${result.violations.join(", ")}\nSeverity: ${result.severity}`
				: `Potentially dangerous command\n\nCommand: ${command}\nReason: ${result.violations.join(", ")}\nSeverity: HIGH\n\nDo you want to proceed?`;
		respondPreToolDecision(result.action === "deny" ? "deny" : "ask", message);
	}

	if (result.action === "deny" || typeof rawCommand !== "string") {
		respondPreToolDeny(
			`Command blocked!\n\nCommand: ${command}\nReason: ${result.violations.join(", ")}\nSeverity: ${result.severity}`,
		);
	}

	const token = await createApprovalToken(sessionId, rawCommand);
	respondPreToolDeny(
		`Potentially dangerous command blocked pending approval.\n\nCommand: ${command}\nReason: ${result.violations.join(", ")}\nSeverity: HIGH\n\nTo allow this command once, reply:\nallow-command ${token}`,
	);
}

main().catch((error) => {
	console.error("Validation script error:", error);
	process.exit(2);
});
