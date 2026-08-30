import assert from "node:assert/strict";
import { describe, test } from "node:test";
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
		assert.strictEqual(shouldValidateRuntimeTool("Bash", true), true);
		assert.strictEqual(shouldValidateRuntimeTool("write_to_file", false), true);
		assert.strictEqual(shouldValidateRuntimeTool("ViewFile", false), false);
	});

	test("builds normalized telemetry details", () => {
		const details = createRuntimeValidationDetails(deniedResult, {
			rawCommand: "x".repeat(600),
			toolName: "Bash",
			parentModel: "model",
			thinkingLevel: "high",
		});

		assert.strictEqual(details.rawCommand, `${"x".repeat(500)}…`);
		assert.strictEqual(details.action, "deny");
		assert.strictEqual(details.parentModel, "model");
		assert.strictEqual(details.thinkingLevel, "high");
		assert.strictEqual(details.toolName, "Bash");
		assert.strictEqual(details.severity, "CRITICAL");
		assert.strictEqual(details.reason, "first violation; second violation");
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

		assert.strictEqual(details.action, "override_approved");
		assert.strictEqual(details.override, true);
		assert.strictEqual(details.userResponse, "yes");
	});

	test("formats shared reasons and runtime messages", () => {
		assert.strictEqual(formatValidationReason(deniedResult), "first violation; second violation");
		assert.strictEqual(formatValidationReason(deniedResult, ", "), "first violation, second violation");
		assert.strictEqual(formatPiConfirmationMessage("x".repeat(120)), `Allow: ${"x".repeat(100)}`);
		assert.ok((formatCodexDenyMessage("rm -rf /tmp/stuff", deniedResult)).includes("Severity: CRITICAL"));
		assert.ok((formatCodexPendingApprovalMessage("sudo ls", deniedResult, "token")).includes("allow-command token"));
	});
});
