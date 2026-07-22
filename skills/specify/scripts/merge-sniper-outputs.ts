import { readFileSync, writeFileSync } from "fs";
import { basename, join } from "path";

const [dir, doc] = process.argv.slice(2);

const fs = require("fs");
const files = fs.readdirSync(dir).filter((f: string) =>
  f.startsWith("sniper-") && f.includes(doc) && f.endsWith(".json")
);

const reports: Record<string, any[]> = {};
const allSlugs = new Set<string>();

for (const f of files) {
  const sniperId = basename(f).split("-")[1];
  const data = JSON.parse(readFileSync(join(dir, f), "utf-8"));
  reports[sniperId] = data;
  for (const e of data) {
    if (e.req_slug) allSlugs.add(e.req_slug);
  }
}

const reqPath = join(dir, `requirements-${doc}.json`);
const requirements = JSON.parse(readFileSync(reqPath, "utf-8"));
const quoteMap: Record<string, string> = {};
for (const r of requirements) {
  quoteMap[r.req_slug] = r.quote;
}

const rows: any[] = [];
for (const slug of [...allSlugs].sort()) {
  const row: any = { req_slug: slug, lines: null, quote: quoteMap[slug] || null, parent: null, snipers: {}, findings: {} };
  for (const [sid, data] of Object.entries(reports)) {
    const match = data.find((e: any) => e.req_slug === slug);
    if (match) {
      row.lines = row.lines || match.lines;
      row.snipers[sid] = match.verdict || "—";
      if (match.finding) row.findings[sid] = match.finding;
    } else {
      row.snipers[sid] = "—";
    }
  }
  rows.push(row);
}

const output = { document: doc, requirements: rows };
const outPath = join(dir, `merged-${doc}.json`);
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(outPath);
