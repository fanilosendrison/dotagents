/**
 * Shared path-guard logic — used by both Pi extensions and agent hooks.
 * Main coordinator module that orchestrates path and bash validations.
 */

import { join } from "node:path";
import { homedir } from "node:os";
import { extractBashPaths, isGitOnlyCommand, unwrapCommand } from "./bash-parser";
import { resolveReal } from "./helpers";

export * from "./helpers";
export { extractBashPaths } from "./bash-parser";

const PROJECTS = join(homedir(), "Developper", "Projects");

export interface PathGuardResult {
  allowed: boolean;
  /** The ~/.<name>/ gateway to use instead (only set when blocked). */
  gateway?: string;
  /** The fully resolved rewritten path to use instead of the givenPath. */
  rewrittenPath?: string;
  /** Human-readable reason for the block. */
  reason?: string;
}

/**
 * Check whether a write to `givenPath` is allowed.
 *
 * Returns { allowed: true } if the path is safe. Returns { allowed: false,
 * gateway, reason } if the path targets a dot* repo directly instead of
 * going through its ~/. prefix gateway.
 */
export function checkPath(givenPath: string): PathGuardResult {
  const expanded =
    givenPath === "~" || givenPath.startsWith("~/")
      ? homedir() + givenPath.slice(1)
      : givenPath;

  const real = resolveReal(expanded);
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

  if (!expanded.startsWith(gateway)) {
    const remainder = relative.slice(repoDir.length + 1);
    const rewrittenPath = remainder ? gateway + "/" + remainder : gateway;

    return {
      allowed: false,
      gateway: gatewayDisplay,
      rewrittenPath,
      reason:
        `Write through ${gatewayDisplay}, not directly to ${repoDir}/.\n` +
        `  Given:  ${givenPath}\n` +
        `  Use:    ${gatewayDisplay}${relative.slice(repoDir.length + 1)}\n` +
        `  Git:    cd ~/Developper/Projects/${repoDir}/ && git commit`,
    };
  }

  return { allowed: true };
}

/**
 * Check whether a bash command writes to any blocked dot* path.
 * Returns the first blocked result, or { allowed: true }.
 */
export function checkBashCommand(command: string): PathGuardResult {
  // Whitelist pure git operations — they run inside dot* repos legitimately
  if (isGitOnlyCommand(unwrapCommand(command))) {
    return { allowed: true };
  }

  const paths = extractBashPaths(command);
  for (const p of paths) {
    const result = checkPath(p);
    if (!result.allowed) return result;
  }
  return { allowed: true };
}

/**
 * Rewrite blocked paths in a bash command to their gateway paths.
 */
export function rewriteBashCommand(command: string): { rewritten: boolean; newCommand: string; logMessage?: string } {
  if (isGitOnlyCommand(unwrapCommand(command))) {
    return { rewritten: false, newCommand: command };
  }

  const paths = extractBashPaths(command).sort((a, b) => b.length - a.length);
  let newCommand = command;
  let rewritten = false;
  const logs: string[] = [];

  for (const p of paths) {
    const result = checkPath(p);
    if (!result.allowed && result.rewrittenPath) {
      newCommand = newCommand.split(p).join(result.rewrittenPath);
      logs.push(`[Path-Guard] 🔄 Silent redirection to ${result.gateway}`);
      rewritten = true;
    }
  }

  if (rewritten) {
    const logStr = logs.join("\\n");
    newCommand = `echo -e "\\033[33m${logStr}\\033[0m" >&2 && ${newCommand}`;
  }

  return { rewritten, newCommand, logMessage: logs.join("\n") };
}
