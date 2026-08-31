import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
	mkdirSync,
	mkdtempSync,
	realpathSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateSkillFull } from "../src/quick-validate.mts";

const defaultCliPath = fileURLToPath(
	new URL("../src/quick-validate.mts", import.meta.url),
);
const validatorCliPath = process.env.SKILL_VALIDATOR_CLI ?? defaultCliPath;
const VALID_BODY = `# Instructions

Validate the complete skill structure and report every actionable issue before delivery.
`;

function createTemporaryDirectory(t, prefix = "quick validate ") {
	const directory = mkdtempSync(join(tmpdir(), prefix));
	t.after(() => rmSync(directory, { force: true, recursive: true }));
	return directory;
}

function writeFile(path, content) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, content, "utf8");
}

function writeSkill(t, options = {}) {
	const directory = createTemporaryDirectory(t);
	const frontmatter =
		options.frontmatter ??
		"name: valid-skill\ndescription: Validates a complete skill when preparing it for delivery.";
	const body = options.body ?? VALID_BODY;
	writeFile(join(directory, "SKILL.md"), `---\n${frontmatter}\n---\n\n${body}`);
	return directory;
}

function runCliAt(cliPath, args) {
	return spawnSync(process.execPath, [cliPath, ...args], {
		encoding: "utf8",
		env: process.env,
	});
}

function runCli(args) {
	return runCliAt(validatorCliPath, args);
}

describe("validateSkillFull", () => {
	test("reports a missing SKILL.md", (t) => {
		const directory = createTemporaryDirectory(t);
		assert.deepStrictEqual(validateSkillFull(directory), {
			errors: ["SKILL.md not found"],
			warnings: [],
		});
	});

	test("preserves structural frontmatter diagnostics", (t) => {
		const noFrontmatter = createTemporaryDirectory(t);
		writeFile(join(noFrontmatter, "SKILL.md"), VALID_BODY);
		assert.deepStrictEqual(validateSkillFull(noFrontmatter), {
			errors: ["No YAML frontmatter found"],
			warnings: [],
		});

		const unterminated = createTemporaryDirectory(t);
		writeFile(
			join(unterminated, "SKILL.md"),
			`---\nname: valid-skill\n${VALID_BODY}`,
		);
		assert.deepStrictEqual(validateSkillFull(unterminated), {
			errors: ["Invalid frontmatter format"],
			warnings: [],
		});

		const sequence = writeSkill(t, { frontmatter: "- not\n- a\n- dictionary" });
		assert.deepStrictEqual(validateSkillFull(sequence), {
			errors: ["Frontmatter must be a YAML dictionary"],
			warnings: [],
		});

		const malformed = writeSkill(t, {
			frontmatter: "name: valid-skill\ndescription: [broken",
		});
		const malformedResult = validateSkillFull(malformed);
		assert.equal(malformedResult.errors.length, 1);
		assert.match(malformedResult.errors[0], /^Invalid YAML in frontmatter: /);
		assert.deepStrictEqual(malformedResult.warnings, []);
	});

	test("reports sorted unexpected keys and every invalid scalar", (t) => {
		const directory = writeSkill(t, {
			frontmatter: [
				"z-extra: true",
				"a-extra: true",
				"name: 'Bad--name-'",
				"description: '<TODO>'",
				"compatibility: [node]",
			].join("\n"),
		});

		assert.deepStrictEqual(validateSkillFull(directory), {
			errors: [
				"Unexpected key(s) in frontmatter: a-extra, z-extra. Allowed: allowed-tools, compatibility, description, disable-model-invocation, license, metadata, name",
				"Name 'Bad--name-' should be kebab-case (lowercase letters, digits, hyphens only)",
				"Name 'Bad--name-' cannot start/end with hyphen or contain consecutive hyphens",
				"Description cannot contain angle brackets (< or >)",
				"Description contains TODO marker — must be completed",
				"Compatibility must be a string, got object",
			],
			warnings: [],
		});
	});

	test("reports missing and non-string frontmatter fields", (t) => {
		const missing = writeSkill(t, { frontmatter: "license: MIT" });
		assert.deepStrictEqual(validateSkillFull(missing).errors, [
			"Missing 'name' in frontmatter",
			"Missing 'description' in frontmatter",
		]);

		const typed = writeSkill(t, {
			frontmatter: "name: 42\ndescription: [invalid]\ncompatibility: [node]",
		});
		assert.deepStrictEqual(validateSkillFull(typed).errors, [
			"Name must be a string, got number",
			"Description must be a string, got object",
			"Compatibility must be a string, got object",
		]);
	});

	test("enforces name, description, and compatibility length limits", (t) => {
		const longName = "a".repeat(65);
		const longDescription = "d".repeat(1025);
		const longCompatibility = "c".repeat(501);
		const directory = writeSkill(t, {
			frontmatter: `name: ${longName}\ndescription: ${longDescription}\ncompatibility: ${longCompatibility}`,
		});

		assert.deepStrictEqual(validateSkillFull(directory).errors, [
			"Name too long (65 chars, max 64)",
			"Description too long (1025 chars, max 1024)",
			"Compatibility too long (501 chars, max 500)",
		]);
	});

	test("reports TODO markers, template content, and short bodies", (t) => {
		const body = "[TODO: Add content here]";
		const directory = writeSkill(t, { body });

		assert.deepStrictEqual(validateSkillFull(directory).errors, [
			'Body contains 1 TODO marker(s) — first: "[TODO: Add content here]"',
			'Uncustomized template content (1 marker(s)). First: "[TODO: Add content here"',
			`Body too short (${body.length} chars) — add real content`,
		]);
	});

	test("recognizes only markdown resource links outside fenced code", (t) => {
		const directory = writeSkill(t, {
			body: `${VALID_BODY}
Use [missing script](scripts/missing.mjs).
Mention references/bare.md only as prose.
\`\`\`markdown
[ignore fenced link](assets/fenced.txt)
\`\`\`
`,
		});

		assert.deepStrictEqual(validateSkillFull(directory), {
			errors: [],
			warnings: ["Referenced file not found: scripts/missing.mjs"],
		});
	});

	test("reports unreferenced resource files recursively", (t) => {
		const directory = writeSkill(t, {
			body: `${VALID_BODY}
Use the [documented script](scripts/documented.mjs).
`,
		});
		writeFile(join(directory, "scripts", "documented.mjs"), "export {};\n");
		writeFile(
			join(directory, "scripts", "nested", "orphan.mjs"),
			"export {};\n",
		);
		writeFile(join(directory, "references", "orphan.md"), "# Orphan\n");

		assert.deepStrictEqual(validateSkillFull(directory), {
			errors: [],
			warnings: [
				"Unreferenced file: scripts/nested/orphan.mjs",
				"Unreferenced file: references/orphan.md",
			],
		});
	});
});

describe("quick-validate CLI", () => {
	test("prints usage and exits 1 unless exactly one directory is supplied", () => {
		for (const args of [[], ["one", "two"]]) {
			const result = runCli(args);
			assert.equal(result.status, 1);
			assert.equal(result.signal, null);
			assert.equal(result.stdout, "Usage: quick-validate <skill_directory>\n");
			assert.equal(result.stderr, "");
		}
	});

	test("prints the exact success diagnostic and exits 0", (t) => {
		const directory = writeSkill(t);
		const result = runCli([directory]);

		assert.equal(result.status, 0);
		assert.equal(result.stdout, "\nPASS — all checks OK\n");
		assert.equal(result.stderr, "");
	});

	test("prints exact warnings while preserving exit code 0", (t) => {
		const directory = writeSkill(t, {
			body: `${VALID_BODY}\nUse [missing](scripts/missing.mjs).\n`,
		});
		const result = runCli([directory]);

		assert.equal(result.status, 0);
		assert.equal(
			result.stdout,
			"  ⚠ Referenced file not found: scripts/missing.mjs\n\nPASS — 0 errors, 1 warning(s)\n",
		);
		assert.equal(result.stderr, "");
	});

	test("prints exact errors and exits 1", (t) => {
		const directory = createTemporaryDirectory(t);
		const result = runCli([directory]);

		assert.equal(result.status, 1);
		assert.equal(
			result.stdout,
			"  ✗ SKILL.md not found\n\nFAIL — 1 error(s), 0 warning(s)\n",
		);
		assert.equal(result.stderr, "");
	});

	test("runs through a symlinked executable path", (t) => {
		const directory = writeSkill(t);
		const linkDirectory = createTemporaryDirectory(t, "quick validate link ");
		const cliLink = join(linkDirectory, "quick-validate.mts");
		symlinkSync(realpathSync(validatorCliPath), cliLink);

		const result = spawnSync(process.execPath, [cliLink, directory], {
			encoding: "utf8",
			env: process.env,
		});
		assert.equal(result.status, 0);
		assert.equal(result.stdout, "\nPASS — all checks OK\n");
		assert.equal(result.stderr, "");
	});
});
