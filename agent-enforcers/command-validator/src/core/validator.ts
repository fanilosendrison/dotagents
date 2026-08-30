import { RESTRICTED_TOOLS } from "./tool-rules.ts";
import { ToolPermissionValidator } from "./tool-validator.ts";
import { BashValidator } from "./bash-validator.ts";
import type { ValidationResult } from "./types.ts";

export interface CommandValidatorOptions {
	isPermissionGranted?: () => boolean;
}

export class CommandValidator {
	private toolValidator: ToolPermissionValidator;
	private bashValidator = new BashValidator();

	constructor(options: CommandValidatorOptions = {}) {
		this.toolValidator = new ToolPermissionValidator({
			isPermissionGranted: options.isPermissionGranted,
		});
	}

	validate(command: unknown, toolName = "Unknown"): ValidationResult {
		if (RESTRICTED_TOOLS.includes(toolName)) {
			return this.toolValidator.validate();
		}
		return this.bashValidator.validate(command);
	}

	// Délégation pour assurer la compatibilité ascendante avec les tests
	containsRmRf(command: string): boolean {
		return this.bashValidator.containsRmRf(command);
	}

	containsDangerousCommand(command: string): string | null {
		return this.bashValidator.containsDangerousCommand(command);
	}
}
