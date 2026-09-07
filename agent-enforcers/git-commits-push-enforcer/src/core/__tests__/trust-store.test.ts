import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	createTrustToken,
	isAuthorizedTrustTokenIssuerStack,
	validateTrustToken,
} from "@git-commits-push/trust";

describe("packaged trust protocol", () => {
	test("rejects missing, invalid, and path-like tokens", () => {
		assert.strictEqual(validateTrustToken(undefined), false);
		assert.strictEqual(validateTrustToken("not-a-real-token"), false);
		assert.strictEqual(validateTrustToken("../" + "a".repeat(61)), false);
		assert.strictEqual(validateTrustToken("a".repeat(64)), false);
	});

	test("disables token minting from the vendored validator package", () => {
		for (const stack of [
			"at buildGitEnv (/repo/git-commits-push/src/modules/git/git-exec.ts:8:30)",
			"at trustedGitEnv (/repo/git-commits-push/src/utils/git-utils.ts:16:30)",
			"at buildGitEnv (/repo/git-commits-push/dist/src/modules/git/git-exec.js:8:30)",
			"at trustedGitEnv (/repo/git-commits-push/dist/src/utils/git-utils.js:16:30)",
		]) {
			assert.strictEqual(isAuthorizedTrustTokenIssuerStack(stack), false);
		}
	});

	test("rejects direct token minting outside the skill git helpers", () => {
		assert.throws(() => createTrustToken(), "Trust tokens can only be created by git-commits-push internal git helpers");
	});
});
