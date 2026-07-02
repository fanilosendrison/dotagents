/**
 * Pure functions for bootstrap-docs. No filesystem, no I/O.
 * Every function takes strings/lines and returns strings/lines.
 * Import in tests for unit coverage; used by bootstrap-docs CLI.
 */

// ── types ────────────────────────────────────────────────────

export interface Input {
  topic: string;
  title: string;
  description: string;
  action: string;
  date: string;
  content: string;
}

export interface DocEntry {
  name: string;
  desc: string;
}

export interface DocSection {
  docLine: string;
  header: string[];
  entries: DocEntry[];
}

// ── validation ───────────────────────────────────────────────

export function validateInput(inp: Record<string, unknown>): string | null {
  const required = ["topic", "title", "description", "action", "date", "content"];
  for (const key of required) {
    const val = inp[key];
    if (!val || (typeof val === "string" && !val.trim())) {
      return `field "${key}" is required and must not be empty`;
    }
  }
  return null; // valid
}

// ── docs index ───────────────────────────────────────────────

/** Parse the next entry number from the docs index content. */
export function computeNextIndex(indexContent: string): number {
  const matches = [...indexContent.matchAll(/### (\d+)\./g)];
  if (matches.length === 0) return 1;
  const max = Math.max(...matches.map(m => parseInt(m[1])));
  return max + 1;
}

/** Format a single index entry with backtick-escaped topic path. */
export function formatIndexEntry(
  num: number,
  title: string,
  date: string,
  topic: string,
): string {
  return (
    `\n### ${num}. ${title}\n` +
    `- **Date** : ${date}\n` +
    `- **Doc** : [\`${topic}.md\`](${topic}.md)\n`
  );
}

// ── Quick Navigation ─────────────────────────────────────────

/** Format a single Quick Navigation table row. */
export function formatQuickNavRow(
  action: string,
  topic: string,
  description: string,
): string {
  return `| ${action} | \`docs/${topic}.md\` (${description}) |`;
}

/**
 * Insert a row into the Quick Navigation table, right before
 * the `## Skills` heading. Falls back to appending at end of
 * file if the heading is absent.
 */
export function insertQuickNavRow(
  routerContent: string,
  row: string,
): string {
  // Prefer inserting before the blank line that precedes ## Skills
  let idx = routerContent.lastIndexOf("\n\n## Skills");
  if (idx !== -1) {
    return routerContent.slice(0, idx + 1) + row + "\n" + routerContent.slice(idx + 1);
  }
  // Fallback: no blank line — preserve trailing newline of previous content
  idx = routerContent.lastIndexOf("\n## Skills");
  if (idx !== -1) {
    return routerContent.slice(0, idx + 1) + row + "\n" + routerContent.slice(idx + 1);
  }
  return routerContent + "\n" + row + "\n";
}

// ── Folder Structure tree ────────────────────────────────────

/** Locate the docs/ block in the Folder Structure tree. */
export function findDocsSection(
  lines: string[],
): { start: number; end: number } | null {
  let start = -1;
  let end = -1;

  for (let i = 0; i < lines.length; i++) {
    if (start === -1) {
      if (/^[├└]── docs\//.test(lines[i])) start = i;
    } else {
      if (/^[├└]── /.test(lines[i]) && i > start) {
        end = i;
        break;
      }
    }
  }

  if (start === -1) return null;
  if (end === -1) end = lines.length;
  return { start, end };
}

/**
 * Parse lines under the docs/ block into header lines (non-entry,
 * like CONTEXT.md index) and entry pairs (folder + description).
 */
export function parseDocEntries(
  sectionLines: string[],
): { header: string[]; entries: DocEntry[] } {
  const header: string[] = [];
  const entries: DocEntry[] = [];

  let i = 0;

  // Collect header lines (before first file entry)
  while (i < sectionLines.length) {
    if (/^│   [├└]── .+\.md\s*(?:←|$)/.test(sectionLines[i]) && !sectionLines[i].includes("CONTEXT.md")) break;
    header.push(sectionLines[i]);
    i++;
  }

  // Collect entry pairs
  while (i < sectionLines.length) {
    const m = sectionLines[i].match(/^│   [├└]── (.+?)\.md(?:\s*← (.*))?$/);
    if (!m || sectionLines[i].includes("CONTEXT.md")) {
      i++;
      continue;
    }
    const name = m[1].trim();
    const desc = m[2] ? m[2].trim() : "";
    entries.push({ name, desc });
    i++;
  }

  return { header, entries };
}

/**
 * Rebuild the docs/ tree block with correct box-drawing characters.
 * `docLine` is the original `├── docs/` line.
 * `entries` must be sorted alphabetically.
 */
export function buildDocTree(
  docLine: string,
  header: string[],
  entries: DocEntry[],
): string[] {
  const rebuilt: string[] = [];

  let maxNameLen = 0;
  entries.forEach(({ name }) => {
    if (name.length > maxNameLen) maxNameLen = name.length;
  });

  entries.forEach(({ name, desc }, idx) => {
    const last = idx === entries.length - 1;
    const branch = last ? "└──" : "├──";
    const paddedName = (name + ".md").padEnd(maxNameLen + 4);
    rebuilt.push(`│   ${branch} ${paddedName} ← ${desc}`);
  });

  return [docLine, ...header, ...rebuilt];
}

/**
 * Full pipeline: find the docs/ section, insert a new entry
 * alphabetically, rebuild the tree, and splice it back into
 * the router content. Returns the updated router string.
 */
export function insertFolderEntry(
  routerContent: string,
  topic: string,
  description: string,
): string {
  const lines = routerContent.split("\n");

  const section = findDocsSection(lines);
  if (!section) {
    throw new Error("docs/ section not found in Folder Structure tree");
  }

  const sectionLines = lines.slice(section.start + 1, section.end);
  const { header, entries } = parseDocEntries(sectionLines);

  entries.push({ name: topic, desc: description });
  entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const newBlock = buildDocTree(lines[section.start], header, entries);

  return [
    ...lines.slice(0, section.start),
    ...newBlock,
    ...lines.slice(section.end),
  ].join("\n");
}
