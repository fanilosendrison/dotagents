#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_REPOSITORY_ROOT = resolve(
	realpathSync(fileURLToPath(new URL(".", import.meta.url))),
	"..",
);
const POLICY_RELATIVE_PATH = "docs/migrations/node-pnpm/bun-allowlist.json";
const ALLOWED_EXCEPTION_CATEGORIES = new Set([
	"external-project-interop",
	"historical-artifact",
	"policy-enforcement",
	"upstream-vendored-code",
	"user-requested-opt-in",
]);
const SOURCE_EXTENSIONS = new Set([
	".cjs",
	".cts",
	".js",
	".jsx",
	".mjs",
	".mts",
	".sh",
	".ts",
	".tsx",
	".yml",
	".yaml",
]);
const DOCUMENT_EXTENSIONS = new Set([".md", ".mdx", ".txt"]);
const BUN_REFERENCE_PATTERN =
	/(?:\bBun\b|\bbun(?:x)?\b|bun:|bun\.lockb?|bunfig|@types\/bun|setup-bun)/i;
const FORBIDDEN_TEST_RUNTIME_PATTERNS = [
	/\b(?:from|import\s*\()\s*["']bun(?::test)?["']/,
	/\brequire\s*\(\s*["']bun(?::test)?["']\s*\)/,
	/\bBun\s*\./,
	/^#!.*\bbun\b/m,
];
const RETIRED_FILE_NAMES = new Set(["bun.lock", "bun.lockb", "bunfig.toml"]);
const SKIPPED_DIRECTORY_NAMES = new Set([".git", "dist", "node_modules"]);

function normalizePath(path) {
	return path.replaceAll("\\", "/");
}

function fail(message) {
	throw new Error(`Bun policy violation: ${message}`);
}

function readJson(path, label) {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		fail(`cannot read ${label}: ${detail}`);
	}
}

function matchesExcludedPath(relativePath, rules) {
	return rules.some((rule) => {
		if (rule.endsWith("/**")) {
			const prefix = rule.slice(0, -3);
			return relativePath === prefix || relativePath.startsWith(`${prefix}/`);
		}
		return relativePath === rule;
	});
}

function collectFiles(repositoryRoot) {
	const files = [];
	function walk(directory) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.isDirectory() && SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
				continue;
			}
			const path = join(directory, entry.name);
			if (entry.isDirectory()) {
				walk(path);
			} else if (entry.isFile()) {
				files.push(normalizePath(relative(repositoryRoot, path)));
			}
		}
	}
	walk(repositoryRoot);
	return files.sort();
}

function validatePackageManifest(repositoryRoot, relativePath, violations) {
	const manifest = readJson(
		resolve(repositoryRoot, relativePath),
		relativePath,
	);
	for (const dependencyGroup of [
		"dependencies",
		"devDependencies",
		"optionalDependencies",
		"peerDependencies",
	]) {
		for (const dependencyName of Object.keys(manifest[dependencyGroup] ?? {})) {
			if (BUN_REFERENCE_PATTERN.test(dependencyName)) {
				violations.push(
					`${relativePath}: ${dependencyGroup}.${dependencyName}`,
				);
			}
		}
	}
	if (manifest.engines?.bun !== undefined) {
		violations.push(`${relativePath}: engines.bun`);
	}
	if (
		typeof manifest.packageManager === "string" &&
		/^bun@/i.test(manifest.packageManager)
	) {
		violations.push(`${relativePath}: packageManager`);
	}
	for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
		if (
			typeof command === "string" &&
			/(?:^|[;&|]\s*|\s)(?:bun|bunx)(?:\s|$)/i.test(command)
		) {
			violations.push(`${relativePath}: scripts.${scriptName}`);
		}
	}
}

function isTestFile(relativePath) {
	return (
		/(?:^|\/)(?:test|tests|__tests__)(?:\/|$)/.test(relativePath) ||
		/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(relativePath)
	);
}

function validateParity(repositoryRoot, policy, violations) {
	const parity = readJson(
		resolve(repositoryRoot, policy.testParityManifest),
		policy.testParityManifest,
	);
	const surfaces = Array.isArray(parity.surfaces) ? parity.surfaces : [];
	const green = surfaces.filter((surface) => surface.parityStatus === "green");
	if (
		surfaces.length !== policy.expectedGreenSurfaces ||
		green.length !== policy.expectedGreenSurfaces
	) {
		violations.push(
			`${policy.testParityManifest}: expected ${policy.expectedGreenSurfaces}/${policy.expectedGreenSurfaces} green surfaces, got ${green.length}/${surfaces.length}`,
		);
	}
	const targets = new Set();
	for (const surface of green) {
		if (
			typeof surface.targetFile !== "string" ||
			targets.has(surface.targetFile)
		) {
			violations.push(
				`${policy.testParityManifest}: invalid or duplicate targetFile ${JSON.stringify(surface.targetFile)}`,
			);
			continue;
		}
		targets.add(surface.targetFile);
		const targetPath = resolve(repositoryRoot, surface.targetFile);
		if (!existsSync(targetPath)) {
			violations.push(`${surface.targetFile}: green target is missing`);
			continue;
		}
		const contents = readFileSync(targetPath, "utf8");
		if (
			FORBIDDEN_TEST_RUNTIME_PATTERNS.some((pattern) => pattern.test(contents))
		) {
			violations.push(
				`${surface.targetFile}: green target uses the retired runtime`,
			);
		}
	}
}

function validateExceptionEntries(repositoryRoot, policy, violations) {
	const entriesByPath = new Map();
	for (const entry of policy.permanentExceptions) {
		if (entriesByPath.has(entry.path)) {
			violations.push(`${entry.path}: duplicate permanent exception`);
			continue;
		}
		entriesByPath.set(entry.path, entry);
		if (!ALLOWED_EXCEPTION_CATEGORIES.has(entry.category)) {
			violations.push(
				`${entry.path}: invalid exception category ${entry.category}`,
			);
		}
		for (const metadataField of ["owner", "rationale", "removalCondition"]) {
			if (
				typeof entry[metadataField] !== "string" ||
				entry[metadataField].trim().length === 0
			) {
				violations.push(`${entry.path}: missing ${metadataField}`);
			}
		}
		if (
			!Array.isArray(entry.requiredLiterals) ||
			entry.requiredLiterals.length === 0
		) {
			violations.push(`${entry.path}: requiredLiterals must be non-empty`);
			continue;
		}
		const path = resolve(repositoryRoot, entry.path);
		if (!existsSync(path)) {
			violations.push(`${entry.path}: stale exception path`);
			continue;
		}
		const contents = readFileSync(path, "utf8");
		for (const literal of entry.requiredLiterals) {
			if (typeof literal !== "string" || !contents.includes(literal)) {
				violations.push(
					`${entry.path}: missing required literal ${JSON.stringify(literal)}`,
				);
			}
		}
	}
	return entriesByPath;
}

export function validateBunPolicy(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
	const policy = readJson(
		resolve(repositoryRoot, POLICY_RELATIVE_PATH),
		POLICY_RELATIVE_PATH,
	);
	if (policy.status !== "active" || policy.default !== "deny") {
		fail("allowlist must have status=active and default=deny");
	}
	if (!Array.isArray(policy.excludedPathRules)) {
		fail("excludedPathRules must be an array");
	}
	if (!Array.isArray(policy.permanentExceptions)) {
		fail("permanentExceptions must be an array");
	}

	const violations = [];
	const entriesByPath = validateExceptionEntries(
		repositoryRoot,
		policy,
		violations,
	);
	validateParity(repositoryRoot, policy, violations);

	for (const relativePath of collectFiles(repositoryRoot)) {
		if (matchesExcludedPath(relativePath, policy.excludedPathRules)) continue;
		const fileName = relativePath.split("/").at(-1) ?? relativePath;
		if (RETIRED_FILE_NAMES.has(fileName)) {
			violations.push(
				`${relativePath}: retired lockfile or runtime configuration`,
			);
			continue;
		}
		if (fileName === "package.json") {
			validatePackageManifest(repositoryRoot, relativePath, violations);
			continue;
		}
		const extension = extname(relativePath).toLowerCase();
		if (DOCUMENT_EXTENSIONS.has(extension)) continue;
		if (!SOURCE_EXTENSIONS.has(extension) && fileName !== "package.json")
			continue;

		const contents = readFileSync(
			resolve(repositoryRoot, relativePath),
			"utf8",
		);
		if (isTestFile(relativePath)) {
			const policyTestException = entriesByPath.get(relativePath);
			if (policyTestException?.category === "policy-enforcement") continue;
			if (
				FORBIDDEN_TEST_RUNTIME_PATTERNS.some((pattern) =>
					pattern.test(contents),
				)
			) {
				violations.push(
					`${relativePath}: test imports or uses the retired runtime`,
				);
			}
			continue;
		}
		if (
			BUN_REFERENCE_PATTERN.test(contents) &&
			!entriesByPath.has(relativePath)
		) {
			violations.push(`${relativePath}: unallowlisted runtime reference`);
		}
	}

	if (violations.length > 0) {
		fail(violations.sort().join("\n"));
	}
	return {
		exceptionCount: policy.permanentExceptions.length,
		greenSurfaceCount: policy.expectedGreenSurfaces,
	};
}

function isDirectEntrypoint() {
	const entrypoint = process.argv[1];
	return (
		entrypoint !== undefined &&
		realpathSync(resolve(entrypoint)) ===
			realpathSync(fileURLToPath(import.meta.url))
	);
}

if (isDirectEntrypoint()) {
	const result = validateBunPolicy();
	process.stdout.write(
		`Bun policy valid: ${result.greenSurfaceCount} green surfaces, ${result.exceptionCount} permanent exceptions\n`,
	);
}
