import { describe, expect, test } from "bun:test";
import { spawnSync } from "child_process";
import { join } from "path";

const preToolScript = join(import.meta.dir, "../pre-tool-use.ts");

describe("path-guard bin hook", () => {
	test("allows safe write path", () => {
		const mockInput = {
			session_id: "test-session",
			tool_name: "Write",
			tool_input: {
				file_path: "/tmp/safe.txt",
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

	test("denies direct write to dotpi/", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const mockInput = {
			session_id: "test-session",
			tool_name: "Write",
			tool_input: {
				file_path: `${HOME}/Developper/Projects/dotpi/settings.json`,
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
		expect(output.hookSpecificOutput.permissionDecisionReason).toContain("Write through");
	});

	test("denies bash command writing directly to dotpi/", () => {
		const HOME = process.env.HOME || "/Users/famillesendrison";
		const mockInput = {
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: {
				command: `echo 'hello' > ${HOME}/Developper/Projects/dotpi/settings.json`,
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
		expect(output.hookSpecificOutput.permissionDecisionReason).toContain("Write through");
	});
});
