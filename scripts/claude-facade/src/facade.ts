import { randomBytes } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readlinkSync,
	realpathSync,
	renameSync,
	type Stats,
	symlinkSync,
	unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { FACADE_ENTRIES } from "./manifest.ts";
import type { CheckResult, FacadeEntry, FacadeReport } from "./types.ts";

export function homedirPath(...segments: string[]): string {
	return join(homedir(), ...segments);
}

export function resolveRoots(
	agentsRoot?: string,
	claudeRoot?: string,
): { agentsRoot: string; claudeRoot: string } {
	return {
		agentsRoot: agentsRoot ?? homedirPath(".agents"),
		claudeRoot: claudeRoot ?? homedirPath(".claude"),
	};
}

type AtomicSymlinkPublisher = (
	temporaryPath: string,
	destinationPath: string,
) => void;

function isMissingPathError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "ENOENT"
	);
}

function replaceSymlinkAtomically(
	sourcePath: string,
	destinationPath: string,
	publishSymlink: AtomicSymlinkPublisher,
): void {
	const temporaryPath = join(
		dirname(destinationPath),
		`.claude-facade-${randomBytes(16).toString("hex")}.tmp`,
	);

	symlinkSync(sourcePath, temporaryPath);
	try {
		publishSymlink(temporaryPath, destinationPath);
	} catch (publicationError) {
		try {
			unlinkSync(temporaryPath);
		} catch (cleanupError) {
			if (!isMissingPathError(cleanupError)) {
				throw new AggregateError(
					[publicationError, cleanupError],
					`Failed to publish and clean temporary symlink: ${temporaryPath}`,
				);
			}
		}
		throw publicationError;
	}
}

/**
 * Check a single facade entry.
 * Returns a CheckResult; never throws.
 */
export function checkEntry(
	entry: FacadeEntry,
	agentsRoot: string,
	claudeRoot: string,
): CheckResult {
	const sourcePath = join(agentsRoot, entry.source);
	const destPath = join(claudeRoot, entry.destination);

	// 1. Source must exist
	if (!existsSync(sourcePath)) {
		return {
			entry,
			status: "SOURCE_MISSING",
			detail: `Source does not exist: ${sourcePath}`,
		};
	}

	// 2. Destination must exist (lstat)
	let destStat: Stats;
	try {
		destStat = lstatSync(destPath);
	} catch {
		return {
			entry,
			status: "DESTINATION_MISSING",
			detail: `Destination does not exist: ${destPath}`,
		};
	}

	// 3. Must be a symlink
	if (!destStat.isSymbolicLink()) {
		return {
			entry,
			status: "DESTINATION_NOT_SYMLINK",
			detail: `Destination is not a symlink: ${destPath}`,
		};
	}

	// 4. Read the symlink target
	let linkTarget: string;
	try {
		linkTarget = readlinkSync(destPath);
	} catch {
		return {
			entry,
			status: "BROKEN_SYMLINK",
			detail: `Cannot read symlink target: ${destPath}`,
		};
	}

	// 5. Check that realpath of destination matches realpath of source
	let destReal: string;
	let sourceReal: string;
	try {
		destReal = realpathSync(destPath);
		sourceReal = realpathSync(sourcePath);
	} catch {
		// One of them doesn't resolve (broken symlink or missing)
		if (!existsSync(sourcePath)) {
			return {
				entry,
				status: "SOURCE_MISSING",
				detail: `Source does not exist after lstat: ${sourcePath}`,
			};
		}
		try {
			realpathSync(destPath);
		} catch {
			return {
				entry,
				status: "BROKEN_SYMLINK",
				detail: `Symlink target does not resolve: ${destPath} -> ${linkTarget}`,
			};
		}
		return {
			entry,
			status: "BROKEN_SYMLINK",
			detail: `Cannot resolve: ${destPath}`,
		};
	}

	if (destReal !== sourceReal) {
		return {
			entry,
			status: "WRONG_TARGET",
			detail: `Expected ${sourceReal}, got ${destReal} (link target: ${linkTarget})`,
		};
	}

	return { entry, status: "OK" };
}

/**
 * Check all facade entries.
 */
export function checkAll(
	agentsRoot?: string,
	claudeRoot?: string,
): FacadeReport {
	const roots = resolveRoots(agentsRoot, claudeRoot);
	const results = FACADE_ENTRIES.map((entry) =>
		checkEntry(entry, roots.agentsRoot, roots.claudeRoot),
	);
	const okCount = results.filter((r) => r.status === "OK").length;
	return { results, okCount, failCount: results.length - okCount };
}

/**
 * Install a single facade entry.
 *
 * Safety contract:
 * - Source missing → error, no link created
 * - Destination absent → create parents, create symlink
 * - Destination is correct symlink → idempotent success
 * - Destination is wrong symlink → error (install mode)
 * - Destination is real file/dir → error (never overwrite)
 * - Broken symlink → error (install mode)
 */
export function installEntry(
	entry: FacadeEntry,
	agentsRoot: string,
	claudeRoot: string,
	mode: "install" | "repair" = "install",
	publishSymlink: AtomicSymlinkPublisher = renameSync,
): { ok: boolean; detail?: string } {
	const sourcePath = join(agentsRoot, entry.source);
	const destPath = join(claudeRoot, entry.destination);

	// 1. Source must exist
	if (!existsSync(sourcePath)) {
		return { ok: false, detail: `Source does not exist: ${sourcePath}` };
	}

	const sourceReal = realpathSync(sourcePath);

	// 2. Check destination state
	let destExists = false;
	let destIsSymlink = false;
	let destIsReal = false;
	let destLinkTarget: string | null = null;
	let destReal: string | null = null;

	try {
		const stat = lstatSync(destPath);
		destExists = true;
		if (stat.isSymbolicLink()) {
			destIsSymlink = true;
			try {
				destLinkTarget = readlinkSync(destPath);
				destReal = realpathSync(destPath);
			} catch {
				// Broken symlink
				destReal = null;
			}
		} else {
			destIsReal = true;
		}
	} catch {
		// Destination does not exist → ok to create
		destExists = false;
	}

	// 2a. Destination absent → create
	if (!destExists) {
		mkdirSync(dirname(destPath), { recursive: true });
		symlinkSync(sourcePath, destPath);
		return { ok: true };
	}

	// 2b. Destination is a real file or directory → error
	if (destIsReal) {
		const typeLabel = lstatSync(destPath).isDirectory() ? "directory" : "file";
		return {
			ok: false,
			detail: `Destination exists as a real ${typeLabel}, refusing to overwrite: ${destPath}`,
		};
	}

	// 2c. Destination is a symlink
	if (destIsSymlink) {
		// Already correct
		if (destReal !== null && destReal === sourceReal) {
			return { ok: true };
		}

		// Broken symlink
		if (destReal === null) {
			if (mode === "repair") {
				replaceSymlinkAtomically(sourcePath, destPath, publishSymlink);
				return {
					ok: true,
					detail: `Repaired broken symlink: ${destPath} -> ${sourcePath}`,
				};
			}
			return {
				ok: false,
				detail: `Destination is a broken symlink (${destLinkTarget}). Use repair mode to fix.`,
			};
		}

		// Wrong target
		if (mode === "repair") {
			replaceSymlinkAtomically(sourcePath, destPath, publishSymlink);
			return {
				ok: true,
				detail: `Repaired symlink: ${destPath} (was ${destLinkTarget}, now ${sourcePath})`,
			};
		}
		return {
			ok: false,
			detail: `Destination points to wrong target: ${destLinkTarget} (expected ${sourcePath}). Use repair mode.`,
		};
	}

	return { ok: false, detail: `Unexpected state for: ${destPath}` };
}

/**
 * Install all facade entries.
 */
export function installAll(
	agentsRoot?: string,
	claudeRoot?: string,
	mode: "install" | "repair" = "install",
): FacadeReport & { overallOk: boolean } {
	const roots = resolveRoots(agentsRoot, claudeRoot);
	const results: CheckResult[] = [];
	let okCount = 0;

	for (const entry of FACADE_ENTRIES) {
		const result = installEntry(
			entry,
			roots.agentsRoot,
			roots.claudeRoot,
			mode,
		);
		if (result.ok) {
			okCount++;
			results.push({ entry, status: "OK", detail: result.detail });
		} else {
			results.push({ entry, status: "WRONG_TARGET", detail: result.detail });
		}
	}

	return {
		results,
		okCount,
		failCount: results.length - okCount,
		overallOk: okCount === results.length,
	};
}

/**
 * Generate gitignore rules for all facade destinations in dotclaude.
 * Each rule is relative to the dotclaude repo root.
 */
export function generateGitignoreRules(): string[] {
	const rules: string[] = [
		"# ── Claude Code facade (generated by ~/.agents/scripts/claude-facade) ──",
		"# These entries are symlinked into ~/.claude at install time.",
		"# Do not track them in dotclaude Git — the canonical sources live in dotagents.",
		"",
	];

	// Group by top-level directory for readability
	const groups: Record<string, FacadeEntry[]> = {};
	for (const entry of FACADE_ENTRIES) {
		const group = entry.destination.split("/")[0];
		if (!groups[group]) groups[group] = [];
		groups[group].push(entry);
	}

	for (const [group, entries] of Object.entries(groups).sort()) {
		rules.push(`# ${group}/`);
		for (const entry of entries) {
			rules.push(`/${entry.destination}`);
		}
		rules.push("");
	}

	return rules;
}
