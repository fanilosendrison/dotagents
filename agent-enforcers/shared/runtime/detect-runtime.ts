import type { HookInput } from "./read-hook-input";

export type AgentRuntime = "claude" | "codex";

export function detectRuntime(input: HookInput | null): AgentRuntime {
	const override = process.env.AGENT_HOOK_RUNTIME?.toLowerCase();
	if (override === "claude" || override === "codex") {
		return override;
	}

	if (input?.turn_id || input?.model) {
		return "codex";
	}

	if (process.env.CODEX_HOME || process.env.CODEX_SESSION_ID) {
		return "codex";
	}

	if (process.env.CLAUDECODE || process.env.CLAUDE_CODE) {
		return "claude";
	}

	return "claude";
}
