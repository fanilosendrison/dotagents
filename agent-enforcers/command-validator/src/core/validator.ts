import { RESTRICTED_TOOLS } from "./tool-rules";
import { ToolPermissionValidator } from "./tool-validator";
import { BashValidator } from "./bash-validator";
import type { ValidationResult } from "./types";

export class CommandValidator {
	private toolValidator = new ToolPermissionValidator();
	private bashValidator = new BashValidator();

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
