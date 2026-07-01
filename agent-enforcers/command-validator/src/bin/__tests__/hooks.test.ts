import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { join } from "path";

const preToolScript = join(import.meta.dir, "../pre-tool-use.ts");
const userPromptScript = join(import.meta.dir, "../user-prompt-submit.ts");

describe("command-validator bin hooks", () => {
	test("pre-tool-use allows safe command", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "ls -la",
			},
			model: "test-model",
			hook_event_name: "PreToolUse",
		};

		const result = spawnSync(process.argv[0], [preToolScript], {
			input: JSON.stringify(mockInput),
			env: process.env,
		});

		expect(result.status).toBe(0);
		// An allow decision exits with 0 and writes nothing or exits early
		expect(result.stdout.toString().trim()).toBe("");
	});

	test("pre-tool-use blocks rm -rf command", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "rm -rf /tmp/test",
			},
			model: "test-model",
			hook_event_name: "PreToolUse",
		};

		const result = spawnSync(process.argv[0], [preToolScript], {
			input: JSON.stringify(mockInput),
			env: process.env,
		});

		expect(result.status).toBe(0);
		const output = JSON.parse(result.stdout.toString());
		expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
		expect(output.hookSpecificOutput.permissionDecisionReason).toContain("blocked");
	});

	test("pre-tool-use asks for dangerous command when runtime is Claude", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "sudo ls",
			},
			model: "claude-3-5-sonnet", // Triggers 'claude' runtime detection
			hook_event_name: "PreToolUse",
		};

		const result = spawnSync(process.argv[0], [preToolScript], {
			input: JSON.stringify(mockInput),
			env: { ...process.env, AGENT_HOOK_RUNTIME: "claude" },
		});

		expect(result.status).toBe(0);
		const output = JSON.parse(result.stdout.toString());
		expect(output.hookSpecificOutput.permissionDecision).toBe("ask");
		expect(output.hookSpecificOutput.permissionDecisionReason).toContain("sudo");
	});

	test("user-prompt-submit ignores prompts without allow-command token", () => {
		const mockInput = {
			session_id: "test-session",
			user_prompt: "hello world",
			model: "codex",
			hook_event_name: "UserPromptSubmit",
		};

		const result = spawnSync(process.argv[0], [userPromptScript], {
			input: JSON.stringify(mockInput),
			env: process.env,
		});

		expect(result.status).toBe(0);
		expect(result.stdout.toString().trim()).toBe("");
	});
});
