import { RESTRICTED_TOOLS } from "./tool-rules";
import type {
	ValidationAction,
	ValidationResult,
	ValidationSeverity,
} from "./types";

export type RuntimeValidationAction =
	| ValidationAction
	| "ask_approved"
	| "ask_rejected"
	| "override_approved";

export type RuntimeUserResponse = "yes" | "no";

export interface RuntimeValidationContext {
	rawCommand: unknown;
	toolName: string;
	parentModel: string;
	thinkingLevel: string;
}

export interface RuntimeValidationOverrides {
	action?: RuntimeValidationAction;
	override?: boolean;
	userResponse?: RuntimeUserResponse;
}

export interface RuntimeValidationDetails {
	[key: string]: unknown;
	rawCommand: string;
	action: RuntimeValidationAction;
	parentModel: string;
	thinkingLevel: string;
	toolName: string;
	severity: ValidationSeverity;
	reason?: string;
	override?: boolean;
	userResponse?: RuntimeUserResponse;
}

const RAW_COMMAND_LIMIT = 500;
const CONFIRMATION_COMMAND_LIMIT = 100;

export function shouldValidateRuntimeTool(
	toolName: string,
	isBashTool: boolean,
): boolean {
	return isBashTool || RESTRICTED_TOOLS.includes(toolName);
}

export function normalizeRawCommand(rawCommand: unknown): string {
	return typeof rawCommand === "string" ? rawCommand : "";
}

export function truncateRawCommand(rawCommand: string): string {
	if (rawCommand.length <= RAW_COMMAND_LIMIT) {
		return rawCommand;
	}

	return `${rawCommand.slice(0, RAW_COMMAND_LIMIT)}…`;
}

export function formatValidationReason(
	result: Pick<ValidationResult, "violations">,
	separator = "; ",
): string {
	return result.violations.join(separator);
}

export function createRuntimeValidationDetails(
	result: ValidationResult,
	context: RuntimeValidationContext,
	overrides: RuntimeValidationOverrides = {},
): RuntimeValidationDetails {
	const details: RuntimeValidationDetails = {
		rawCommand: truncateRawCommand(normalizeRawCommand(context.rawCommand)),
		action: overrides.action ?? result.action,
		parentModel: context.parentModel,
		thinkingLevel: context.thinkingLevel,
		toolName: context.toolName,
		severity: result.severity,
	};

	const reason = formatValidationReason(result);
	if (reason) {
		details.reason = reason;
	}

	if (overrides.override !== undefined) {
		details.override = overrides.override;
	}

	if (overrides.userResponse !== undefined) {
		details.userResponse = overrides.userResponse;
	}

	return details;
}

export function formatCodexDenyMessage(
	rawCommand: string,
	result: ValidationResult,
): string {
	return [
		"Command blocked!",
		"",
		`Command: ${rawCommand}`,
		`Reason: ${formatValidationReason(result, ", ")}`,
		`Severity: ${result.severity}`,
	].join("\n");
}

export function formatCodexPendingApprovalMessage(
	rawCommand: string,
	result: ValidationResult,
	token: string,
): string {
	return [
		"Potentially dangerous command blocked pending approval.",
		"",
		`Command: ${rawCommand}`,
		`Reason: ${formatValidationReason(result, ", ")}`,
		"Severity: HIGH",
		"",
		"To allow this command once, reply:",
		`allow-command ${token}`,
	].join("\n");
}

export function formatPiConfirmationMessage(rawCommand: string): string {
	return `Allow: ${rawCommand.slice(0, CONFIRMATION_COMMAND_LIMIT)}`;
}
