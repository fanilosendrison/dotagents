import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "bun:test";

const hookPath = new URL("./post-tool-use.ts", import.meta.url).pathname;

describe("post-write-linter post-tool-use hook", () => {
	test("skips non-apply_patch tool inputs", () => {
		const result = spawnSync("bun", [hookPath], {
			input: JSON.stringify({
				hook_event_name: "PostToolUse",
				turn_id: "t1",
				tool_name: "Bash",
				tool_input: { command: "echo ok" },
			}),
			env: { ...process.env, AGENT_HOOK_RUNTIME: "codex" },
			encoding: "utf8",
		});

		expect(result.status).toBe(0);
		expect(result.stdout).toBe("");
	});

	test("blocks with linter output when an edited code file fails", async () => {
		const root = await mkdtemp(join(tmpdir(), "post-write-linter-"));
		const fakeBin = join(root, "bin");
		const srcDir = join(root, "src");
		await mkdir(fakeBin);
		await mkdir(srcDir);

		const shellcheckPath = join(fakeBin, "shellcheck");
		await writeFile(
			shellcheckPath,
			"#!/usr/bin/env sh\necho fake shellcheck failed >&2\nexit 1\n",
		);
		await chmod(shellcheckPath, 0o755);

		await writeFile(
			join(root, "STACK_EVAL.yaml"),
			"decisions:\n  linter: shellcheck\n  type_checker: none\n",
		);
		await writeFile(join(srcDir, "bad.sh"), "echo $missing\n");

		const patch = `*** Begin Patch
*** Update File: src/bad.sh
@@
-echo old
+echo $missing
*** End Patch
`;

		const result = spawnSync("bun", [hookPath], {
			input: JSON.stringify({
				hook_event_name: "PostToolUse",
				turn_id: "t1",
				model: "gpt-test",
				cwd: root,
				tool_name: "apply_patch",
				tool_input: { command: patch },
			}),
			env: {
				...process.env,
				AGENT_HOOK_RUNTIME: "codex",
				PATH: `${fakeBin}:${process.env.PATH ?? ""}`,
			},
			encoding: "utf8",
			cwd: root,
		});

		expect(result.status).toBe(0);

		const output = JSON.parse(result.stdout);
		expect(output.decision).toBe("block");
		expect(output.reason).toContain("Lint/format errors");
		expect(output.reason).toContain("fake shellcheck failed");
		expect(output.hookSpecificOutput.hookEventName).toBe("PostToolUse");
	});
});
