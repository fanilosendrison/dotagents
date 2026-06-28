export interface HookInput {
	session_id?: string;
	turn_id?: string;
	transcript_path?: string | null;
	cwd?: string;
	hook_event_name?: string;
	model?: string;
	tool_name?: string;
	tool_input?: Record<string, unknown>;
	tool_response?: Record<string, unknown>;
	prompt?: string;
	user_prompt?: string;
}

export async function readHookInput(): Promise<HookInput | null> {
	const chunks: Buffer[] = [];
	for await (const chunk of process.stdin) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}

	const raw = Buffer.concat(chunks).toString();
	if (!raw.trim()) {
		return null;
	}

	try {
		return JSON.parse(raw) as HookInput;
	} catch {
		return null;
	}
}

export function getToolCommand(input: HookInput): unknown {
	return input.tool_input?.command;
}

export function getPrompt(input: HookInput): string {
	if (typeof input.prompt === "string") {
		return input.prompt;
	}
	if (typeof input.user_prompt === "string") {
		return input.user_prompt;
	}
	return "";
}

export function getSessionId(input: HookInput): string {
	return input.session_id || "unknown-session";
}
