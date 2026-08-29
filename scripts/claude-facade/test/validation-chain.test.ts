import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

interface PackageConfiguration {
	readonly scripts: Readonly<Record<string, string>>;
	readonly workspaces?: unknown;
}

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../../..");

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPackageConfiguration(path: string): PackageConfiguration {
	const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
	if (!isRecord(parsed) || !isRecord(parsed.scripts)) {
		throw new Error(`Package configuration has no scripts object: ${path}`);
	}

	const scripts: Record<string, string> = {};
	for (const [name, command] of Object.entries(parsed.scripts)) {
		if (typeof command !== "string") {
			throw new Error(`Package script is not a string: ${name}`);
		}
		scripts[name] = command;
	}

	return { scripts, workspaces: parsed.workspaces };
}

describe("repository validation chain", () => {
	it("owns each independently locked package from the root test command", () => {
		const rootPackage = readPackageConfiguration(
			join(repositoryRoot, "package.json"),
		);

		assert.strictEqual(rootPackage.workspaces, undefined);
		assert.strictEqual(
			rootPackage.scripts.test,
			"bun run test:install && bun run test:root && bun run test:git-commits-push && bun run test:scripts && bun run test:protocol",
		);
		assert.strictEqual(
			rootPackage.scripts["test:install"],
			"bun install --frozen-lockfile && bun install --cwd skills/create-symlink-for-dot-folders --frozen-lockfile && bun install --cwd skills/git-commits-push --frozen-lockfile && bun install --cwd skills/go --frozen-lockfile && bun install --cwd scripts --frozen-lockfile && bun install --cwd skills/loop-clean/protocol --frozen-lockfile",
		);
		assert.strictEqual(
			rootPackage.scripts["test:root"],
			"bun test --timeout 60000 --path-ignore-patterns='scripts/**' --path-ignore-patterns='skills/git-commits-push/**' --path-ignore-patterns='skills/loop-clean/protocol/**'",
		);
		assert.strictEqual(
			rootPackage.scripts["test:git-commits-push"],
			"bun run --cwd skills/git-commits-push test",
		);
		assert.strictEqual(
			rootPackage.scripts["test:scripts"],
			"bun run --cwd scripts test:bun",
		);
		assert.strictEqual(
			rootPackage.scripts["test:scripts-node"],
			"pnpm --filter @dotagents/scripts run test",
		);
		assert.strictEqual(
			rootPackage.scripts["typecheck:scripts"],
			"pnpm --filter @dotagents/scripts run typecheck",
		);
		assert.strictEqual(
			rootPackage.scripts["test:protocol"],
			"bun run --cwd skills/loop-clean/protocol typecheck && bun run --cwd skills/loop-clean/protocol test:all",
		);

		for (const lockfilePath of [
			join(repositoryRoot, "bun.lock"),
			join(repositoryRoot, "scripts", "bun.lock"),
			join(
				repositoryRoot,
				"skills",
				"create-symlink-for-dot-folders",
				"bun.lock",
			),
			join(repositoryRoot, "skills", "git-commits-push", "bun.lock"),
			join(repositoryRoot, "skills", "go", "bun.lock"),
			join(repositoryRoot, "skills", "loop-clean", "protocol", "bun.lock"),
		]) {
			assert.strictEqual(existsSync(lockfilePath), true);
		}
	});

	it("keeps protocol validation out of the scripts package", () => {
		const scriptsPackage = readPackageConfiguration(
			join(repositoryRoot, "scripts", "package.json"),
		);

		assert.strictEqual(scriptsPackage.scripts.test, "node test/run-tests.mjs");
		assert.strictEqual(
			scriptsPackage.scripts.test.includes("loop-clean/protocol"),
			false,
		);
		assert.strictEqual(scriptsPackage.scripts.test.includes("test:all"), false);
	});

	it("owns script sources from one parent package boundary", () => {
		for (const relativePath of [
			"scripts/coding-standards-consolidate/package.json",
			"scripts/coding-standards-scanner/package.json",
			"scripts/lib/coding-standards-schema/package.json",
			"scripts/lib/stack-tools/package.json",
		]) {
			assert.strictEqual(existsSync(join(repositoryRoot, relativePath)), false);
		}
	});

	it("disables implicit dependency installation in both nested packages", () => {
		for (const bunfigPath of [
			join(repositoryRoot, "scripts", "bunfig.toml"),
			join(repositoryRoot, "skills", "loop-clean", "protocol", "bunfig.toml"),
		]) {
			assert.strictEqual(
				readFileSync(bunfigPath, "utf8").trim(),
				'[install]\nauto = "disable"',
			);
		}
	});

	it("keeps the scripts manifest compatible with its retained frozen Bun lock", () => {
		const scriptsManifest = readFileSync(
			join(repositoryRoot, "scripts", "package.json"),
			"utf8",
		);
		const scriptsBunLock = readFileSync(
			join(repositoryRoot, "scripts", "bun.lock"),
			"utf8",
		);
		for (const dependencyEntry of [
			'"@types/bun": "1.3.14"',
			'"typescript": "^5.9.3"',
		]) {
			assert.strictEqual(scriptsManifest.includes(dependencyEntry), true);
			assert.strictEqual(scriptsBunLock.includes(dependencyEntry), true);
		}
		assert.strictEqual(scriptsManifest.includes('"@types/node"'), false);
	});
});
