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
  const gateway = join(homedir(), "." + name);

  if (!givenPath.startsWith(gateway)) {
    return {
      allowed: false,
      gateway: "~/.${name}/",
      reason:
        `Write through ~/.${name}/, not directly to ${repoDir}/.\n` +
        `  Given:  ${givenPath}\n` +
        `  Use:    ~/.${name}/${relative.slice(repoDir.length + 1)}`,
    };
  }

  return { allowed: true };
}
