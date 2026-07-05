import { describe, expect, test } from "bun:test";
import { isGitCommit } from "../validator";

describe("git-commits-push-enforcer Core Unit Tests", () => {
	test("detects git commit", () => {
		expect(isGitCommit("git commit -m 'msg'")).toBe(true);
		expect(isGitCommit("git push")).toBe(false);
		expect(isGitCommit("git commit -m 'feat: x' && git push")).toBe(true);
		expect(isGitCommit("ls -la")).toBe(false);
	});
});
