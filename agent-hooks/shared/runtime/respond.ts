type PreToolPermissionDecision = "allow" | "ask" | "deny";

interface PreToolUseOutput {
	hookSpecificOutput: {
		hookEventName: "PreToolUse";
		permissionDecision: PreToolPermissionDecision;
		permissionDecisionReason: string;
		additionalContext?: string;
	};
}

interface ContextOutput {
	hookSpecificOutput: {
		hookEventName: string;
		additionalContext: string;
	};
}

interface PostToolUseBlockOutput {
	decision: "block";
	reason: string;
	hookSpecificOutput: {
		hookEventName: "PostToolUse";
		additionalContext: string;
	};
}

export function exitAllow(): never {
	process.exit(0);
}

export function respondPreToolDecision(
	decision: PreToolPermissionDecision,
	reason: string,
	additionalContext?: string,
): never {
	const output: PreToolUseOutput = {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: decision,
			permissionDecisionReason: reason,
			...(additionalContext ? { additionalContext } : {}),
		},
	};

	console.log(JSON.stringify(output));
	process.exit(0);
}

export function respondPreToolDeny(reason: string): never {
	respondPreToolDecision("deny", reason);
}

export function respondAdditionalContext(
	hookEventName: string,
	additionalContext: string,
): never {
	const output: ContextOutput = {
		hookSpecificOutput: {
			hookEventName,
			additionalContext,
		},
	};

	console.log(JSON.stringify(output));
	process.exit(0);
}

export function respondPostToolBlock(reason: string): never {
	const output: PostToolUseBlockOutput = {
		decision: "block",
		reason,
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: reason,
		},
	};

	console.log(JSON.stringify(output));
	process.exit(0);
}
