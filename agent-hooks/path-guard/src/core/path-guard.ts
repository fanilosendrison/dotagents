/**
 * Shared path-guard logic — used by both Pi extensions and agent hooks.
 *
 * Rule: any path under ~/Developper/Projects/dot<name>/ must be written
 * through ~/.<name>/, never directly. The pattern is derived automatically.
 */
import { realpathSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const PROJECTS = join(homedir(), "Developper", "Projects");

export interface PathGuardResult {
  allowed: boolean;
  /** The ~/.<name>/ gateway to use instead (only set when blocked). */
  gateway?: string;
  /** Human-readable reason for the block. */
  reason?: string;
}

/**
 * Resolve the real path, walking up to the first existing ancestor if the
 * target file doesn't exist yet (common for Write/Edit on new files).
 */
function resolveReal(givenPath: string): string | null {
  try {
    return realpathSync(givenPath);
  } catch {
    let ancestor = givenPath.replace(/\/[^/]+$/, "") || "/";
    while (ancestor && !existsSync(ancestor)) {
      ancestor = ancestor.replace(/\/[^/]+$/, "") || "/";
    }
    if (!ancestor || !existsSync(ancestor)) return null;
    const rel = givenPath.slice(ancestor.length + 1);
    return realpathSync(ancestor) + "/" + rel;
  }
}

/**
 * Extract candidate file paths from a bash command string.
 *
 * Looks for absolute paths, ~/ paths, and targets of > / >> redirects.
 * Returns deduplicated list of paths to check.
 */
export function extractBashPaths(command: string): string[] {
  const paths = new Set<string>();

  // Strip single-quoted and double-quoted strings to avoid false positives
  // from redirect operators inside quotes.
  const stripped = command
    .replace(/'[^']*'/g, " ")
    .replace(/"[^"]*"/g, " ")
    .replace(/\\"/g, ""); // escaped quotes

  // Match redirect targets: >path, >>path, 2>path, &>path, 1>path
  // (with optional space after operator)
  const redirectRe = /(?:[12&]?>>?)\s*(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = redirectRe.exec(stripped)) !== null) {
    const target = m[1].replace(/["']/g, "");
    if (target.startsWith("/") || target.startsWith("~/")) {
      paths.add(target);
    }
  }

  // Match tee targets
  const teeRe = /tee\s+(?:-a\s+)?(\S+)/g;
  while ((m = teeRe.exec(stripped)) !== null) {
    const target = m[1].replace(/["']/g, "");
    if (target.startsWith("/") || target.startsWith("~/")) {
      paths.add(target);
    }
  }

  // Extract all space-separated tokens that look like absolute paths
  for (const token of stripped.split(/\s+/)) {
    const clean = token.replace(/^["']|["']$/g, "");
    if (clean.startsWith("/") || clean.startsWith("~/")) {
      paths.add(clean);
    }
  }

  return [...paths];
}

/**
 * Check whether a bash command writes to any blocked dot* path.
 * Returns the first blocked result, or { allowed: true }.
 */
export function checkBashCommand(command: string): PathGuardResult {
  const paths = extractBashPaths(command);
  for (const p of paths) {
    const result = checkPath(p);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

/**
 * Check whether a write to `givenPath` is allowed.
 *
 * Returns { allowed: true } if the path is safe. Returns { allowed: false,
 * gateway, reason } if the path targets a dot* repo directly instead of
 * going through its ~/. prefix gateway.
 */
export function checkPath(givenPath: string): PathGuardResult {
  const real = resolveReal(givenPath);
  if (!real) return { allowed: true };

  if (!real.startsWith(PROJECTS + "/")) return { allowed: true };

  const relative = real.slice(PROJECTS.length + 1);
  const slashIdx = relative.indexOf("/");
  const repoDir = slashIdx === -1 ? relative : relative.slice(0, slashIdx);

  if (!repoDir.startsWith("dot")) return { allowed: true };

  const name = repoDir.slice(3);
  // dotpi files live under ~/.pi/agent/, not directly under ~/.pi/
  const gateway = name === "pi"
    ? join(homedir(), ".pi", "agent")
    : join(homedir(), "." + name);

  const gatewayDisplay = name === "pi" ? "~/.pi/agent/" : `~/.${name}/`;

  if (!givenPath.startsWith(gateway)) {
    return {
      allowed: false,
      gateway: gatewayDisplay,
      reason:
        `Write through ${gatewayDisplay}, not directly to ${repoDir}/.\n` +
        `  Given:  ${givenPath}\n` +
        `  Use:    ${gatewayDisplay}${relative.slice(repoDir.length + 1)}
` +
        `  Git:    cd ~/Developper/Projects/${repoDir}/ && git commit`,
    };
  }

  return { allowed: true };
}
