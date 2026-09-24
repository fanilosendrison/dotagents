import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const actionDirectory = path.join(
	repositoryRoot,
	"scripts/dotagents-platform-action",
);
const actionManifestPath = path.join(actionDirectory, "action.yml");
const locatorPath = path.join(actionDirectory, "locate-platform-root.sh");

describe("private dotagents platform action", () => {
	test("declares a credential-free composite action", () => {
		const manifest = readFileSync(actionManifestPath, "utf8");

		assert.match(manifest, /^name: Dotagents platform$/m);
		assert.match(manifest, /^  platform-root:$/m);
		assert.match(manifest, /^  using: composite$/m);
		assert.match(manifest, /"\$GITHUB_ACTION_PATH\/locate-platform-root\.sh"/);
		assert.doesNotMatch(manifest, /\b(?:token|secret|password)\b/i);
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
