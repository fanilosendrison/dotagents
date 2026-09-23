import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const agentsRoot = path.resolve(import.meta.dirname, "../..");

async function read(relativePath) {
  return await readFile(path.join(agentsRoot, relativePath), "utf8");
}

describe("Proto-Lithify routing", () => {
  it("routes one skill to three conditional contexts", async () => {
    const skill = await read("skills/proto-lithify/SKILL.md");
    for (const context of [
      "01-inspect-project/CONTEXT.md",
      "02-manage-item-lifecycle/CONTEXT.md",
      "03-create-or-reuse-issue/CONTEXT.md",
    ]) {
      assert.match(skill, new RegExp(context.replace(/[./]/g, "\\$&")));
      await read(`skills/proto-lithify/${context}`);
    }
  });

  it("integrates operational core directly in the skill", async () => {
    const skill = await read("skills/proto-lithify/SKILL.md");
    assert.match(skill, /Require a repository profile/);
    assert.match(skill, /Preserve technical authority/);
    assert.match(skill, /Resolve exact identities/);
    assert.match(skill, /Verify every mutation/);
    assert.doesNotMatch(skill, /operational-rules\/proto-lithify\.md/);
  });

  it("routes global Engineering Project work to the skill", async () => {
    const agents = await read("AGENTS.md");
    assert.match(agents, /\/proto-lithify/);
  });
});
