import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const [dir] = process.argv.slice(2);

const files = readdirSync(dir).filter((f: string) =>
  f.startsWith("classified-") && f.endsWith(".json")
);

const allRequirements: any[] = [];

for (const f of files) {
  const data = JSON.parse(readFileSync(join(dir, f), "utf-8"));
  for (const req of data.requirements) {
    allRequirements.push({
      document: data.document,
      ...req,
    });
  }
}

const output = { requirements: allRequirements };
const outPath = join(dir, "all-classified.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(outPath);
