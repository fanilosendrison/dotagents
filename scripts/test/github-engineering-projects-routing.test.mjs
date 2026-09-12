import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const agentsRoot = path.resolve(import.meta.dirname, "../..");

async function read(relativePath) {
  return await readFile(path.join(agentsRoot, relativePath), "utf8");
}

describe("GitHub Engineering Projects routing", () => {
  it("keeps the operational core compact and free of embedded GraphQL", async () => {
    const core = await read("operational-rules/github-engineering-projects.md");
    assert.ok(core.split("\n").length <= 120);
    assert.doesNotMatch(core, /query\s*\(/);
    assert.doesNotMatch(core, /set_engineering_project_single_select/);
  });

  it("routes one skill to three conditional contexts", async () => {
    const skill = await read("skills/github-engineering-projects/SKILL.md");
    for (const context of [
      "01-inspect-project/CONTEXT.md",
      "02-manage-item-lifecycle/CONTEXT.md",
      "03-create-or-reuse-issue/CONTEXT.md",
    ]) {
      assert.match(skill, new RegExp(context.replace(/[./]/g, "\\$&")));
      await read(`skills/github-engineering-projects/${context}`);
    }
    assert.match(skill, /operational-rules\/github-engineering-projects\.md/);
  });

  it("routes global Engineering Project work to the skill", async () => {
    const agents = await read("AGENTS.md");
    assert.match(agents, /\/github-engineering-projects/);
  });
});
