export type ValidationAction = "allow" | "ask" | "deny";

export type ValidationSeverity = "LOW" | "HIGH" | "CRITICAL";

export interface ValidationResult {
	isValid: boolean;
	severity: ValidationSeverity;
	violations: string[];
	sanitizedCommand: string;
	action: ValidationAction;
}

export interface SecurityRules {
	CRITICAL_COMMANDS: string[];
	PRIVILEGE_COMMANDS: string[];
	NETWORK_COMMANDS: string[];
	SYSTEM_COMMANDS: string[];
	DANGEROUS_PATTERNS: RegExp[];
	PROTECTED_PATHS: string[];
	SAFE_EXECUTABLE_PATHS: string[];
	SAFE_RM_PATHS: string[];
}
