import { readFileSync } from "fs";

const [reqFile, outFile] = process.argv.slice(2);
const reqs = JSON.parse(readFileSync(reqFile, "utf-8"));
const out = JSON.parse(readFileSync(outFile, "utf-8"));
const outSlugs = new Set(out.filter((e: any) => e.req_slug).map((e: any) => e.req_slug));

for (const r of reqs) {
  if (!outSlugs.has(r.req_slug)) {
    console.log(JSON.stringify(r));
  }
}
