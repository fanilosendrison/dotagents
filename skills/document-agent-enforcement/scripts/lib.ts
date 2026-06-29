/**
 * Pure functions for bootstrap-enforcer-docs. No filesystem, no I/O.
 * Every function takes strings/lines and returns strings/lines.
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
    `- **Doc** : [\`${topic}/CONTEXT.md\`](${topic}/CONTEXT.md)\n`
  );
}
