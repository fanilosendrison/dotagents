import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const [dir] = process.argv.slice(2);

const allClassified = JSON.parse(
  readFileSync(join(dir, "all-classified.json"), "utf-8")
);

const fixerResult = JSON.parse(
  readFileSync(join(dir, "fixer-result.json"), "utf-8")
);

const appliedIds = new Set(fixerResult.applied.map((f: any) => f.finding_id));

const cat2 = allClassified.requirements.filter(
  (r: any) => !appliedIds.has(r.req_slug)
);

const output = { requirements: cat2 };
const outPath = join(dir, "cat2-remaining.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(outPath);
