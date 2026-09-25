/**
 * CLI and Bash command parsing functions for path-guard.
 * Dedicated parser logic to analyze bash statements and extract path targets.
 */

type Quote = "'" | '"';

/** A contiguous run of characters enclosed by one pair of quotes. */
interface QuoteSegment {
  readonly start: number;
  readonly quote: Quote;
  end: number;
}

/** A decoded shell token together with its raw span in the parsed text. */
interface BashToken {
  readonly value: string;
  readonly rawStart: number;
  readonly rawEnd: number;
  /** Raw span of each decoded character. */
  readonly charRawStarts: readonly number[];
  readonly charRawEnds: readonly number[];
  /** Index of the quote segment each decoded character belongs to, or -1. */
  readonly charSegmentIndexes: readonly number[];
  /** Quote segments opened and closed inside the token. */
  readonly segments: readonly QuoteSegment[];
}

/**
 * A mechanically established write destination and the exact source span it
 * occupies in the original command.
 */
export interface BashWriteTargetOccurrence {
  /** Decoded, path-like write destination governed by the guard. */
  readonly path: string;
  /** Inclusive start offset of the destination in the original command. */
  readonly start: number;
  /** Exclusive end offset of the destination in the original command. */
  readonly end: number;
  /**
   * Quoting context active at the span in the unwrapped command text, or
   * `null` when the span mixes quoting contexts and must be replaced as a
   * complete shell word.
   *
   * When it is a quote character, the span excludes the surrounding quote
   * delimiters and must be replaced with content escaped for that quoting
   * context. When it is `null`, the span covers a complete shell word,
   * including any delimiters, and must be replaced by one.
   */
  readonly quote: Quote | null;
  /**
   * Quoting contexts of the nested-shell (`bash -c`) boundaries crossed while
   * mapping the destination back to the original command, innermost first.
   *
   * The rendered replacement must be escaped for each of them before being
   * spliced into the original command: they describe the original source
   * context, which can differ from the unwrapped lexical context.
   */
  readonly wrapperQuotes: readonly Quote[];
}

interface TextWithMap {
  readonly text: string;
  readonly map: number[];
}

/** One contiguous piece of an unwrap step's output. */
interface UnwrapSegment {
  /** Range covered in the step output text. */
  readonly childStart: number;
  readonly childEnd: number;
  /** Start of the contiguous parent range the segment maps to. */
  readonly parentStart: number;
  /**
   * Quote context the segment is decoded from in the parent text, or `null`
   * when the segment is copied literally (no nested shell boundary).
   */
  readonly quoting: Quote | null;
}

/** One `unwrapCommand()` transformation, mapping its output to its input. */
interface UnwrapStep {
  readonly segments: readonly UnwrapSegment[];
}

interface UnwrappedCommand {
  readonly text: string;
  /** For each character of `text`, its index in the original command or -1. */
  readonly sourceMap: readonly number[];
  /** Transformations applied, in application order. */
  readonly steps: readonly UnwrapStep[];
}

interface UnwrappedWriteTargetOccurrence {
  readonly path: string;
  readonly start: number;
  readonly end: number;
  readonly quote: Quote | null;
}

function takeRange(source: TextWithMap, start: number, end: number): TextWithMap {
  return {
    text: source.text.slice(start, end),
    map: source.map.slice(start, end),
  };
}

function concatenateWithMap(
  parts: ReadonlyArray<TextWithMap | "separator">,
): TextWithMap {
  let text = "";
  const map: number[] = [];
  for (const part of parts) {
    if (part === "separator") {
      text += " ";
      map.push(-1);
      continue;
    }
    text += part.text;
    map.push(...part.map);
  }
  return { text, map };
}

function trimWithMap(source: TextWithMap): TextWithMap {
  const start = source.text.length - source.text.trimStart().length;
  const end = source.text.trimEnd().length;
  return takeRange(source, start, end);
}

/**
 * Build the unwrap step for a nested-shell `-c` boundary: the quoted command
 * string is decoded from `quote`, while the trailing arguments are copied
 * literally. The returned map is cumulative to the original command.
 */
function buildShellWrapperStep(
  parent: TextWithMap,
  inner: readonly [number, number],
  tail: readonly [number, number],
  quote: Quote,
): { text: string; map: number[]; step: UnwrapStep } {
  const innerText = takeRange(parent, inner[0], inner[1]);
  const tailText = takeRange(parent, tail[0], tail[1]);
  const combined = concatenateWithMap([innerText, "separator", tailText]);
  const trimmed = trimWithMap(combined);

  const trimStart = combined.text.length - combined.text.trimStart().length;
  const trimEnd = combined.text.trimEnd().length;
  const innerLength = inner[1] - inner[0];

  const segments: UnwrapSegment[] = [];
  const addSegment = (
    rawStart: number,
    rawEnd: number,
    parentStart: number,
    quoting: Quote | null,
  ) => {
    const visibleStart = Math.max(rawStart, trimStart);
    const visibleEnd = Math.min(rawEnd, trimEnd);
    if (visibleEnd <= visibleStart) return;
    segments.push({
      childStart: visibleStart - trimStart,
      childEnd: visibleEnd - trimStart,
      parentStart: parentStart + (visibleStart - rawStart),
      quoting,
    });
  };

  addSegment(0, innerLength, inner[0], quote);
  addSegment(
    innerLength + 1,
    innerLength + 1 + (tail[1] - tail[0]),
    tail[0],
    null,
  );

  return { text: trimmed.text, map: trimmed.map, step: { segments } };
}

/**
 * Unwrap command wrappers (`exec`, `env`, `sudo`, `nohup`, `bash -c '...'`)
 * while keeping a map from each unwrapped character back to its offset in the
 * original command and a record of every nested-shell boundary crossed.
 *
 * The unwrapped text is byte-identical to the historical `unwrapCommand()`
 * result; the map exists so write-target occurrences keep an exact source span
 * into the original command, and the steps keep the original quoting context
 * of each mapped span.
 */
function unwrapCommandWithSourceMap(command: string): UnwrappedCommand {
  const trimOffset = command.length - command.trimStart().length;
  const trimmedText = command.trim();
  let current: TextWithMap = {
    text: trimmedText,
    map: Array.from(
      { length: trimmedText.length },
      (_, index) => trimOffset + index,
    ),
  };
  const steps: UnwrapStep[] = [];

  const pushSliceStep = (start: number, end: number): TextWithMap => {
    steps.push({
      segments: [
        { childStart: 0, childEnd: end - start, parentStart: start, quoting: null },
      ],
    });
    return takeRange(current, start, end);
  };

  const maxDepth = 10;
  for (let depth = 0; depth < maxDepth; depth++) {
    let changed = false;

    // exec command [args...]
    const execRe = /^exec\s+(\S(?:.|\n)*)$/d;
    const execMatch = current.text.match(execRe);
    const execInner = execMatch?.indices?.[1];
    if (execInner) {
      current = pushSliceStep(execInner[0], execInner[1]);
      changed = true;
      continue;
    }

    // env [-i] [--ignore-environment] [-S arg] [VAR=value ...] command [args...]
    // Also matches /usr/bin/env, /bin/env, etc.
    const envRe = /^(?:\S*\/)?env\s+(?:-i\s+|--ignore-environment\s+)?(?:-[A-Za-z]+\s+)?(?:[A-Za-z_]\w*=\S+\s+)*(\S(?:.|\n)*)$/d;
    const envMatch = current.text.match(envRe);
    const envInner = envMatch?.indices?.[1];
    if (envInner) {
      current = pushSliceStep(envInner[0], envInner[1]);
      changed = true;
      continue;
    }

    // sudo [-u user] [VAR=value ...] command [args...]
    const sudoRe = /^sudo\s+(?:-[A-Za-z]+\s+\S+\s+)?(?:[A-Za-z_]\w*=\S+\s+)*(\S(?:.|\n)*)$/d;
    const sudoMatch = current.text.match(sudoRe);
    const sudoInner = sudoMatch?.indices?.[1];
    if (sudoInner) {
      current = pushSliceStep(sudoInner[0], sudoInner[1]);
      changed = true;
      continue;
    }

    // nohup command [args...]
    const nohupRe = /^nohup\s+(\S(?:.|\n)*)$/d;
    const nohupMatch = current.text.match(nohupRe);
    const nohupInner = nohupMatch?.indices?.[1];
    if (nohupInner) {
      current = pushSliceStep(nohupInner[0], nohupInner[1]);
      changed = true;
      continue;
    }

    // bash -c '...' / sh -c '...' / zsh -c '...' / dash -c '...'
    // Also matches /bin/bash, /usr/bin/sh, etc. (any path prefix)
    // Extract the command string from inside the -c argument
    const cShellRe = /^(?:\S*\/)?(?:bash|sh|zsh|dash|ksh|\$SHELL)\s+-c\s+'([^']*)'\s*(.*)$/d;
    const cMatchSingle = current.text.match(cShellRe);
    const singleInner = cMatchSingle?.indices?.[1];
    const singleTail = cMatchSingle?.indices?.[2];
    if (singleInner && singleTail) {
      const built = buildShellWrapperStep(current, singleInner, singleTail, "'");
      steps.push(built.step);
      current = { text: built.text, map: built.map };
      changed = true;
      continue;
    }

    const cShellReDbl = /^(?:\S*\/)?(?:bash|sh|zsh|dash|ksh|\$SHELL)\s+-c\s+"([^"]*)"\s*(.*)$/d;
    const cMatchDouble = current.text.match(cShellReDbl);
    const doubleInner = cMatchDouble?.indices?.[1];
    const doubleTail = cMatchDouble?.indices?.[2];
    if (doubleInner && doubleTail) {
      const built = buildShellWrapperStep(current, doubleInner, doubleTail, '"');
      steps.push(built.step);
      current = { text: built.text, map: built.map };
      changed = true;
      continue;
    }

    if (!changed) break;
  }

  return { text: current.text, sourceMap: current.map, steps };
}

/**
 * Unwrap command wrappers (`env -i`, `sudo`, `nohup`, `bash -c '...'`).
 */
export function unwrapCommand(command: string): string {
  return unwrapCommandWithSourceMap(command).text;
}

/**
 * Tokenize a command into decoded values while recording, for every decoded
 * character, its raw span and quoting context in the tokenized text.
 */
function tokenizeCommandWithPositions(command: string): BashToken[] {
  const tokens: BashToken[] = [];
  let value = "";
  let charRawStarts: number[] = [];
  let charRawEnds: number[] = [];
  let charSegmentIndexes: number[] = [];
  let segments: QuoteSegment[] = [];
  let rawStart = -1;
  let rawEnd = -1;
  let quote: Quote | null = null;
  let activeSegment = -1;

  const markStart = (index: number) => {
    if (rawStart === -1) rawStart = index;
  };
  const markEnd = (index: number) => {
    rawEnd = index;
  };
  const append = (
    char: string,
    start: number,
    end: number,
  ) => {
    value += char;
    charRawStarts.push(start);
    charRawEnds.push(end);
    charSegmentIndexes.push(activeSegment);
  };
  const flush = () => {
    if (value.length > 0) {
      for (const segment of segments) {
        // An unterminated quote extends to the end of the token.
        if (segment.end === -1) segment.end = rawEnd;
      }
      tokens.push({
        value,
        rawStart,
        rawEnd,
        charRawStarts,
        charRawEnds,
        charSegmentIndexes,
        segments,
      });
    }
    value = "";
    charRawStarts = [];
    charRawEnds = [];
    charSegmentIndexes = [];
    segments = [];
    rawStart = -1;
    rawEnd = -1;
    activeSegment = -1;
  };

  for (let i = 0; i < command.length; i++) {
    const char = command[i];

    if (quote !== "'" && char === "\\") {
      const next = command[i + 1];
      markStart(i);
      if (next !== undefined) {
        append(next, i, i + 2);
        markEnd(i + 2);
        i++;
      } else {
        markEnd(i + 1);
      }
      continue;
    }

    if (quote) {
      markStart(i);
      if (char === quote) {
        const segment = segments[activeSegment];
        if (segment) segment.end = i + 1;
        quote = null;
        activeSegment = -1;
      } else {
        append(char, i, i + 1);
      }
      markEnd(i + 1);
      continue;
    }

    if (char === "'" || char === '"') {
      markStart(i);
      quote = char;
      activeSegment = segments.length;
      segments.push({ start: i, quote: char, end: -1 });
      markEnd(i + 1);
      continue;
    }

    if (/\s/.test(char)) {
      flush();
      continue;
    }

    markStart(i);
    append(char, i, i + 1);
    markEnd(i + 1);
  }

  flush();
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
 * Collect the path-like `tee` operands.
 *
 * `tee` is an explicitly governed write surface, so its non-option operands
 * are destinations until the next command separator. Both path extraction
 * modes share this rule so the governed surface has one definition.
 */
function collectTeeTargetTokens(
  tokens: readonly BashToken[],
  teeIndex: number,
): BashToken[] {
  const targets: BashToken[] = [];
  for (let j = teeIndex + 1; j < tokens.length; j++) {
    const candidate = tokens[j];
    if (candidate.value === "|" || candidate.value === "&&" || candidate.value === ";") break;
    if (candidate.value.startsWith("-")) continue;
    if (normalizePathCandidate(candidate.value)) targets.push(candidate);
  }
  return targets;
}

/**
 * Extract candidate file paths from a bash command string.
 *
 * Looks for absolute paths, ~/ paths, and targets of > / >> redirects.
 * Returns deduplicated list of paths to check.
 *
 * This is the "every path-like token" abstraction and is kept for
 * non-enforcement consumers such as telemetry. Enforcement must use
 * `extractBashWriteTargets()` instead: a path reference alone is not write
 * evidence, and the two sets must not be conflated.
 */
export function extractBashPaths(command: string): string[] {
  const paths = new Set<string>();

  // Unwrap command wrappers (env -i, bash -c, etc.) before extracting paths.
  const unwrapped = unwrapCommand(command);
  const tokens = tokenizeCommandWithPositions(unwrapped);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || !token.value) continue;

    const redirectWithTarget = token.value.match(/^(?:[12&]?>>?|<<?)(.+)$/);
    if (redirectWithTarget) {
      const path = normalizePathCandidate(redirectWithTarget[1]);
      if (path) paths.add(path);
      continue;
    }

    if (/^(?:[12&]?>>?|<<?)$/.test(token.value)) {
      const next = tokens[i + 1];
      if (next) {
        const path = normalizePathCandidate(next.value);
        if (path) paths.add(path);
      }
      continue;
    }

    if (token.value === "tee") {
      for (const target of collectTeeTargetTokens(tokens, i)) {
        const path = normalizePathCandidate(target.value);
        if (path) paths.add(path);
      }
      continue;
    }

    const path = normalizePathCandidate(token.value);
    if (path) {
      paths.add(path);
    }
  }

  return [...paths];
}

/**
 * Output-redirection operators whose operand is a mechanically certain write
 * destination.
 *
 * The set is the one the guard already governed before this boundary:
 * `>`, `>>`, `1>`, `1>>`, `2>`, `2>>`, `&>`, `&>>`, in attached (`>path`) and
 * detached (`> path`) form. Input redirections (`<`, `<<`, `<<<`) are absent
 * on purpose: their operand is read, not written.
 */
const ATTACHED_OUTPUT_REDIRECT = /^(?:1>>|1>|2>>|2>|&>>|&>|>>|>(?!\|))(.+)$/;
const DETACHED_OUTPUT_REDIRECT = /^(?:1>>|1>|2>>|2>|&>>|&>|>>|>)$/;

/**
 * Build the positional occurrence for the normalized path prefix that starts
 * at `valueOffset` inside `token`.
 *
 * When the path stays inside a single quoted region, the span covers only the
 * decoded characters and the surrounding quotes stay in place. Otherwise the
 * span covers a complete shell word, including its quote delimiters. Trailing
 * shell punctuation the guard strips is always left untouched.
 */
function occurrenceForToken(
  token: BashToken,
  valueOffset: number,
  path: string,
): UnwrappedWriteTargetOccurrence | null {
  const firstIndex = valueOffset;
  const lastIndex = valueOffset + path.length - 1;
  const innerStart = token.charRawStarts[firstIndex];
  const innerEnd = token.charRawEnds[lastIndex];
  if (innerStart === undefined || innerEnd === undefined || innerEnd <= innerStart) {
    return null;
  }

  const firstSegmentIndex = token.charSegmentIndexes[firstIndex] ?? -1;
  const lastSegmentIndex = token.charSegmentIndexes[lastIndex] ?? -1;
  const singleSegment =
    firstSegmentIndex !== -1 && firstSegmentIndex === lastSegmentIndex
      ? token.segments[firstSegmentIndex]
      : null;

  if (singleSegment) {
    return {
      path,
      start: innerStart,
      end: innerEnd,
      quote: singleSegment.quote,
    };
  }

  const firstSegment = firstSegmentIndex === -1 ? null : token.segments[firstSegmentIndex];
  const lastSegment = lastSegmentIndex === -1 ? null : token.segments[lastSegmentIndex];
  return {
    path,
    start: firstSegment ? firstSegment.start : innerStart,
    end: lastSegment ? lastSegment.end : innerEnd,
    quote: null,
  };
}

/**
 * Extract governed write destinations from already-unwrapped text, with their
 * span in that text. Spans are remapped to the original command by
 * `extractBashWriteTargetOccurrences()`.
 */
function extractBashWriteTargetOccurrencesFromText(
  unwrapped: string,
): UnwrappedWriteTargetOccurrence[] {
  const occurrences: UnwrappedWriteTargetOccurrence[] = [];
  const tokens = tokenizeCommandWithPositions(unwrapped);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token || !token.value) continue;

    if (DETACHED_OUTPUT_REDIRECT.test(token.value)) {
      const next = tokens[i + 1];
      if (next) {
        const path = normalizePathCandidate(next.value);
        if (path) {
          const occurrence = occurrenceForToken(next, 0, path);
          if (occurrence) occurrences.push(occurrence);
        }
      }
      continue;
    }

    const attached = token.value.match(ATTACHED_OUTPUT_REDIRECT);
    if (attached) {
      const operand = attached[1];
      const path = normalizePathCandidate(operand);
      if (path) {
        const occurrence = occurrenceForToken(
          token,
          token.value.length - operand.length,
          path,
        );
        if (occurrence) occurrences.push(occurrence);
      }
      continue;
    }

    if (token.value === "tee") {
      for (const target of collectTeeTargetTokens(tokens, i)) {
        const path = normalizePathCandidate(target.value);
        if (path) {
          const occurrence = occurrenceForToken(target, 0, path);
          if (occurrence) occurrences.push(occurrence);
        }
      }
    }
  }

  return occurrences;
}

/**
 * Map a span in unwrapped text back to the original command, tolerating the
 * synthesized separator the `bash -c` unwrapping inserts.
 */
function resolveSourceSpan(
  sourceMap: readonly number[],
  start: number,
  end: number,
): { start: number; end: number } | null {
  let mappedStart = -1;
  let mappedEnd = -1;
  for (let index = start; index < end; index++) {
    const mapped = sourceMap[index];
    if (mapped === undefined || mapped < 0) continue;
    if (mappedStart === -1 || mapped < mappedStart) mappedStart = mapped;
    if (mappedEnd === -1 || mapped + 1 > mappedEnd) mappedEnd = mapped + 1;
  }
  if (mappedStart === -1 || mappedEnd <= mappedStart) return null;
  return { start: mappedStart, end: mappedEnd };
}

/**
 * Walk an occurrence span outward through the unwrap steps and collect the
 * quote contexts of the nested-shell boundaries it crosses, innermost first.
 *
 * Identity steps copy the text literally and contribute no quote. A span
 * always lies inside one segment of each step: `-c` steps separate the quoted
 * command string from its trailing arguments at whitespace, which tokens
 * never cross.
 */
function collectWrapperQuotes(
  steps: readonly UnwrapStep[],
  start: number,
  end: number,
): Quote[] {
  const wrapperQuotes: Quote[] = [];
  let spanStart = start;
  let spanEnd = end;

  for (let index = steps.length - 1; index >= 0; index--) {
    const segment = steps[index].segments.find(
      (candidate) => spanStart >= candidate.childStart && spanEnd <= candidate.childEnd,
    );
    if (!segment) break;
    if (segment.quoting !== null) wrapperQuotes.push(segment.quoting);
    const localStart = spanStart - segment.childStart;
    const localEnd = spanEnd - segment.childStart;
    spanStart = segment.parentStart + localStart;
    spanEnd = segment.parentStart + localEnd;
  }

  return wrapperQuotes;
}

/**
 * Extract the destinations of mechanically proven Bash write surfaces with
 * the exact source span each destination occupies in the original command.
 *
 * This is the single source of truth for governed write surfaces: only
 * explicit output redirections and explicitly governed write commands (`tee`)
 * contribute occurrences. Ordinary path-like arguments and input redirections
 * never contribute, so their read/write semantics stay uninterpreted.
 */
export function extractBashWriteTargetOccurrences(
  command: string,
): BashWriteTargetOccurrence[] {
  const { text, sourceMap, steps } = unwrapCommandWithSourceMap(command);
  const occurrences: BashWriteTargetOccurrence[] = [];

  for (const occurrence of extractBashWriteTargetOccurrencesFromText(text)) {
    const span = resolveSourceSpan(sourceMap, occurrence.start, occurrence.end);
    if (!span) continue;
    occurrences.push({
      path: occurrence.path,
      start: span.start,
      end: span.end,
      quote: occurrence.quote,
      wrapperQuotes: collectWrapperQuotes(
        steps,
        occurrence.start,
        occurrence.end,
      ),
    });
  }

  return occurrences;
}

/**
 * Extract the destinations of mechanically proven Bash write surfaces.
 *
 * Derived from `extractBashWriteTargetOccurrences()` so there is a single
 * definition of the governed write surfaces and duplicated targets are
 * reported once, in first-occurrence order. Callers that need to rewrite the
 * command must use the positional occurrences instead of searching the
 * command text for the returned strings.
 */
export function extractBashWriteTargets(command: string): string[] {
  const targets = new Set<string>();
  for (const occurrence of extractBashWriteTargetOccurrences(command)) {
    targets.add(occurrence.path);
  }
  return [...targets];
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
