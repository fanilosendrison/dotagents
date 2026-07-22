import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const [dir, doc] = process.argv.slice(2);

const input = JSON.parse(
  readFileSync(join(dir, `deduped-${doc}.json`), "utf-8")
);

for (const req of input.requirements) {
  const failKeys = Object.entries(req.snipers)
    .filter(([_, verdict]) => verdict === "FAIL")
    .map(([key]) => key);

  if (failKeys.length === 0) {
    req.status = "TDD_READY";
  } else if (failKeys.includes("8")) {
    req.status = "SPEC_CONFLICT";
  } else if (failKeys.includes("5")) {
    req.status = "SPEC_AMBIGUITY";
  } else {
    req.status = "SPEC_GAP";
  }
}

const outPath = join(dir, `classified-${doc}.json`);
writeFileSync(outPath, JSON.stringify(input, null, 2));
console.log(outPath);
