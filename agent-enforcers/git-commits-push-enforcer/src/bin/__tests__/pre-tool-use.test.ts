import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { join } from "path";

const preToolScript = join(import.meta.dir, "../pre-tool-use.ts");

describe("git-commits-push-enforcer bin hook", () => {
	test("allows commit followed by push", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "git commit -m 'feat(api): add endpoint' && git push",
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

	test("denies commit without push", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "git commit -m 'feat(api): add endpoint'",
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
		expect(output.hookSpecificOutput.permissionDecisionReason).toContain("Always push after commit");
	});

	test("denies invalid conventional commit even with push", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: "git commit -m 'WIP: fix bugs' && git push",
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
		expect(output.hookSpecificOutput.permissionDecisionReason).toContain("Convention");
	});
});
