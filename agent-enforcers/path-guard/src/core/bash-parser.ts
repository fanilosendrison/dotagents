/**
 * CLI and Bash command parsing functions for path-guard.
 * Dedicated parser logic to analyze bash statements and extract path targets.
 */

export function unwrapCommand(command: string): string {
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
        if (candidate === "|" || candidate === "&&" || candidate === ";") break;
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
 */
export function isGitOnlyCommand(cmd: string): boolean {
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
