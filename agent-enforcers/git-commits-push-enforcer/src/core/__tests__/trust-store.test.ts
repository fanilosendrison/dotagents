import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createTrustToken,
	isAuthorizedTrustTokenIssuerStack,
	validateTrustToken,
} from "../trust-store.ts";

describe("trust-store", () => {
	test("rejects missing, invalid, and path-like tokens", () => {
		assert.strictEqual(validateTrustToken(undefined), false);
		assert.strictEqual(validateTrustToken("not-a-real-token"), false);
		assert.strictEqual(validateTrustToken("../" + "a".repeat(61)), false);
		assert.strictEqual(validateTrustToken("a".repeat(64)), false);
	});

	test("recognizes only the skill internal git helper call sites", () => {
		assert.strictEqual(isAuthorizedTrustTokenIssuerStack(
				"at buildGitEnv (/repo/skills/git-commits-push/src/modules/git/git-exec.ts:8:30)",
			), true);
		assert.strictEqual(isAuthorizedTrustTokenIssuerStack(
				"at trustedGitEnv (/repo/skills/git-commits-push/src/utils/git-utils.ts:16:30)",
			), true);
		assert.strictEqual(isAuthorizedTrustTokenIssuerStack(
				"at buildGitEnv (/repo/skills/git-commits-push/src/modules/git/git-exec.js:8:30)",
			), true);
		assert.strictEqual(isAuthorizedTrustTokenIssuerStack(
				"at trustedGitEnv (/repo/skills/git-commits-push/src/utils/git-utils.js:16:30)",
			), true);
		assert.strictEqual(isAuthorizedTrustTokenIssuerStack(
				"at forged (/repo/skills/git-commits-push/src/utils/git-utils.ts.lookalike:1:1)",
			), false);
		assert.strictEqual(isAuthorizedTrustTokenIssuerStack(
				"at test (/repo/gravity/tests/integration/git-commits-push-enforcer.test.ts:1:1)",
			), false);
	});

	test("rejects direct token minting outside the skill git helpers", () => {
		assert.throws(() => createTrustToken(), "Trust tokens can only be created by git-commits-push internal git helpers");
	});
});
