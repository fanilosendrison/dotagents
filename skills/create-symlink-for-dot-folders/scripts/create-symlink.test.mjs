import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readlinkSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
	new URL("./create-symlink.mjs", import.meta.url),
);
let testEnvironment = "";
let targetDirectory = "";
let symlinkPath = "";
let backupPaths = [];

describe("create-symlink.mjs", () => {
	beforeEach(() => {
		testEnvironment = mkdtempSync(join(tmpdir(), "create symlink é-"));
		targetDirectory = join(testEnvironment, "real_target");
		symlinkPath = join(testEnvironment, "fake_symlink");
		backupPaths = [];
	});

	afterEach(() => {
		if (testEnvironment.length > 0) {
			rmSync(testEnvironment, { force: true, recursive: true });
		}
		for (const backupPath of backupPaths) {
			rmSync(backupPath, { force: true, recursive: true });
		}
	});

	function runScript() {
		const result = spawnSync(
			process.execPath,
			[scriptPath, targetDirectory, symlinkPath],
			{
				encoding: "utf8",
				env: {
					...process.env,
					TEMP: testEnvironment,
					TMP: testEnvironment,
					TMPDIR: testEnvironment,
				},
			},
		);
		if (result.error) throw result.error;
		for (const match of result.stdout.matchAll(
			/Backing up existing (?:directory|file) to (.+)$/gm,
		)) {
			const backupPath = match[1];
			if (backupPath !== undefined) backupPaths.push(backupPath);
		}
		return result;
	}

	it("creates a symlink when nothing exists", () => {
		const result = runScript();
		assert.equal(result.status, 0, result.stderr);

		assert.equal(existsSync(targetDirectory), true);
		assert.equal(lstatSync(targetDirectory).isDirectory(), true);
		assert.equal(lstatSync(symlinkPath).isSymbolicLink(), true);
		assert.equal(readlinkSync(symlinkPath), targetDirectory);
	});

	it("backs up an existing file", () => {
		writeFileSync(symlinkPath, "Hello World");

		const result = runScript();
		assert.equal(result.status, 0, result.stderr);
		assert.equal(lstatSync(symlinkPath).isSymbolicLink(), true);
		assert.equal(existsSync(targetDirectory), true);

		const movedFile = join(targetDirectory, "fake_symlink");
		assert.equal(existsSync(movedFile), true);
		assert.equal(readFileSync(movedFile, "utf8"), "Hello World");
	});

	it("backs up an existing directory", () => {
		mkdirSync(symlinkPath);
		writeFileSync(join(symlinkPath, "test1.txt"), "File 1");
		writeFileSync(join(symlinkPath, "test2.txt"), "File 2");

		const result = runScript();
		assert.equal(result.status, 0, result.stderr);
		assert.equal(lstatSync(symlinkPath).isSymbolicLink(), true);
		assert.equal(existsSync(join(targetDirectory, "test1.txt")), true);
		assert.equal(
			readFileSync(join(targetDirectory, "test1.txt"), "utf8"),
			"File 1",
		);
		assert.equal(existsSync(join(targetDirectory, "test2.txt")), true);
	});

	it("does nothing if symlink is already correct", () => {
		mkdirSync(targetDirectory);
		symlinkSync(targetDirectory, symlinkPath);

		const result = runScript();
		assert.equal(result.status, 0, result.stderr);
		assert.match(result.stdout, /Doing nothing/);
		assert.equal(lstatSync(symlinkPath).isSymbolicLink(), true);
	});

	it("replaces a wrong symlink", () => {
		const wrongTarget = join(testEnvironment, "wrong_target");
		mkdirSync(wrongTarget);
		symlinkSync(wrongTarget, symlinkPath);

		const result = runScript();
		assert.equal(result.status, 0, result.stderr);
		assert.equal(lstatSync(symlinkPath).isSymbolicLink(), true);
		assert.equal(readlinkSync(symlinkPath), targetDirectory);
	});
});
