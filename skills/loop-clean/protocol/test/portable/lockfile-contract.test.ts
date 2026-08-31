import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it } from "node:test";

const PROTOCOL_DIR = join(import.meta.dirname, "..", "..");
const REPOSITORY_ROOT = resolve(PROTOCOL_DIR, "../../..");

describe("protocol lockfile contract", () => {
	it("lockfile matches canonical package identity", () => {
		const packageJson = JSON.parse(
			readFileSync(join(PROTOCOL_DIR, "package.json"), "utf8"),
		);
		const lockfile = readFileSync(
			join(REPOSITORY_ROOT, "pnpm-lock.yaml"),
			"utf8",
		);

		assert.strictEqual(packageJson.name, "@dotagents/loop-clean-protocol");
		assert.strictEqual(packageJson.packageManager, "pnpm@11.24.0");
		assert.ok(lockfile.includes("  skills/loop-clean/protocol:"));
		assert.ok(!lockfile.includes("@dotclaude/loop-clean-protocol"));
	});
});
