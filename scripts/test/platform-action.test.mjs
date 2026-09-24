import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const actionDirectory = path.join(
	repositoryRoot,
	"scripts/platform-action",
);
const actionManifestPath = path.join(actionDirectory, "action.yml");
const locatorPath = path.join(actionDirectory, "locate-platform-root.sh");

describe("private platform action", () => {
	test("declares a credential-free composite action", () => {
		const manifest = readFileSync(actionManifestPath, "utf8");

		assert.match(manifest, /^name: Dotagents platform$/m);
		assert.match(manifest, /^  platform-root:$/m);
		assert.match(manifest, /^  using: composite$/m);
		assert.match(manifest, /"\$GITHUB_ACTION_PATH\/locate-platform-root\.sh"/);
		assert.doesNotMatch(manifest, /\b(?:token|secret|password)\b/i);
	});

	test("contains no absolute tracked symlink targets", () => {
		const result = spawnSync("git", ["ls-files", "--stage", "-z"], {
			cwd: repositoryRoot,
			encoding: "utf8",
			shell: false,
		});
		assert.strictEqual(result.status, 0, result.stderr);
		const deletedResult = spawnSync("git", ["ls-files", "--deleted", "-z"], {
			cwd: repositoryRoot,
			encoding: "utf8",
			shell: false,
		});
		assert.strictEqual(deletedResult.status, 0, deletedResult.stderr);
		const deletedPaths = new Set(
			deletedResult.stdout.split("\0").filter((value) => value.length > 0),
		);

		for (const record of result.stdout.split("\0")) {
			if (record.length === 0 || !record.startsWith("120000 ")) continue;
			const separatorIndex = record.indexOf("\t");
			assert.notStrictEqual(separatorIndex, -1, `invalid Git index record: ${record}`);
			const trackedPath = record.slice(separatorIndex + 1);
			if (deletedPaths.has(trackedPath)) continue;
			const target = readlinkSync(path.join(repositoryRoot, trackedPath));
			assert.strictEqual(
				path.isAbsolute(target),
				false,
				`${trackedPath} has an absolute symlink target: ${target}`,
			);
		}
	});

	test("emits the downloaded repository root through GITHUB_OUTPUT", (t) => {
		const temporaryDirectory = mkdtempSync(
			path.join(tmpdir(), "dotagents-platform-action-"),
		);
		t.after(() => rmSync(temporaryDirectory, { force: true, recursive: true }));
		const outputPath = path.join(temporaryDirectory, "github-output");
		const result = spawnSync("/bin/bash", [locatorPath], {
			encoding: "utf8",
			env: { ...process.env, GITHUB_OUTPUT: outputPath },
			shell: false,
		});

		assert.strictEqual(result.status, 0, result.stderr);
		assert.strictEqual(
			readFileSync(outputPath, "utf8"),
			`platform-root=${repositoryRoot}\n`,
		);
	});
});
