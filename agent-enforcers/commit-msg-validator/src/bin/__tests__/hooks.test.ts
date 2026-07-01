import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { join } from "path";

const preToolScript = join(import.meta.dir, "../pre-tool-use.ts");
const postToolScript = join(import.meta.dir, "../post-tool-use.ts");

describe("commit-msg-validator bin hooks", () => {
	test("pre-tool-use allows valid commit message", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "git commit -m 'feat(api): add route'",
			},
			model: "test-model",
			hook_event_name: "PreToolUse",
		};

		const result = spawnSync(process.argv[0], [preToolScript], {
			input: JSON.stringify(mockInput),
			env: process.env,
		});

		expect(result.status).toBe(0);
		expect(result.stdout.toString().trim()).toBe("");
	});

	test("pre-tool-use denies invalid commit message", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "git commit -m 'WIP: fix bugs'",
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
		expect(output.hookSpecificOutput.permissionDecisionReason).toContain("Commit message invalide");
	});

	test("pre-tool-use outputs additionalContext when runtime is Claude", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "git commit -m 'feat(api): add route'",
			},
			model: "test-model",
			hook_event_name: "PreToolUse",
		};

		const result = spawnSync(process.argv[0], [preToolScript], {
			input: JSON.stringify(mockInput),
			env: { ...process.env, AGENT_HOOK_RUNTIME: "claude" },
		});

		expect(result.status).toBe(0);
		const output = JSON.parse(result.stdout.toString());
		expect(output.hookSpecificOutput.permissionDecision).toBe("allow");
		expect(output.hookSpecificOutput.additionalContext).toContain("commit message conforme");
	});

	test("post-tool-use outputs additionalContext for codex on valid commit", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "git commit -m 'feat(api): add route'",
			},
			model: "codex-something",
			hook_event_name: "PostToolUse",
		};

		const result = spawnSync(process.argv[0], [postToolScript], {
			input: JSON.stringify(mockInput),
			env: { ...process.env, AGENT_HOOK_RUNTIME: "codex" },
		});

		expect(result.status).toBe(0);
		const output = JSON.parse(result.stdout.toString());
		expect(output.hookSpecificOutput.hookEventName).toBe("PostToolUse");
		expect(output.hookSpecificOutput.additionalContext).toContain("commit message conforme");
	});
});
