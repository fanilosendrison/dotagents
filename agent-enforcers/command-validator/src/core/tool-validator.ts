import type { ValidationResult } from "./types";
import { isPermissionGranted } from "../../../permission-enforcer/src/core/state.ts";

export interface ToolPermissionValidatorOptions {
	isPermissionGranted?: () => boolean;
}

export class ToolPermissionValidator {
	private readonly permissionChecker?: () => boolean;

	constructor(options: ToolPermissionValidatorOptions = {}) {
		this.permissionChecker = options.isPermissionGranted;
	}

	validate(): ValidationResult {
		const result: ValidationResult = {
			isValid: true,
			severity: "LOW",
			violations: [],
			sanitizedCommand: "",
			action: "allow",
		};

		const granted = this.permissionChecker
			? this.permissionChecker()
			: isPermissionGranted();

		if (!granted) {
			result.isValid = false;
			result.severity = "CRITICAL";
			result.violations.push(
				"❌ Permission denied. You cannot implement code without explicit permission. Ask the user to type '/go' to authorize implementation."
			);
			result.action = "deny";
		}

		return result;
	}
}
