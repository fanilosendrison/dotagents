import * as fs from "node:fs";

const content = fs.readFileSync("/Users/famillesendrison/Developper/Projects/dotagents/skills/git-commits-push/tests/acceptance/a1-initial-run.test.ts", "utf-8");
const spawnSplits = content.split("spawnSync");
for (let i = 1; i < spawnSplits.length; i++) {
    const block = spawnSplits[i];
    console.log(`Block ${i}: includes SKILL=${block.includes("SKILL_ENTRYPOINT")}, includes env=${block.includes("...env.env()")}`);
}
