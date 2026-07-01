// tests/unit/pi-orch-git-commits-push.test.ts
import { afterAll, beforeAll, describe, expect, test, mock } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Set up module mocks before importing the target wrapper
let lastExecCmd: string | null = null;

mock.module("@fanilosendrison/llm-runtime", () => ({
	createOpenAIAdapter: () => ({
		call: async () => ({ content: JSON.stringify({ type: "feat", description: "mock openai commit" }) }),
	}),
	createAnthropicAdapter: () => ({
		call: async () => ({ content: JSON.stringify({ type: "fix", description: "mock anthropic commit" }) }),
	}),
	createGoogleAdapter: () => ({
		call: async () => ({ content: JSON.stringify({ type: "docs", description: "mock google commit" }) }),
	}),
	createOpenAICompatibleAdapter: () => ({
		call: async () => ({ content: JSON.stringify({ type: "chore", description: "mock custom commit" }) }),
	}),
	buildSimplePrompt: (p: any) => p,
}));

mock.module(path.resolve(__dirname, "../../src/modules/auth-resolver"), () => ({
	resolveAuthToken: async (provider: string) => {
		if (provider === "fail") {
			throw new Error("mock auth fail");
		}
		return "mock-token";
	},
}));

// Now import the functions to test
import {
	parseSerializedValue,
	invokeLlm,
	handleTurnlockDelegation,
} from "../../src/pi-orch-git-commits-push.ts";

describe("pi-orch-git-commits-push wrapper", () => {
	describe("parseSerializedValue", () => {
		test("removes surrounding double quotes", () => {
			expect(parseSerializedValue('"hello"')).toBe("hello");
		});

		test("leaves unquoted string unchanged", () => {
			expect(parseSerializedValue("hello")).toBe("hello");
		});

		test("handles empty string", () => {
			expect(parseSerializedValue("")).toBe("");
		});
	});

	describe("invokeLlm", () => {
		test("calls openai adapter correctly", async () => {
			const res = await invokeLlm({
				provider: "openai",
				model: "gpt-5.4-mini",
				token: "key",
				temperature: 0,
				systemPrompt: "sys",
				userPrompt: "user",
			});
			expect(res).toContain("mock openai commit");
		});

		test("calls anthropic adapter correctly", async () => {
			const res = await invokeLlm({
				provider: "anthropic",
				model: "claude-test",
				token: "key",
				temperature: 0,
				systemPrompt: "sys",
				userPrompt: "user",
			});
			expect(res).toContain("mock anthropic commit");
		});

		test("calls google adapter correctly", async () => {
			const res = await invokeLlm({
				provider: "google",
				model: "gemini-test",
				token: "key",
				temperature: 0,
				systemPrompt: "sys",
				userPrompt: "user",
			});
			expect(res).toContain("mock google commit");
		});

		test("calls custom adapter correctly", async () => {
			const res = await invokeLlm({
				provider: "custom-provider",
				model: "custom-model",
				token: "key",
				temperature: 0,
				systemPrompt: "sys",
				userPrompt: "user",
			});
			expect(res).toContain("mock custom commit");
		});
	});

	describe("handleTurnlockDelegation", () => {
		let tempManifestPath: string;
		let tempResultPath: string;
		let tempDir: string;

		beforeAll(() => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "turnlock-wrapper-test-"));
			tempManifestPath = path.join(tempDir, "manifest.json");
			tempResultPath = path.join(tempDir, "result.json");
		});

		afterAll(() => {
			fs.rmSync(tempDir, { recursive: true, force: true });
		});

		test("processes jobs successfully and resumes turnlock", async () => {
			const mockJobPayload = {
				repository: "/path/to/repo",
				diff: "staged-diff",
				diffHash: "hash123",
				provider: "openai",
				model: "gpt-5.4-mini",
				temperature: 0,
				systemPrompt: "sys-prompt",
			};

			const manifest = {
				manifestVersion: 1,
				runId: "run-123",
				orchestratorName: "git-commits-push-tl",
				phase: "discovery-and-validation",
				resumeAt: "commit-and-push",
				label: "commit-jobs",
				kind: "agent-batch",
				jobs: [
					{
						id: "job-1",
						prompt: JSON.stringify(mockJobPayload),
						resultPath: tempResultPath,
					},
				],
			};

			fs.writeFileSync(tempManifestPath, JSON.stringify(manifest), "utf-8");
			lastExecCmd = null;

			await handleTurnlockDelegation(tempManifestPath, "resume-cmd --test", (cmd) => {
				lastExecCmd = cmd;
			});

			// Verify result file exists and has success payload
			expect(fs.existsSync(tempResultPath)).toBe(true);
			const resultData = JSON.parse(fs.readFileSync(tempResultPath, "utf-8"));
			expect(resultData.success).toBe(true);
			expect(resultData.id).toBe("job-1");
			expect(resultData.commit.type).toBe("feat");
			expect(resultData.commit.description).toBe("mock openai commit");

			// Verify execSync resume command was executed
			expect(lastExecCmd).toBe("resume-cmd --test");
		});

		test("writes failure results on execution errors", async () => {
			const mockJobPayload = {
				repository: "/path/to/repo",
				diff: "staged-diff",
				diffHash: "hash123",
				provider: "fail", // will trigger mock resolver failure
				model: "gpt-5.4-mini",
				temperature: 0,
				systemPrompt: "sys-prompt",
			};

			const manifest = {
				manifestVersion: 1,
				runId: "run-123",
				orchestratorName: "git-commits-push-tl",
				phase: "discovery-and-validation",
				resumeAt: "commit-and-push",
				label: "commit-jobs",
				kind: "agent-batch",
				jobs: [
					{
						id: "job-2",
						prompt: JSON.stringify(mockJobPayload),
						resultPath: tempResultPath,
					},
				],
			};

			fs.writeFileSync(tempManifestPath, JSON.stringify(manifest), "utf-8");

			await handleTurnlockDelegation(tempManifestPath, "resume-cmd --test", (cmd) => {
				lastExecCmd = cmd;
			});

			expect(fs.existsSync(tempResultPath)).toBe(true);
			const resultData = JSON.parse(fs.readFileSync(tempResultPath, "utf-8"));
			expect(resultData.success).toBe(false);
			expect(resultData.id).toBe("job-2");
			expect(resultData.error).toContain("LLM Fatal Error: mock auth fail");
		});
	});
});
