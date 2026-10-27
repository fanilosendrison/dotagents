import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

async function readRepositoryFile(relativePath) {
	return await readFile(path.join(repositoryRoot, relativePath), "utf8");
}

describe("Task Ledger producer contract", () => {
	test("routes every active ledger to the canonical producer contract", async () => {
		const agentDirectives = await readRepositoryFile("AGENTS.md");

		assert.match(
			agentDirectives,
			/When an in-session Task Ledger is active,[\s\S]*operational-rules\/code-implementation\.md/,
		);
		assert.match(
			agentDirectives,
			/A prose-only task-status statement never counts as a Task Ledger update\./,
		);
	});

	test("requires a parseable transition block before continuing work", async () => {
		const implementationRules = await readRepositoryFile(
			"operational-implementation-rules.md",
		);

		assert.match(
			implementationRules,
			/Every Task Ledger status transition MUST be emitted as a machine-parseable\s+Markdown block/,
		);
		assert.match(
			implementationRules,
			/Emit the transition block before status prose or the next tool call/,
		);
		assert.match(
			implementationRules,
			/\*\*Task Ledger update\*\*\n- `DONE` — T2\n- `IN_PROGRESS` — T3/,
		);
		assert.match(
			implementationRules,
			/Do not wrap the emitted Task Ledger block in a code fence/,
		);
		assert.match(
			implementationRules,
			/Emit a complete Task Ledger before the final completion report/,
		);
	});
});
