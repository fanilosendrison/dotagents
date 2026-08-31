import type { FacadeEntry } from "./types.ts";

/**
 * Canonical manifest of all Claude Code facade entries.
 *
 * - `source`: path relative to `$HOME/.agents`
 * - `destination`: path relative to `$HOME/.claude`
 *
 * This is the SINGLE SOURCE OF TRUTH. Do not duplicate this list elsewhere.
 * The gitignore validator and installer both derive their work from this manifest.
 */
export const FACADE_ENTRIES: readonly FacadeEntry[] = [
	// ── Skills ──────────────────────────────────────────────
	{
		source: "skills/loop-clean",
		destination: "skills/loop-clean",
		kind: "directory",
	},
	{
		source: "skills/coding-standards",
		destination: "skills/coding-standards",
		kind: "directory",
	},
	{
		source: "skills/senior-review",
		destination: "skills/senior-review",
		kind: "directory",
	},
	{
		source: "skills/dedup-codebase",
		destination: "skills/dedup-codebase",
		kind: "directory",
	},
	{
		source: "skills/fix-or-backlog",
		destination: "skills/fix-or-backlog",
		kind: "directory",
	},

	// ── Agents ──────────────────────────────────────────────
	{
		source: "agents/loop-clean-orchestrator.md",
		destination: "agents/loop-clean-orchestrator.md",
		kind: "file",
	},
	{
		source: "agents/coding-standards-file.md",
		destination: "agents/coding-standards-file.md",
		kind: "file",
	},
	{
		source: "agents/dedup-inter.md",
		destination: "agents/dedup-inter.md",
		kind: "file",
	},
	{
		source: "agents/dedup-intra.md",
		destination: "agents/dedup-intra.md",
		kind: "file",
	},
	{
		source: "agents/fix-file.md",
		destination: "agents/fix-file.md",
		kind: "file",
	},
	{
		source: "agents/senior-review-file.md",
		destination: "agents/senior-review-file.md",
		kind: "file",
	},

	// ── Scripts ─────────────────────────────────────────────
	{
		source: "scripts/coding-standards-scanner",
		destination: "scripts/coding-standards-scanner",
		kind: "directory",
	},
	{
		source: "scripts/coding-standards-consolidate",
		destination: "scripts/coding-standards-consolidate",
		kind: "directory",
	},
	{
		source: "scripts/lib/coding-standards-schema",
		destination: "scripts/lib/coding-standards-schema",
		kind: "directory",
	},
	{
		source: "scripts/lib/stack-tools",
		destination: "scripts/lib/stack-tools",
		kind: "directory",
	},
];
