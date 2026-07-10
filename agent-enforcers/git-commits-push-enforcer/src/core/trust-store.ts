/**
 * Capability-style trust token store for git-commits-push enforcement.
 *
 * The /git-commits-push skill creates short-lived, one-shot tokens before
 * spawning internal git subprocesses. Gravity's PATH shim validates tokens
 * via this store. A marker without a valid token is blocked.
 *
 * Tokens are file-based (shared between processes), one-shot (consumed on
 * first validation), and expire after 30 seconds. Token minting is restricted
 * to the git helpers inside the /git-commits-push skill; direct imports from
 * tests or arbitrary scripts are rejected.
 */

import { createHash, randomBytes } from "node:crypto";
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
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const TRUSTED_ISSUER = "git-commits-push-internal-git-helper";
const AUTHORIZED_ISSUER_STACK_FRAGMENTS = [
	"/skills/git-commits-push/src/modules/git/git-exec.ts",
	"/skills/git-commits-push/src/utils/git-utils.ts",
];

interface TrustTokenRecord {
	version: 1;
	issuer: typeof TRUSTED_ISSUER;
	createdAt: number;
	expiresAt: number;
	issuerPid: number;
	issuerPpid: number;
	issuerCwd: string;
	issuerStackHash: string;
}

function ensureStoreDir(): void {
	if (!existsSync(STORE_DIR)) {
		mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
	}
}

function cleanupToken(tokenPath: string): void {
	try {
		unlinkSync(tokenPath);
	} catch {
		/* best-effort cleanup */
	}
}

export function isAuthorizedTrustTokenIssuerStack(
	stack: string | undefined,
): boolean {
	if (!stack) return false;
	const normalizedStack = stack.replaceAll("\\", "/");
	return AUTHORIZED_ISSUER_STACK_FRAGMENTS.some((fragment) =>
		normalizedStack.includes(fragment),
	);
}

function createTrustTokenRecord(): TrustTokenRecord {
	const stack = new Error().stack;
	if (!isAuthorizedTrustTokenIssuerStack(stack)) {
		throw new Error(
			"Trust tokens can only be created by git-commits-push internal git helpers.",
		);
	}

	const createdAt = Date.now();
	return {
		version: 1,
		issuer: TRUSTED_ISSUER,
		createdAt,
		expiresAt: createdAt + TOKEN_TTL_MS,
		issuerPid: process.pid,
		issuerPpid: process.ppid,
		issuerCwd: process.cwd(),
		issuerStackHash: createHash("sha256").update(stack ?? "").digest("hex"),
	};
}

/**
 * Create a new trust token. The caller (skill) passes this to git subprocesses
 * via the GIT_COMMITS_PUSH_ENFORCER_TOKEN env var.
 */
export function createTrustToken(): string {
	ensureStoreDir();
	const token = randomBytes(32).toString("hex");
	const tokenPath = join(STORE_DIR, token);
	writeFileSync(
		tokenPath,
		JSON.stringify(createTrustTokenRecord()),
		{ encoding: "utf-8", mode: 0o600 },
	);
	return token;
}

/**
 * Validate and consume a trust token. Returns true only once per token.
 * The Gravity hook calls this before allowing a trusted git operation.
 */
export function validateTrustToken(token: string | undefined): boolean {
	if (!token || token.length === 0) return false;
	if (!TOKEN_PATTERN.test(token)) return false;

	try {
		const tokenPath = join(STORE_DIR, token);
		if (!existsSync(tokenPath)) return false;

		const record = JSON.parse(readFileSync(tokenPath, "utf-8")) as Partial<
			TrustTokenRecord
		>;

		if (
			record.version !== 1 ||
			record.issuer !== TRUSTED_ISSUER ||
			typeof record.expiresAt !== "number" ||
			Date.now() > record.expiresAt
		) {
			cleanupToken(tokenPath);
			return false;
		}

		// One-shot: consume the token
		cleanupToken(tokenPath);
		return true;
	} catch {
		return false;
	}
}

/** Env var names used across processes. */
export const TRUSTED_MARKER_ENV = "GIT_COMMITS_PUSH_ENFORCER_SOURCE";
export const TRUSTED_TOKEN_ENV = "GIT_COMMITS_PUSH_ENFORCER_TOKEN";
export const TRUSTED_MARKER_VALUE = "skill";
