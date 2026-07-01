import { describe, expect, test } from "bun:test";
import { spawnSync, execSync } from "child_process";
import { join } from "path";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";

const preToolScript = join(import.meta.dir, "../pre-tool-use.ts");
const postToolScript = join(import.meta.dir, "../post-tool-use.ts");

describe("secret-scanner bin hooks", () => {
	test("pre-tool-use runs in git repo and validates diff", async () => {
		const root = await mkdtemp(join(tmpdir(), "git-secret-test-"));

		try {
			// Initialize a temporary Git repository
			execSync("git init", { cwd: root });
			// Configure git for committing (required on some test environments)
			execSync("git config user.name 'Test'", { cwd: root });
			execSync("git config user.email 'test@example.com'", { cwd: root });

			// 1. Test clean diff
			await writeFile(join(root, "clean.txt"), "some safe content\n");
			execSync("git add clean.txt", { cwd: root });

			const mockInputClean = {
				session_id: "test-session",
				tool_name: "Bash",
				tool_input: {
					command: "git commit -m 'feat: clean commit'",
				},
				model: "test-model",
				hook_event_name: "PreToolUse",
			};

			const resultClean = spawnSync(process.argv[0], [preToolScript], {
				input: JSON.stringify(mockInputClean),
				cwd: root, // Set working directory so getStagedDiff finds the git repo!
				env: process.env,
			});

			expect(resultClean.status).toBe(0);
			expect(resultClean.stdout.toString().trim()).toBe("");

			// 2. Test dirty diff with AWS key
			await writeFile(join(root, "dirty.txt"), "AKIAIOSFODNN7EXAMPLE\n");
			execSync("git add dirty.txt", { cwd: root });

			const mockInputDirty = {
				session_id: "test-session",
				tool_name: "Bash",
				tool_input: {
					command: "git commit -m 'feat: dirty commit'",
				},
				model: "test-model",
				hook_event_name: "PreToolUse",
			};

			const resultDirty = spawnSync(process.argv[0], [preToolScript], {
				input: JSON.stringify(mockInputDirty),
				cwd: root,
				env: process.env,
			});

			expect(resultDirty.status).toBe(0);
			const output = JSON.parse(resultDirty.stdout.toString());
			expect(output.hookSpecificOutput.permissionDecision).toBe("deny");
			expect(output.hookSpecificOutput.permissionDecisionReason).toContain("Secrets détectés");

		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
