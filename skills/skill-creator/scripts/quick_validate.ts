#!/usr/bin/env bun
/**
 * Skill validation — structural checks + content quality + cross-references
 *
 * Usage: bun quick_validate.ts <skill_directory>
 */

import { readFileSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { readdirSync, statSync } from "node:fs";

// ── Minimal YAML frontmatter parser ──

function parseFrontmatter(text: string): Record<string, unknown> | null {
  const lines = text.split("\n");
  const result: Record<string, unknown> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Multiline continuation (indented)
    if (i > 0 && (line.startsWith(" ") || line.startsWith("\t"))) {
      // Simple indented continuation: append to previous key's value
      const prevKey = Object.keys(result).at(-1);
      if (prevKey && typeof result[prevKey] === "string") {
        result[prevKey] += " " + trimmed;
      }
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Unquoted empty
    if (value === "") {
      result[key] = "";
      continue;
    }

    // Quoted strings
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      result[key] = value.slice(1, -1);
      continue;
    }

    result[key] = value;
  }

  return Object.keys(result).length > 0 ? result : null;
}

// ── Constants ──

const TEMPLATE_MARKERS = [
  "[TODO: Complete and informative explanation",
  "[TODO: Choose the structure",
  "[TODO: 1-2 sentences explaining",
  "[TODO: Replace with the first main section",
  "[TODO: Add content here",
  'Delete this entire "Structuring This Skill" section',
];

const EXAMPLE_FILE_MARKERS: Record<string, string> = {
  "scripts/example.py": "This is a placeholder script",
  "references/api_reference.md": "This is a placeholder for detailed reference",
  "assets/example_asset.txt": "This placeholder represents where asset files",
};

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

function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, "");
}

function findFileReferences(body: string): Set<string> {
  const clean = stripCodeBlocks(body);
  const pattern = /(?:scripts|references|assets)\/[\w._/-]+/g;
  return new Set(clean.match(pattern) ?? []);
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

  const frontmatter = parseFrontmatter(frontmatterText);
  if (!frontmatter) {
    return { errors: ["Frontmatter must be a YAML dictionary"], warnings: [] };
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

  // Referenced files not found (warning, not error)
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
      if (!referencedFiles.has(rel)) {
        warnings.push(`Unreferenced file: ${rel}`);
      }
    }
  }

  // Uncustomized example files
  for (const [exampleFile, marker] of Object.entries(EXAMPLE_FILE_MARKERS)) {
    const filePath = join(skillPath, exampleFile);
    if (existsSync(filePath)) {
      const fileContent = readFileSync(filePath, "utf-8");
      if (fileContent.includes(marker)) {
        warnings.push(`Uncustomized template file: ${exampleFile}`);
      }
    }
  }

  return { errors, warnings };
}

// ── CLI ──

if (import.meta.main) {
  const args = Bun.argv.slice(2); // Bun.argv[0] = bun, [1] = script path
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
