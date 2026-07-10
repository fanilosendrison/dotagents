import { describe, expect, test } from "bun:test";
import {
	createRuntimeValidationDetails,
	formatCodexDenyMessage,
	formatCodexPendingApprovalMessage,
	formatPiConfirmationMessage,
	formatValidationReason,
	shouldValidateRuntimeTool,
} from "../runtime-contract.ts";
import type { ValidationResult } from "../types.ts";

const deniedResult: ValidationResult = {
	isValid: false,
	severity: "CRITICAL",
	violations: ["first violation", "second violation"],
	sanitizedCommand: "",
	action: "deny",
};

describe("command-validator runtime contract", () => {
	test("detects bash and restricted tools as validation targets", () => {
		expect(shouldValidateRuntimeTool("Bash", true)).toBe(true);
		expect(shouldValidateRuntimeTool("write_to_file", false)).toBe(true);
		expect(shouldValidateRuntimeTool("ViewFile", false)).toBe(false);
	});

	test("builds normalized telemetry details", () => {
		const details = createRuntimeValidationDetails(deniedResult, {
			rawCommand: "x".repeat(600),
			toolName: "Bash",
			parentModel: "model",
			thinkingLevel: "high",
		});

		expect(details.rawCommand).toBe(`${"x".repeat(500)}…`);
		expect(details.action).toBe("deny");
		expect(details.parentModel).toBe("model");
		expect(details.thinkingLevel).toBe("high");
		expect(details.toolName).toBe("Bash");
		expect(details.severity).toBe("CRITICAL");
		expect(details.reason).toBe("first violation; second violation");
	});

	test("records normalized approval metadata", () => {
		const details = createRuntimeValidationDetails(
			deniedResult,
			{
				rawCommand: "sudo ls",
				toolName: "Bash",
				parentModel: "model",
				thinkingLevel: "high",
			},
			{
				action: "override_approved",
				override: true,
				userResponse: "yes",
			},
		);

		expect(details.action).toBe("override_approved");
		expect(details.override).toBe(true);
		expect(details.userResponse).toBe("yes");
	});

	test("formats shared reasons and runtime messages", () => {
		expect(formatValidationReason(deniedResult)).toBe(
			"first violation; second violation",
		);
		expect(formatValidationReason(deniedResult, ", ")).toBe(
			"first violation, second violation",
		);
		expect(formatPiConfirmationMessage("x".repeat(120))).toBe(
			`Allow: ${"x".repeat(100)}`,
		);
		expect(formatCodexDenyMessage("rm -rf /tmp/stuff", deniedResult)).toContain(
			"Severity: CRITICAL",
		);
		expect(
			formatCodexPendingApprovalMessage("sudo ls", deniedResult, "token"),
		).toContain("allow-command token");
	});
});
