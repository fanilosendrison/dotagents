import { describe, expect, test } from "bun:test";
import {
	isGitCommit,
	extractMessage,
	isValidCC,
	hasPush,
} from "../validator";

describe("git-commits-push-enforcer Core Unit Tests", () => {
	test("detects git commit", () => {
		expect(isGitCommit("git commit -m 'msg'")).toBe(true);
		expect(isGitCommit("git push")).toBe(false);
	});

	test("extracts from double quotes", () => {
		expect(extractMessage('git commit -m "feat(api): add route"')).toBe("feat(api): add route");
	});

	test("extracts from single quotes", () => {
		expect(extractMessage("git commit -m 'fix(ui): button'")).toBe("fix(ui): button");
	});

	test("extracts from heredoc", () => {
		const cmd = `git commit -m <<'EOF'
feat(core): something
details
EOF`;
		expect(extractMessage(cmd)).toBe("feat(core): something");
	});

	test("returns null when no -m", () => {
		expect(extractMessage("git commit")).toBeNull();
	});

	test("accepts valid CC messages", () => {
		expect(isValidCC("feat(scope): add endpoint")).toBe(true);
		expect(isValidCC("fix: repair")).toBe(true);
	});

	test("rejects invalid CC messages", () => {
		expect(isValidCC("WIP: something")).toBe(false);
		expect(isValidCC("feat: ")).toBe(false);
	});

	test("detects git push", () => {
		expect(hasPush("git commit -m '...' && git push")).toBe(true);
		expect(hasPush("git commit")).toBe(false);
	});
});
