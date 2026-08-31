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
	wiring: string;
	trigger: string;
}

export interface DocEntry {
	name: string;
	desc: string;
}

// ── validation ───────────────────────────────────────────────

export function validateInput(inp: Record<string, unknown>): string | null {
	const required = [
		"topic",
		"title",
		"description",
		"action",
		"date",
		"content",
	];
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
	const max = Math.max(...matches.map((m) => parseInt(m[1])));
	return max + 1;
}

/** Format a single index entry with backtick-escaped topic path. */
export function formatIndexEntry(
	num: number,
	title: string,
	date: string,
	topic: string,
	wiring?: string,
	trigger?: string,
): string {
	let entry =
		`\n### ${num}. ${title}\n` +
		`- **Date** : ${date}\n` +
		`- **Doc** : [\`${topic}.md\`](${topic}.md)\n`;
	if (wiring) {
		entry += `- **Wiring** : ${wiring}\n`;
	}
	if (trigger) {
		entry += `- **Trigger** : ${trigger}\n`;
	}
	return entry;
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
export function parseDocEntries(sectionLines: string[]): {
	header: string[];
	entries: DocEntry[];
} {
	const header: string[] = [];
	const entries: DocEntry[] = [];

	let i = 0;

	// Collect header lines (before first folder entry)
	while (i < sectionLines.length) {
		if (/^│ {3}[├└]── .+\.md/.test(sectionLines[i])) break;
		header.push(sectionLines[i]);
		i++;
	}

	// Collect entry pairs
	while (i < sectionLines.length) {
		const m = sectionLines[i].match(/^│ {3}[├└]── (.+?)\.md\s*(← .*)?$/);
		if (!m) {
			i++;
			continue;
		}
		const name = m[1].trim();
		let desc = "";
		if (m[2]) {
			const dm = m[2].match(/← (.+)$/);
			if (dm) desc = dm[1].trim();
		}
		entries.push({ name, desc });
		i += 1;
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
	const maxLen = Math.max(...entries.map((e) => e.name.length));

	entries.forEach(({ name, desc }, idx) => {
		const last = idx === entries.length - 1;
		const branch = last ? "└──" : "├──";
		const pad = " ".repeat(maxLen - name.length);
		rebuilt.push(`│   ${branch} ${name}.md ${pad} ← ${desc}`);
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
	entries.sort((a, b) =>
		a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
	);

	const newBlock = buildDocTree(lines[section.start], header, entries);

	return [
		...lines.slice(0, section.start),
		...newBlock,
		...lines.slice(section.end),
	].join("\n");
}
