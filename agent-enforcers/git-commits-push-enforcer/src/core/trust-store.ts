/**
 * Capability-style trust token store for git-commits-push enforcement.
 *
 * The /git-commits-push skill creates short-lived, one-shot tokens before
 * spawning internal git subprocesses. Gravity's PATH shim validates tokens
 * via this store. A marker without a valid token is blocked.
 *
 * Tokens are file-based (shared between processes), one-shot (consumed on
 * first validation), and expire after 30 seconds.
 */

import { randomBytes } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const STORE_DIR = join(tmpdir(), "git-commits-push-trust-tokens");
const TOKEN_TTL_MS = 30_000; // 30 seconds

function ensureStoreDir(): void {
	if (!existsSync(STORE_DIR)) {
		mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
	}
}

/**
 * Create a new trust token. The caller (skill) passes this to git subprocesses
 * via the GIT_COMMITS_PUSH_ENFORCER_TOKEN env var.
 */
export function createTrustToken(): string {
	ensureStoreDir();
	const token = randomBytes(32).toString("hex");
	const tokenPath = join(STORE_DIR, token);
	writeFileSync(tokenPath, String(Date.now() + TOKEN_TTL_MS), "utf-8");
	return token;
}

/**
 * Validate and consume a trust token. Returns true only once per token.
 * The Gravity hook calls this before allowing a trusted git operation.
 */
export function validateTrustToken(token: string | undefined): boolean {
	if (!token || token.length === 0) return false;
	try {
		const tokenPath = join(STORE_DIR, token);
		if (!existsSync(tokenPath)) return false;

		const expiryStr = readFileSync(tokenPath, "utf-8");
		const expiry = parseInt(expiryStr, 10);

		if (Number.isNaN(expiry) || Date.now() > expiry) {
			try {
				unlinkSync(tokenPath);
			} catch {
				/* best-effort cleanup */
			}
			return false;
		}

		// One-shot: consume the token
		try {
			unlinkSync(tokenPath);
		} catch {
			/* best-effort cleanup */
		}
		return true;
	} catch {
		return false;
	}
}

/** Env var names used across processes. */
export const TRUSTED_MARKER_ENV = "GIT_COMMITS_PUSH_ENFORCER_SOURCE";
export const TRUSTED_TOKEN_ENV = "GIT_COMMITS_PUSH_ENFORCER_TOKEN";
export const TRUSTED_MARKER_VALUE = "skill";
