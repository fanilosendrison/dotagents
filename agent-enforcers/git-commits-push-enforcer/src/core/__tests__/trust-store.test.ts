import { describe, expect, test } from "bun:test";
import {
	createTrustToken,
	isAuthorizedTrustTokenIssuerStack,
	validateTrustToken,
} from "../trust-store";

describe("trust-store", () => {
	test("rejects missing, invalid, and path-like tokens", () => {
		expect(validateTrustToken(undefined)).toBe(false);
		expect(validateTrustToken("not-a-real-token")).toBe(false);
		expect(validateTrustToken("../" + "a".repeat(61))).toBe(false);
		expect(validateTrustToken("a".repeat(64))).toBe(false);
	});

	test("recognizes only the skill internal git helper call sites", () => {
		expect(
			isAuthorizedTrustTokenIssuerStack(
				"at buildGitEnv (/repo/skills/git-commits-push/src/modules/git/git-exec.ts:8:30)",
			),
		).toBe(true);
		expect(
			isAuthorizedTrustTokenIssuerStack(
				"at trustedGitEnv (/repo/skills/git-commits-push/src/utils/git-utils.ts:16:30)",
			),
		).toBe(true);
		expect(
			isAuthorizedTrustTokenIssuerStack(
				"at test (/repo/gravity/tests/integration/git-commits-push-enforcer.test.ts:1:1)",
			),
		).toBe(false);
	});

	test("rejects direct token minting outside the skill git helpers", () => {
		expect(() => createTrustToken()).toThrow(
			"Trust tokens can only be created by git-commits-push internal git helpers",
		);
	});
});
