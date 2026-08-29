import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CODE_EXTENSIONS,
	isCodeFile,
	isLinterCompatible,
	LINTER_EXTENSIONS,
} from "../extensions.ts";

describe("CODE_EXTENSIONS", () => {
	it("contains all expected extensions", () => {
		const expected = [".py", ".ts", ".tsx", ".js", ".jsx", ".sh", ".bash"];
		for (const ext of expected) {
			assert.strictEqual(CODE_EXTENSIONS.has(ext), true);
		}
	});

	it("does not contain non-code extensions", () => {
		const notCode = [".md", ".json", ".yaml", ".html", ".css", ".txt"];
		for (const ext of notCode) {
			assert.strictEqual(CODE_EXTENSIONS.has(ext), false);
		}
	});
});

describe("LINTER_EXTENSIONS", () => {
	it("biome supports JS/TS extensions", () => {
		assert.strictEqual(LINTER_EXTENSIONS.biome.has(".ts"), true);
		assert.strictEqual(LINTER_EXTENSIONS.biome.has(".tsx"), true);
		assert.strictEqual(LINTER_EXTENSIONS.biome.has(".js"), true);
		assert.strictEqual(LINTER_EXTENSIONS.biome.has(".jsx"), true);
		assert.strictEqual(LINTER_EXTENSIONS.biome.has(".py"), false);
	});

	it("ruff supports .py only", () => {
		assert.strictEqual(LINTER_EXTENSIONS.ruff.has(".py"), true);
		assert.strictEqual(LINTER_EXTENSIONS.ruff.has(".ts"), false);
	});

	it("shellcheck supports .sh and .bash", () => {
		assert.strictEqual(LINTER_EXTENSIONS.shellcheck.has(".sh"), true);
		assert.strictEqual(LINTER_EXTENSIONS.shellcheck.has(".bash"), true);
		assert.strictEqual(LINTER_EXTENSIONS.shellcheck.has(".ts"), false);
	});
});

describe("isCodeFile", () => {
	it("returns true for code files", () => {
		assert.strictEqual(isCodeFile("/project/src/main.ts"), true);
		assert.strictEqual(isCodeFile("/project/app.py"), true);
		assert.strictEqual(isCodeFile("/project/script.sh"), true);
		assert.strictEqual(isCodeFile("/project/Component.tsx"), true);
		assert.strictEqual(isCodeFile("/project/index.js"), true);
		assert.strictEqual(isCodeFile("/project/build.bash"), true);
	});

	it("returns false for non-code files", () => {
		assert.strictEqual(isCodeFile("/project/README.md"), false);
		assert.strictEqual(isCodeFile("/project/config.json"), false);
		assert.strictEqual(isCodeFile("/project/style.css"), false);
		assert.strictEqual(isCodeFile("/project/index.html"), false);
		assert.strictEqual(isCodeFile("/project/data.yaml"), false);
	});

	it("handles case insensitivity", () => {
		assert.strictEqual(isCodeFile("/project/main.TS"), true);
		assert.strictEqual(isCodeFile("/project/app.PY"), true);
	});
});

describe("isLinterCompatible", () => {
	it("biome is compatible with TS/JS files", () => {
		assert.strictEqual(isLinterCompatible("biome", "file.ts"), true);
		assert.strictEqual(isLinterCompatible("biome", "file.jsx"), true);
	});

	it("biome is not compatible with Python files", () => {
		assert.strictEqual(isLinterCompatible("biome", "file.py"), false);
	});

	it("ruff is compatible with Python files", () => {
		assert.strictEqual(isLinterCompatible("ruff", "file.py"), true);
	});

	it("ruff is not compatible with TS files", () => {
		assert.strictEqual(isLinterCompatible("ruff", "file.ts"), false);
	});

	it("unknown linter returns true (try anyway)", () => {
		assert.strictEqual(isLinterCompatible("unknown-linter", "file.ts"), true);
		assert.strictEqual(isLinterCompatible("unknown-linter", "file.py"), true);
	});
});
