#!/usr/bin/env bun
/**
 * Skill validation — structural checks + content quality + cross-references
 *
 * Usage: bun quick_validate.ts <skill_directory>
 */

import { readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readdirSync, statSync } from "node:fs";
import yaml from "js-yaml";

// ── Constants ──

const TEMPLATE_MARKERS = [
  "[TODO: Complete and informative explanation",
  "[TODO: Choose the structure",
  "[TODO: 1-2 sentences explaining",
  "[TODO: Replace with the first main section",
  "[TODO: Add content here",
  'Delete this entire "Structuring This Skill" section',
];

const ALLOWED_PROPERTIES = new Set([
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
  "compatibility",
  "disable-model-invocation",
]);

// ── Helpers ──

/** Strip fenced code blocks (```...```) to avoid false positives. */
function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "");
}

/**
 * Find resource paths referenced via actual markdown links: [text](scripts/foo.py).
 * Ignores bare paths in prose examples that aren't real links.
 */
function findFileReferences(body: string): Set<string> {
  const clean = stripCodeBlocks(body);
  const linkPattern = /\[[^\]]*\]\((scripts|references|assets)\/[\w._\-\/]+\)/g;
  const refs = new Set<string>();

  for (const match of clean.matchAll(linkPattern)) {
    // match[0] = "[text](scripts/foo.py)", match[1] = "scripts"
    const url = match[0].slice(match[0].indexOf("(") + 1, -1);
    refs.add(url);
  }
  return refs;
}

function walkFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...walkFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

type ValidationResult = {
  errors: string[];
  warnings: string[];
};

// ── Main validator ──

function validateSkillFull(skillPath: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── Structural checks ──

  const skillMd = join(skillPath, "SKILL.md");
  if (!existsSync(skillMd)) {
    return { errors: ["SKILL.md not found"], warnings: [] };
  }

  const content = readFileSync(skillMd, "utf-8");
  if (!content.startsWith("---")) {
    return { errors: ["No YAML frontmatter found"], warnings: [] };
  }

  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return { errors: ["Invalid frontmatter format"], warnings: [] };
  }

  const frontmatterText = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length).trim();

  let frontmatter: Record<string, unknown>;
  try {
    frontmatter = yaml.load(frontmatterText) as Record<string, unknown>;
    if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
      return { errors: ["Frontmatter must be a YAML dictionary"], warnings: [] };
    }
  } catch (e: any) {
    return { errors: [`Invalid YAML in frontmatter: ${e.message}`], warnings: [] };
  }

  // Unexpected keys
  const unexpectedKeys = Object.keys(frontmatter).filter(
    (k) => !ALLOWED_PROPERTIES.has(k)
  );
  if (unexpectedKeys.length > 0) {
    errors.push(
      `Unexpected key(s) in frontmatter: ${unexpectedKeys.sort().join(", ")}. ` +
        `Allowed: ${[...ALLOWED_PROPERTIES].sort().join(", ")}`
    );
  }

  // Name validation
  const name = frontmatter["name"];
  if (!name) {
    errors.push("Missing 'name' in frontmatter");
  } else if (typeof name !== "string") {
    errors.push(`Name must be a string, got ${typeof name}`);
  } else {
    const trimmed = name.trim();
    if (!/^[a-z0-9-]+$/.test(trimmed)) {
      errors.push(
        `Name '${trimmed}' should be kebab-case (lowercase letters, digits, hyphens only)`
      );
    }
    if (trimmed.startsWith("-") || trimmed.endsWith("-") || trimmed.includes("--")) {
      errors.push(
        `Name '${trimmed}' cannot start/end with hyphen or contain consecutive hyphens`
      );
    }
    if (trimmed.length > 64) {
      errors.push(`Name too long (${trimmed.length} chars, max 64)`);
    }
  }

  // Description validation
  const description = frontmatter["description"];
  if (!description) {
    errors.push("Missing 'description' in frontmatter");
  } else if (typeof description !== "string") {
    errors.push(`Description must be a string, got ${typeof description}`);
  } else {
    const desc = description.trim();
    if (desc.includes("<") || desc.includes(">")) {
      errors.push("Description cannot contain angle brackets (< or >)");
    }
    if (desc.length > 1024) {
      errors.push(`Description too long (${desc.length} chars, max 1024)`);
    }
    if (desc.includes("TODO")) {
      errors.push("Description contains TODO marker — must be completed");
    }
  }

  // Compatibility validation (optional)
  const compatibility = frontmatter["compatibility"];
  if (compatibility) {
    if (typeof compatibility !== "string") {
      errors.push(`Compatibility must be a string, got ${typeof compatibility}`);
    } else if (compatibility.length > 500) {
      errors.push(`Compatibility too long (${compatibility.length} chars, max 500)`);
    }
  }

  // ── Content quality checks ──

  // TODO markers in body
  const todoMatches = body.match(/\[TODO:.*?\]/g);
  if (todoMatches && todoMatches.length > 0) {
    errors.push(
      `Body contains ${todoMatches.length} TODO marker(s) — ` +
        `first: "${todoMatches[0]}"`
    );
  }

  // Template body not customized
  const templateHits = TEMPLATE_MARKERS.filter((m) => content.includes(m));
  if (templateHits.length > 0) {
    errors.push(
      `Uncustomized template content (${templateHits.length} marker(s)). ` +
        `First: "${templateHits[0].slice(0, 60)}"`
    );
  }

  // Body too short
  if (body.length < 50) {
    errors.push(`Body too short (${body.length} chars) — add real content`);
  }

  // ── Cross-reference checks ──

  // Referenced files not found (warning, not error — prose examples trigger these)
  const referencedFiles = findFileReferences(body);
  for (const ref of [...referencedFiles].sort()) {
    if (!existsSync(join(skillPath, ref))) {
      warnings.push(`Referenced file not found: ${ref}`);
    }
  }

  // Orphan files in resource dirs
  for (const resourceDir of ["scripts", "references", "assets"]) {
    const dirPath = join(skillPath, resourceDir);
    if (!existsSync(dirPath)) continue;

    for (const filePath of walkFiles(dirPath)) {
      const rel = relative(skillPath, filePath);
      // Skip files referenced only via code blocks (e.g., quick_validate.ts in a ```bash block)
      if (!referencedFiles.has(rel)) {
        warnings.push(`Unreferenced file: ${rel}`);
      }
    }
  }

  return { errors, warnings };
}

// ── CLI ──

if (import.meta.main) {
  const args = Bun.argv.slice(2);
  if (args.length !== 1) {
    console.log("Usage: bun quick_validate.ts <skill_directory>");
    process.exit(1);
  }

  const { errors, warnings } = validateSkillFull(resolve(args[0]));

  for (const e of errors) {
    console.log(`  ✗ ${e}`);
  }
  for (const w of warnings) {
    console.log(`  ⚠ ${w}`);
  }

  if (errors.length > 0) {
    console.log(`\nFAIL — ${errors.length} error(s), ${warnings.length} warning(s)`);
    process.exit(1);
  } else if (warnings.length > 0) {
    console.log(`\nPASS — 0 errors, ${warnings.length} warning(s)`);
  } else {
    console.log("\nPASS — all checks OK");
  }
}
