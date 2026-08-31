/**
 * Claude Facade Installer — Test Suite
 *
 * All tests use temporary roots so the real HOME is never touched.
 * Run with: node --test ~/.agents/scripts/claude-facade/test/facade.test.ts
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	readlinkSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
	checkEntry,
	generateGitignoreRules,
	installAll,
	installEntry,
} from "../src/facade.ts";
import { FACADE_ENTRIES } from "../src/manifest.ts";
import type { FacadeEntry } from "../src/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));

let agentsRoot: string;
let claudeRoot: string;

function seed(): string {
	return `claude-facade-test-${randomBytes(8).toString("hex")}`;
}

function createSource(entry: FacadeEntry) {
	const src = join(agentsRoot, entry.source);
	if (entry.kind === "directory") {
		mkdirSync(src, { recursive: true });
		// Create a marker file so realpath has something to resolve
		writeFileSync(join(src, ".facade-marker"), "canonical source");
	} else {
		mkdirSync(join(src, ".."), { recursive: true });
		writeFileSync(src, "canonical source content");
	}
}

describe("claude-facade", () => {
	before(() => {
		agentsRoot = join(tmpdir(), seed(), ".agents");
		claudeRoot = join(tmpdir(), seed(), ".claude");
		mkdirSync(agentsRoot, { recursive: true });
		mkdirSync(claudeRoot, { recursive: true });
	});

	after(() => {
		if (agentsRoot && existsSync(agentsRoot)) {
			rmSync(join(agentsRoot, ".."), { recursive: true, force: true });
		}
	});

	// ── Manifest integrity ─────────────────────────────────
	describe("manifest", () => {
		it("contains all expected entries", () => {
			assert.strictEqual(FACADE_ENTRIES.length, 15);
		});

		it("has no duplicates in destination", () => {
			const dests = FACADE_ENTRIES.map((e) => e.destination);
			const unique = new Set(dests);
			assert.strictEqual(unique.size, dests.length);
		});

		it("has no duplicates in source", () => {
			const sources = FACADE_ENTRIES.map((e) => e.source);
			const unique = new Set(sources);
			assert.strictEqual(unique.size, sources.length);
		});

		it("contains no absolute paths", () => {
			for (const e of FACADE_ENTRIES) {
				assert.strictEqual(e.source.startsWith("/"), false);
				assert.strictEqual(e.source.startsWith("~"), false);
				assert.strictEqual(e.source.includes("Users/"), false);
				assert.strictEqual(e.destination.startsWith("/"), false);
				assert.strictEqual(e.destination.startsWith("~"), false);
				assert.strictEqual(e.destination.includes("Users/"), false);
			}
		});
	});

	// ── 11.1 Nominal installation ─────────────────────────
	describe("install", () => {
		it("creates a symlink when source present and destination absent", () => {
			const entry = FACADE_ENTRIES[0]; // skills/loop-clean
			createSource(entry);

			// Ensure destination does not exist
			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}

			const result = installEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(result.ok, true);

			// Verify
			const stat = lstatSync(destPath);
			assert.strictEqual(stat.isSymbolicLink(), true);
			assert.strictEqual(
				realpathSync(destPath),
				realpathSync(join(agentsRoot, entry.source)),
			);
		});
	});

	// ── 11.2 Idempotence ──────────────────────────────────
	describe("idempotence", () => {
		it("running install twice succeeds with no changes", () => {
			const entry = FACADE_ENTRIES[1]; // skills/coding-standards
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}

			// First install
			const r1 = installEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(r1.ok, true);
			const linkTarget1 = readlinkSync(destPath);

			// Second install
			const r2 = installEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(r2.ok, true);
			const linkTarget2 = readlinkSync(destPath);

			// Unchanged
			assert.strictEqual(linkTarget1, linkTarget2);
		});
	});

	// ── 11.3 Check nominal ────────────────────────────────
	describe("check", () => {
		it("returns OK for correct facade entries", () => {
			// Set up 3 entries
			const entries = FACADE_ENTRIES.slice(0, 3);
			for (const e of entries) {
				createSource(e);
				try {
					rmSync(join(claudeRoot, e.destination), {
						recursive: true,
						force: true,
					});
				} catch {}
				installEntry(e, agentsRoot, claudeRoot);
			}

			// Check only the entries we set up (others may have missing sources)
			for (const e of entries) {
				const result = checkEntry(e, agentsRoot, claudeRoot);
				assert.strictEqual(result.status, "OK");
			}
		});
	});

	// ── 11.4 Source missing ───────────────────────────────
	describe("source missing", () => {
		it("fails install and creates no link", () => {
			const entry: FacadeEntry = {
				source: "skills/nonexistent",
				destination: "skills/nonexistent",
				kind: "directory",
			};
			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}

			const result = installEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(existsSync(destPath), false);
		});

		it("check reports SOURCE_MISSING", () => {
			const entry: FacadeEntry = {
				source: "skills/also-nonexistent",
				destination: "skills/also-nonexistent",
				kind: "directory",
			};
			const result = checkEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(result.status, "SOURCE_MISSING");
		});
	});

	// ── 11.5 Real destination — file ──────────────────────
	describe("real destination file", () => {
		it("fails install and preserves content", () => {
			const entry = FACADE_ENTRIES[0];
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}
			mkdirSync(join(destPath, ".."), { recursive: true });
			writeFileSync(destPath, "original real file content");

			const result = installEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.detail?.includes("real"), true);

			// Content preserved
			const stat = lstatSync(destPath);
			assert.strictEqual(stat.isSymbolicLink(), false);
			assert.strictEqual(
				readFileSync(destPath, "utf8"),
				"original real file content",
			);
		});
	});

	// ── 11.6 Real destination — directory ─────────────────
	describe("real destination directory", () => {
		it("fails install and preserves content", () => {
			const entry = FACADE_ENTRIES[0];
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}
			mkdirSync(destPath, { recursive: true });
			writeFileSync(join(destPath, "child.txt"), "child content");

			const result = installEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.detail?.includes("real"), true);
			assert.strictEqual(result.detail?.includes("directory"), true);

			// Content preserved
			const stat = lstatSync(destPath);
			assert.strictEqual(stat.isSymbolicLink(), false);
			assert.strictEqual(
				readFileSync(join(destPath, "child.txt"), "utf8"),
				"child content",
			);
		});
	});

	// ── 11.7 Wrong symlink ───────────────────────────────
	describe("wrong symlink", () => {
		it("fails install and preserves old target", () => {
			const entry = FACADE_ENTRIES[0];
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}
			mkdirSync(join(destPath, ".."), { recursive: true });

			// Create a symlink to somewhere else
			const wrongTarget = join(agentsRoot, "skills", "coding-standards");
			mkdirSync(wrongTarget, { recursive: true });
			writeFileSync(join(wrongTarget, ".marker"), "wrong");
			symlinkSync(wrongTarget, destPath);

			const result = installEntry(entry, agentsRoot, claudeRoot, "install");
			assert.strictEqual(result.ok, false);
			assert.strictEqual(result.detail?.includes("wrong target"), true);

			// Old target preserved
			assert.strictEqual(readlinkSync(destPath), wrongTarget);
		});

		it("repair mode fixes wrong symlink", () => {
			const entry = FACADE_ENTRIES[1];
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}
			mkdirSync(join(destPath, ".."), { recursive: true });

			const wrongTarget = join(agentsRoot, "skills", "loop-clean");
			mkdirSync(wrongTarget, { recursive: true });
			writeFileSync(join(wrongTarget, ".marker"), "wrong");
			symlinkSync(wrongTarget, destPath);

			const result = installEntry(entry, agentsRoot, claudeRoot, "repair");
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.detail?.includes("Repaired"), true);

			const expectedReal = realpathSync(join(agentsRoot, entry.source));
			assert.strictEqual(realpathSync(destPath), expectedReal);
		});

		it("preserves the old symlink and removes the temporary link when atomic publication fails", () => {
			const entry = FACADE_ENTRIES[1];
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}
			const destinationDirectory = dirname(destPath);
			mkdirSync(destinationDirectory, { recursive: true });

			const wrongTarget = join(agentsRoot, "skills", "loop-clean");
			mkdirSync(wrongTarget, { recursive: true });
			symlinkSync(wrongTarget, destPath);
			const directoryEntriesBeforeRepair =
				readdirSync(destinationDirectory).sort();

			const failAtomicPublication = () => {
				throw new Error("injected atomic publication failure");
			};

			assert.throws(
				() =>
					installEntry(
						entry,
						agentsRoot,
						claudeRoot,
						"repair",
						failAtomicPublication,
					),
				/injected atomic publication failure/,
			);
			assert.strictEqual(readlinkSync(destPath), wrongTarget);
			assert.deepStrictEqual(
				readdirSync(destinationDirectory).sort(),
				directoryEntriesBeforeRepair,
			);
		});
	});

	// ── 11.8 Broken symlink ──────────────────────────────
	describe("broken symlink", () => {
		it("install fails with BROKEN_SYMLINK classification", () => {
			const entry = FACADE_ENTRIES[0];
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}
			mkdirSync(join(destPath, ".."), { recursive: true });

			// Create symlink to nonexistent target
			symlinkSync("/nonexistent/path/for/testing", destPath);

			const installResult = installEntry(
				entry,
				agentsRoot,
				claudeRoot,
				"install",
			);
			assert.strictEqual(installResult.ok, false);
			assert.strictEqual(installResult.detail?.includes("broken"), true);

			const checkResult = checkEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(checkResult.status, "BROKEN_SYMLINK");
		});

		it("repair mode fixes broken symlink", () => {
			const entry = FACADE_ENTRIES[1];
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}
			mkdirSync(join(destPath, ".."), { recursive: true });

			symlinkSync("/nonexistent/path/for/testing2", destPath);

			const result = installEntry(entry, agentsRoot, claudeRoot, "repair");
			assert.strictEqual(result.ok, true);
			assert.strictEqual(result.detail?.includes("Repaired"), true);

			const expectedReal = realpathSync(join(agentsRoot, entry.source));
			assert.strictEqual(realpathSync(destPath), expectedReal);
		});
	});

	// ── 11.9 HOME different (no machine-specific paths) ──
	describe("no machine-specific paths", () => {
		it("install does not produce paths containing /Users/", () => {
			const entry = FACADE_ENTRIES[0];
			createSource(entry);

			const destPath = join(claudeRoot, entry.destination);
			try {
				rmSync(destPath, { recursive: true, force: true });
			} catch {}

			const result = installEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(result.ok, true);

			const linkTarget = readlinkSync(destPath);
			assert.strictEqual(linkTarget.includes("/Users/famillesendrison"), false);
			assert.strictEqual(linkTarget.includes("/Users/"), false);
		});

		it("test roots do not contain /Users/famillesendrison", () => {
			assert.strictEqual(agentsRoot.includes("/Users/famillesendrison"), false);
			assert.strictEqual(claudeRoot.includes("/Users/famillesendrison"), false);
		});

		it("manifest contains no machine-specific paths", () => {
			for (const e of FACADE_ENTRIES) {
				assert.strictEqual(e.source.includes("/Users/"), false);
				assert.strictEqual(e.destination.includes("/Users/"), false);
				assert.strictEqual(
					JSON.stringify(FACADE_ENTRIES).includes("/Users/famillesendrison"),
					false,
				);
			}
		});
	});

	// ── 11.10 Gitignore coverage ──────────────────────────
	describe("gitignore coverage", () => {
		it("generates rules for every manifest destination", () => {
			const rules = generateGitignoreRules();
			const rulesText = rules.join("\n");

			for (const entry of FACADE_ENTRIES) {
				const expectedRule = `/${entry.destination}`;
				assert.strictEqual(rulesText.includes(expectedRule), true);
			}
		});

		it("does not include broad ignore patterns like skills/ or agents/ alone", () => {
			const rules = generateGitignoreRules();
			// Should have specific rules, not broad directory ignores
			assert.strictEqual(
				rules.filter(
					(r) => r === "/skills" || r === "/agents" || r === "/scripts",
				).length,
				0,
			);
		});
	});

	// ── 11.11 No tracked absolute paths ───────────────────
	describe("no tracked absolute paths", () => {
		it("manifest source entries are relative", () => {
			for (const e of FACADE_ENTRIES) {
				assert.strictEqual(e.source.startsWith("/"), false);
				assert.strictEqual(e.source.startsWith("~"), false);
				assert.strictEqual(e.source.includes(":\\"), false); // Windows
			}
		});

		it("manifest destination entries are relative", () => {
			for (const e of FACADE_ENTRIES) {
				assert.strictEqual(e.destination.startsWith("/"), false);
				assert.strictEqual(e.destination.startsWith("~"), false);
				assert.strictEqual(e.destination.includes(":\\"), false);
			}
		});

		it("facade.ts does not contain /Users/famillesendrison in code", () => {
			const facadeSource = readFileSync(
				join(__dirname, "..", "src", "facade.ts"),
				"utf8",
			);
			// homedir() is used, but no hardcoded paths
			assert.strictEqual(
				facadeSource.includes("/Users/famillesendrison"),
				false,
			);
		});

		it("cli.ts does not contain /Users/famillesendrison in code", () => {
			const cliSource = readFileSync(
				join(__dirname, "..", "src", "cli.ts"),
				"utf8",
			);
			assert.strictEqual(cliSource.includes("/Users/famillesendrison"), false);
		});
	});

	// ── installAll ────────────────────────────────────────
	describe("installAll", () => {
		it("installs all entries when sources exist", () => {
			// Create all sources
			for (const entry of FACADE_ENTRIES) {
				createSource(entry);
				try {
					rmSync(join(claudeRoot, entry.destination), {
						recursive: true,
						force: true,
					});
				} catch {}
			}

			const report = installAll(agentsRoot, claudeRoot);
			assert.strictEqual(report.overallOk, true);
			assert.strictEqual(report.failCount, 0);
		});
	});

	// ── checkAll with all statuses ────────────────────────
	describe("checkAll edge cases", () => {
		it("reports DESTINATION_MISSING when no link", () => {
			// Use a custom entry with source that exists but destination that doesn't
			const srcDir = join(agentsRoot, "skills", "custom-source");
			mkdirSync(srcDir, { recursive: true });
			writeFileSync(join(srcDir, ".marker"), "test");

			const entry: FacadeEntry = {
				source: "skills/custom-source",
				destination: "skills/custom-missing-dest",
				kind: "directory",
			};
			const result = checkEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(result.status, "DESTINATION_MISSING");
		});

		it("reports DESTINATION_NOT_SYMLINK for real files", () => {
			// Create source first
			const srcDir = join(agentsRoot, "skills", "another-source");
			mkdirSync(srcDir, { recursive: true });
			writeFileSync(join(srcDir, ".marker"), "test");

			const entry: FacadeEntry = {
				source: "skills/another-source",
				destination: "skills/real-file",
				kind: "directory",
			};
			const destPath = join(claudeRoot, entry.destination);
			mkdirSync(join(destPath, ".."), { recursive: true });
			writeFileSync(destPath, "real file");

			const result = checkEntry(entry, agentsRoot, claudeRoot);
			assert.strictEqual(result.status, "DESTINATION_NOT_SYMLINK");
		});
	});
});
