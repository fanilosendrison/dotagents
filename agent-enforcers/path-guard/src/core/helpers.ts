import { realpathSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const MAX_ANCESTOR_DEPTH = 64;

export const PATH_FIELDS = [
  "file_path",
  "path",
  "TargetFile",
  "target_file",
  "filepath",
  "file",
];

/**
 * Resolve the real path, walking up to the first existing ancestor if the
 * target file doesn't exist yet (common for Write/Edit on new files).
 */
export function resolveReal(givenPath: string): string | null {
  try {
    return realpathSync(givenPath);
  } catch {
    let ancestor = givenPath.replace(/\/[^/]+$/, "") || "/";
    for (let i = 0; i < MAX_ANCESTOR_DEPTH; i++) {
      if (existsSync(ancestor)) break;
      const next = ancestor.replace(/\/[^/]+$/, "") || "/";
      if (next === ancestor) return null; // no progress, give up
      ancestor = next;
    }
    if (!existsSync(ancestor)) return null;
    const rel = givenPath.slice(ancestor.length + 1);
    return realpathSync(ancestor) + "/" + rel;
  }
}

/**
 * True when the path (absolute or ~/) targets a dot* repo, either directly
 * (~/Developper/Projects/dot*) or via its gateway (~/.pi/agent/, ~/.agents/).
 */
export function targetsDotRepo(givenPath: string): boolean {
  const expanded =
    givenPath === "~" || givenPath.startsWith("~/")
      ? homedir() + givenPath.slice(1)
      : givenPath;
  return (
    expanded.includes("/Developper/Projects/dot") ||
    /^dot[a-z]/.test(expanded) ||
    /\/\.(?:pi\/agent|agents|[a-z]+)(?:\/|$|\s)/.test(expanded)
  );
}

/**
 * Extract the dot* repo name from a path, e.g. "dotpi" or null.
 */
export function extractRepo(p: string): string | null {
  const expanded = p === "~" || p.startsWith("~/") ? homedir() + p.slice(1) : p;
  const direct = expanded.match(/\/Developper\/Projects\/(dot[a-z]+)/);
  if (direct) return direct[1];
  if (expanded.includes("/.pi/agent/")) return "dotpi";
  if (expanded.includes("/.agents/")) return "dotagents";
  const gateway = expanded.match(/\/\.([a-z]+)(?:\/|\s|$)/);
  if (gateway) return "dot" + gateway[1];
  return null;
}

/**
 * Parse path candidate list out of diff/patch payloads.
 */
export function collectPatchPaths(patchText: string): string[] {
  const paths = new Set<string>();
  for (const line of patchText.split(/\r?\n/)) {
    const explicitFile = line.match(
      /^\*\*\* (?:Add|Update|Delete) File: (.+)$/,
    );
    if (explicitFile?.[1]) {
      paths.add(explicitFile[1].trim());
      continue;
    }

    const movedFile = line.match(/^\*\*\* Move to: (.+)$/);
    if (movedFile?.[1]) {
      paths.add(movedFile[1].trim());
      continue;
    }

    const diffTarget = line.match(/^diff --git a\/.+ b\/(.+)$/);
    if (diffTarget?.[1]) {
      paths.add(diffTarget[1].trim());
    }
  }
  return [...paths];
}
