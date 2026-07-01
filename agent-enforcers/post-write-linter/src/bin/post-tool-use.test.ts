import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

const hookPath = new URL("./post-tool-use.ts", import.meta.url).pathname;
const bunBinary = process.argv[0] || "bun";

describe("post-write-linter post-tool-use hook (Biome)", () => {
	test("skips non-JS/TS/JSON file inputs (e.g. bash scripts)", async () => {
		const root = await mkdtemp(join(tmpdir(), "post-write-linter-"));
		const bashFile = join(root, "script.sh");
		await writeFile(bashFile, "echo 'hello'\n");

		const result = spawnSync(bunBinary, [hookPath], {
			input: JSON.stringify({
				hook_event_name: "PostToolUse",
				turn_id: "t1",
				tool_name: "Write",
				tool_input: { file_path: bashFile },
				cwd: root,
			}),
			env: { ...process.env, AGENT_HOOK_RUNTIME: "codex" },
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe("");
	});

	test("runs on valid TS file and allows hook execution", async () => {
		const root = await mkdtemp(join(tmpdir(), "post-write-linter-"));
		const tsFile = join(root, "valid.ts");
		await writeFile(tsFile, "export const x: number = 42;\n");

		const result = spawnSync(bunBinary, [hookPath], {
			input: JSON.stringify({
				hook_event_name: "PostToolUse",
				turn_id: "t2",
				tool_name: "Write",
				tool_input: { file_path: tsFile },
				cwd: root,
			}),
			env: { ...process.env, AGENT_HOOK_RUNTIME: "codex" },
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe("");
	});

	test("blocks tool use when Biome linting/syntax fails on TS file", async () => {
		const root = await mkdtemp(join(tmpdir(), "post-write-linter-"));
		const tsFile = join(root, "invalid.ts");
		await writeFile(tsFile, "const x = {\n");

		const result = spawnSync(bunBinary, [hookPath], {
			input: JSON.stringify({
				hook_event_name: "PostToolUse",
				turn_id: "t3",
				tool_name: "Write",
				tool_input: { file_path: tsFile },
				cwd: root,
			}),
			env: { ...process.env, AGENT_HOOK_RUNTIME: "codex" },
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		const output = JSON.parse(result.stdout);
		expect(output.decision).toBe("block");
		expect(output.reason).toContain("Biome errors");
		expect(output.hookSpecificOutput.hookEventName).toBe("PostToolUse");
	});
});
