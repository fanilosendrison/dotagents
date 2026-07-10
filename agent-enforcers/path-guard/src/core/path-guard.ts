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
  /** The fully resolved rewritten path to use instead of the givenPath. */
  rewrittenPath?: string;
  /** Human-readable reason for the block. */
  reason?: string;
}

/**
 * Resolve the real path, walking up to the first existing ancestor if the
 * target file doesn't exist yet (common for Write/Edit on new files).
 *
 * Walks at most `MAX_ANCESTOR_DEPTH` steps and bails out as soon as a
 * strip step does not change the path. Both guards prevent infinite loops
 * for inputs that have no `/` left to strip (e.g. unresolved `~`).
 */
const MAX_ANCESTOR_DEPTH = 64;

function resolveReal(givenPath: string): string | null {
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
 * Unwrap common command wrappers to expose the real command being run.
 *
 * Handles:
 *   env, env -i, env --ignore-environment
 *   /usr/bin/env, /bin/env
 *   sudo [-u user]
 *   nohup
 *   bash -c '...' / sh -c '...'
 *
 * Recursive: env -i bash -c 'find ...' unwraps to 'find ...'.
 *
 * This prevents bypassing path-guard by wrapping commands in indirections.
 */
function unwrapCommand(command: string): string {
  let cmd = command.trim();
  const maxDepth = 10;
  for (let depth = 0; depth < maxDepth; depth++) {
    let changed = false;

    // exec command [args...]
    const execRe = /^exec\s+(\S(?:.|\n)*)$/;
    const execMatch = cmd.match(execRe);
    if (execMatch) {
      cmd = execMatch[1];
      changed = true;
      continue;
    }

    // env [-i] [--ignore-environment] [-S arg] [VAR=value ...] command [args...]
    // Also matches /usr/bin/env, /bin/env, etc.
    const envRe = /^(?:\S*\/)?env\s+(?:-i\s+|--ignore-environment\s+)?(?:-[A-Za-z]+\s+)?(?:[A-Za-z_]\w*=\S+\s+)*(\S(?:.|\n)*)$/;
    const envMatch = cmd.match(envRe);
    if (envMatch) {
      cmd = envMatch[1];
      changed = true;
      continue;
    }

    // sudo [-u user] [VAR=value ...] command [args...]
    const sudoRe = /^sudo\s+(?:-[A-Za-z]+\s+\S+\s+)?(?:[A-Za-z_]\w*=\S+\s+)*(\S(?:.|\n)*)$/;
    const sudoMatch = cmd.match(sudoRe);
    if (sudoMatch) {
      cmd = sudoMatch[1];
      changed = true;
      continue;
    }

    // nohup command [args...]
    const nohupRe = /^nohup\s+(\S(?:.|\n)*)$/;
    const nohupMatch = cmd.match(nohupRe);
    if (nohupMatch) {
      cmd = nohupMatch[1];
      changed = true;
      continue;
    }

    // bash -c '...' / sh -c '...' / zsh -c '...' / dash -c '...'
    // Also matches /bin/bash, /usr/bin/sh, etc. (any path prefix)
    // Extract the command string from inside the -c argument
    const cShellRe = /^(?:\S*\/)?(?:bash|sh|zsh|dash|ksh|\$SHELL)\s+-c\s+'([^']*)'\s*(.*)$/;
    const cMatchSingle = cmd.match(cShellRe);
    if (cMatchSingle) {
      cmd = (cMatchSingle[1] + " " + cMatchSingle[2]).trim();
      changed = true;
      continue;
    }
    const cShellReDbl = /^(?:\S*\/)?(?:bash|sh|zsh|dash|ksh|\$SHELL)\s+-c\s+"([^"]*)"\s*(.*)$/;
    const cMatchDouble = cmd.match(cShellReDbl);
    if (cMatchDouble) {
      cmd = (cMatchDouble[1] + " " + cMatchDouble[2]).trim();
      changed = true;
      continue;
    }

    if (!changed) break;
  }

  return cmd;
}

function tokenizeCommand(command: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;

  const pushCurrent = () => {
    if (current.length > 0) {
      tokens.push(current);
      current = "";
    }
  };

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (quote !== "'" && char === "\\") {
      const next = command[i + 1];
      if (next !== undefined) {
        current += next;
        i++;
      }
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === "\"") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      pushCurrent();
      continue;
    }

    current += char;
  }

  pushCurrent();
  return tokens;
}

function normalizePathCandidate(token: string): string | null {
  const clean = token.replace(/[),;]+$/g, "");
  if (!clean) return null;

  if (
    clean.startsWith("/") ||
    clean.startsWith("~/") ||
    (clean.includes("/") && !clean.startsWith("-"))
  ) {
    return clean;
  }

  return null;
}

/**
 * Extract candidate file paths from a bash command string.
 *
 * Looks for absolute paths, ~/ paths, and targets of > / >> redirects.
 * Returns deduplicated list of paths to check.
 */
export function extractBashPaths(command: string): string[] {
  const paths = new Set<string>();

  // Unwrap command wrappers (env -i, bash -c, etc.) before extracting paths.
  // This prevents bypassing path-guard by wrapping the real command.
  const unwrapped = unwrapCommand(command);

  const tokens = tokenizeCommand(unwrapped);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    const redirectWithTarget = token.match(/^(?:[12&]?>>?|<<?)(.+)$/);
    if (redirectWithTarget) {
      const path = normalizePathCandidate(redirectWithTarget[1]);
      if (path) paths.add(path);
      continue;
    }

    if (/^(?:[12&]?>>?|<<?)$/.test(token)) {
      const next = tokens[i + 1];
      if (next) {
        const path = normalizePathCandidate(next);
        if (path) paths.add(path);
      }
      continue;
    }

    if (token === "tee") {
      for (let j = i + 1; j < tokens.length; j++) {
        const candidate = tokens[j];
        if (!candidate || candidate === "|" || candidate === "&&" || candidate === ";") break;
        if (candidate.startsWith("-")) continue;
        const path = normalizePathCandidate(candidate);
        if (path) paths.add(path);
      }
      continue;
    }

    const path = normalizePathCandidate(token);
    if (path) {
      paths.add(path);
    }
  }

  return [...paths];
}

/**
 * Return true when every &&/;-separated segment is cd or git,
 * and at least one segment is a git command.
 *
 * Purely-git command chains are safe to run inside dot* repos because
 * git manages its own writes through .git/ — this is the whole reason
 * dot* repos exist.
 */
function isGitOnlyCommand(cmd: string): boolean {
  const segments = cmd.split(/&&|;/);
  let hasGit = false;
  for (let seg of segments) {
    seg = seg.trim().replace(/^\(|\)$/g, "").trim();
    if (!seg) continue;
    const unwrapped = unwrapCommand(seg);
    if (unwrapped.startsWith("git ")) {
      hasGit = true;
    } else if (unwrapped.startsWith("cd ")) {
      // Allowed
    } else if (
      unwrapped.startsWith("echo ") &&
      !unwrapped.includes(">") &&
      !unwrapped.includes("<") &&
      !unwrapped.includes("|")
    ) {
      // Allowed: printing without redirects or piping is safe
    } else if (unwrapped === "true" || unwrapped === "false" || unwrapped.startsWith("exit ")) {
      // Allowed
    } else {
      return false;
    }
  }
  return hasGit;
}

/**
 * Check whether a bash command writes to any blocked dot* path.
 * Returns the first blocked result, or { allowed: true }.
 *
 * Git commands (commit, push, status, etc.) are whitelisted so they
 * can run inside dot* repos — the only reason these repos exist.
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

/**
 * Check whether a write to `givenPath` is allowed.
 *
 * Returns { allowed: true } if the path is safe. Returns { allowed: false,
 * gateway, reason } if the path targets a dot* repo directly instead of
 * going through its ~/. prefix gateway.
 */
export function checkPath(givenPath: string): PathGuardResult {
  // Expand a leading `~` or `~/...` to the user's home directory. Without
  // this, resolveReal walks ancestors that never exist (e.g. `~/Developper`
  // → `~` which doesn't exist) and deadlocks in a strip-no-progress loop.
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
        `  Use:    ${gatewayDisplay}${relative.slice(repoDir.length + 1)}
` +
        `  Git:    cd ~/Developper/Projects/${repoDir}/ && git commit`,
    };
  }

  return { allowed: true };
}
