import { SECURITY_RULES } from "./security-rules";
import type { ValidationResult } from "./types";

const DANGEROUS_COMMANDS: readonly string[] = [
	...SECURITY_RULES.CRITICAL_COMMANDS,
	...SECURITY_RULES.PRIVILEGE_COMMANDS,
	...SECURITY_RULES.SYSTEM_COMMANDS,
];

export class BashValidator {
	validate(command: unknown): ValidationResult {
		const result: ValidationResult = {
			isValid: true,
			severity: "LOW",
			violations: [],
			sanitizedCommand: typeof command === "string" ? command : "",
			action: "allow",
		};

		if (!command || typeof command !== "string") {
			result.isValid = false;
			result.violations.push("❌ Invalid command format");
			result.action = "deny";
			return result;
		}

		if (/^chmod\s+\+x\s+/.test(command.trim())) {
			return result;
		}

		if (this.containsRmRf(command)) {
			result.isValid = false;
			result.severity = "CRITICAL";
			result.violations.push("❌ rm -rf is forbidden - use trash instead");
			result.action = "deny";
			return result;
		}

		const dangerousCmd = this.containsDangerousCommand(command);
		if (dangerousCmd) {
			result.isValid = false;
			result.severity = "HIGH";
			result.violations.push(`⚠️ Potentially dangerous command: ${dangerousCmd}`);
			result.action = "ask";
			return result;
		}

		return result;
	}

	containsRmRf(command: string): boolean {
		const rmRfPatterns = [
			/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*)\s/i,
			/\brm\s+-r\s+-f\s/i,
			/\brm\s+-f\s+-r\s/i,
		];

		for (const pattern of rmRfPatterns) {
			if (pattern.test(command)) {
				return true;
			}
		}

		return false;
	}

	containsDangerousCommand(command: string): string | null {
		const normalizedCmd = command.trim().toLowerCase();
		const parts = normalizedCmd.split(/\s+/);
		const mainCommand = parts[0].split("/").pop() || "";

		if (DANGEROUS_COMMANDS.includes(mainCommand)) {
			return mainCommand;
		}

		for (const dangerous of DANGEROUS_COMMANDS) {
			const pattern = new RegExp(
				`(?:^|[;|&\\n]|\\$\\(|\`)\\s*${dangerous}\\b`,
				"i",
			);
			if (pattern.test(command)) {
				return dangerous;
			}
		}

		return null;
	}
}
