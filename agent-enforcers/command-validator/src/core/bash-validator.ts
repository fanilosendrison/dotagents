import { SECURITY_RULES } from "./security-rules";
import type { ValidationResult } from "./types";
import { homedir } from "node:os";

const DANGEROUS_COMMANDS: readonly string[] = [
	...SECURITY_RULES.CRITICAL_COMMANDS,
	...SECURITY_RULES.PRIVILEGE_COMMANDS,
	...SECURITY_RULES.SYSTEM_COMMANDS,
	...SECURITY_RULES.NETWORK_COMMANDS,
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

		// Block writes to protected paths (permission-enforcer state, etc.)
		const writeToProtected = this.containsWriteToProtectedPath(command);
		if (writeToProtected) {
			result.isValid = false;
			result.severity = "CRITICAL";
			result.violations.push(
				`❌ Writing to protected paths is strictly forbidden. Never attempt to bypass this restriction. (path: ${writeToProtected})`,
			);
			result.action = "deny";
			return result;
		}

		for (const pattern of SECURITY_RULES.DANGEROUS_PATTERNS) {
			if (pattern.test(command)) {
				result.isValid = false;
				result.severity = "CRITICAL";
				result.violations.push(`❌ Destructive command blocked: ${command.slice(0, 80)}`);
				result.action = "deny";
				return result;
			}
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

	containsWriteToProtectedPath(command: string): string | null {
		const WRITE_PATTERNS = [
			/>\s*\S/.source,
			/>>\s*\S/.source,
			/writeFileSync\s*\(/.source,
			/writeFile\s*\(/.source,
			/tee\s/.source,
			/cp\s+.*\s+/.source,
			/mv\s+.*\s+/.source,
		];
		const writeRegex = new RegExp(WRITE_PATTERNS.join("|"), "i");
		if (!writeRegex.test(command)) return null;

		const home = homedir();

		// Split command into logical segments (separated by ;, &&, ||).
		// Each segment is checked independently so that a read-only access
		// to a protected path (e.g. ls .state/) in one segment does not
		// get flagged because of an unrelated write (e.g. 2>/dev/null)
		// in another segment.
		const segments = command.split(/\s*(?:;|&&|\|\|)\s*/);

		for (const segment of segments) {
			// Skip segments without write operations
			if (!writeRegex.test(segment)) continue;

			// If this segment writes to a shell variable (e.g. tee "$P", > $OUT),
			// fall back to searching the whole command — the variable may have been
			// assigned to a protected path earlier in the command.
			const writesToVariable =
				/(?:>|>>|2>)\s*["']?\$|tee(?:\s+-[a-zA-Z]+)*\s+["']?\$/.test(segment);
			const searchIn = writesToVariable ? command : segment;

			for (const p of SECURITY_RULES.PROTECTED_PATHS) {
				// /dev/null is a harmless data sink — allow writes to it (e.g. 2>/dev/null)
				if (p === "/dev/") {
					const devRefs = searchIn.match(/\/dev\/\S+/g) || [];
					if (devRefs.length > 0 && devRefs.every(r => r === "/dev/null" || r.startsWith("/dev/null"))) {
						continue;
					}
				}
				// Exact match
				if (searchIn.includes(p)) return p;

				// Variantes avec ~ et $HOME (bash ne les expanse pas dans la commande brute)
				if (p.startsWith(home)) {
					const relative = p.slice(home.length); // ex: "/.agents/agent-enforcers/..."
					if (searchIn.includes(`~${relative}`)) return p;
					if (searchIn.includes(`$HOME${relative}`)) return p;
					if (searchIn.includes(`$\{HOME\}${relative}`)) return p;
				}
			}
		}
		return null;
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
