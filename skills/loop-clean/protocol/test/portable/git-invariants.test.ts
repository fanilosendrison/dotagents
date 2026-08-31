import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, describe, test } from "node:test";
import { captureGitInvariants } from "../../src/git/capture-invariants.ts";
import { verifyGitInvariants } from "../../src/git/verify-invariants.ts";
import {
	createRepository,
	removeRepository,
	runGit,
	writeRepositoryFile,
} from "../helpers/git-fixture.ts";

const repositories: string[] = [];

afterEach(async () => {
	for (const root of repositories.splice(0)) await removeRepository(root);
});

describe("Git invariants", () => {
	test("captures and verifies unchanged HEAD and raw index bytes", async () => {
		const root = await createRepository();
		repositories.push(root);
		const baseline = await captureGitInvariants(root);
		assert.match(baseline.head, /^[0-9a-f]{40}$/);
		assert.match(baseline.index_digest, /^[0-9a-f]{64}$/);
		await assert.deepStrictEqual(await verifyGitInvariants(root, baseline), {
			head_changed: false,
			index_changed: false,
		});
	});

	test("reports HEAD changes without restoring them", async () => {
		const root = await createRepository();
		repositories.push(root);
		const baseline = await captureGitInvariants(root);
		await writeRepositoryFile(root, "new-commit.txt", "new commit\n");
		await runGit(root, ["add", "new-commit.txt"]);
		await runGit(root, ["commit", "--quiet", "-m", "mutated head"]);
		await assert.rejects(verifyGitInvariants(root, baseline), /HEAD changed/);
		assert.strictEqual(
			await readFile(`${root}/new-commit.txt`, "utf8"),
			"new commit\n",
		);
	});

	test("reports index changes without restoring them", async () => {
		const root = await createRepository();
		repositories.push(root);
		const baseline = await captureGitInvariants(root);
		await writeRepositoryFile(root, "staged.txt", "staged\n");
		await runGit(root, ["add", "staged.txt"]);
		await assert.rejects(verifyGitInvariants(root, baseline), /index changed/);
		assert.ok(
			(await runGit(root, ["diff", "--cached", "--name-only"])).includes(
				"staged.txt",
			),
		);
	});

	test("uses UNBORN for a repository without an initial commit", async () => {
		const root = await createRepository({ withBaseline: false });
		repositories.push(root);
		const baseline = await captureGitInvariants(root);
		assert.strictEqual(baseline.head, "UNBORN");
		await assert.partialDeepStrictEqual(
			await verifyGitInvariants(root, baseline),
			{
				head_changed: false,
			},
		);
	});
});
