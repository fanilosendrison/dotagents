#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const REPOSITORY_CONTRACTS = {
  dotagents: {
    expectedBunLockfileCount: 6,
    expectedBunTestSurfaceCount: 74,
    exclusions: [
      {
        pattern: "archived/**",
        category: "archive",
        reason: "Archived implementations are retained as historical evidence and are not executable migration surfaces.",
      },
      {
        pattern: "skills/go/specs/legacy/**",
        category: "archive",
        reason: "Legacy design material is retained without silent historical rewriting.",
      },
      {
        pattern: "skills/go/specs/briefs/orchestrator/DC-BUN-SPAWN-ASYNC-RUNTIME.md",
        category: "superseded-specification",
        reason: "Bun-specific runtime clauses are superseded by the Node runtime successor contract.",
      },
      {
        pattern: "skills/go/specs/briefs/orchestrator/DC-GIT-CLI-BOOTSTRAP.md",
        category: "superseded-specification",
        reason: "Bun-specific runtime clauses are superseded by the Node runtime successor contract.",
      },
      {
        pattern: "skills/go/specs/briefs/orchestrator/NIB-M-GO-ASYNC-GIT-RUNNER.md",
        category: "superseded-specification",
        reason: "Bun-specific runtime clauses are superseded by the Node runtime successor contract.",
      },
      {
        pattern: "skills/go/specs/briefs/orchestrator/NIB-S-GO-TURNLOCK-ORCHESTRATOR.md",
        category: "superseded-specification",
        reason: "Only Bun-specific implementation clauses are superseded; business behavior remains authoritative.",
      },
      {
        pattern: "skills/go/specs/briefs/orchestrator/NIB-T-GO-TURNLOCK-ORCHESTRATOR.md",
        category: "superseded-specification",
        reason: "Only Bun test-infrastructure clauses are superseded; behavioral vectors remain authoritative.",
      },
      {
        pattern: "skills/go/specs/briefs/orchestrator/PLAN-GO-TURNLOCK-ORCHESTRATOR-PHASE-1.md",
        category: "superseded-specification",
        reason: "Bun-specific construction guidance is superseded by the Node runtime successor contract.",
      },
      {
        pattern: "skills/go/specs/working/orchestrator/turnlock-bridge.md",
        category: "superseded-specification",
        reason: "Bun-specific bridge runtime guidance is superseded by the Node runtime successor contract.",
      },
    ],
  },
  dotpi: {
    expectedBunLockfileCount: 1,
    expectedBunTestSurfaceCount: 25,
    exclusions: [
      {
        pattern: "extensions/pi-subagents-4-turnlock/**",
        category: "upstream",
        reason: "The upstream pi-subagents-4-turnlock extension remains outside the migration scope.",
      },
    ],
  },
};

const USAGE_PATTERNS = {
  bunGlobalApi: /\bBun\./,
  bunModuleImport: /from\s+["']bun["']/,
  bunTestImport: /from\s+["']bun:test["']/,
  importMetaDir: /\bimport\.meta\.dir\b/,
  importMetaMain: /\bimport\.meta\.main\b/,
  esmDirname: /\b__dirname\b/,
  bunRealImportQuery: /\?real(?:["']|\b)/,
  bunTimerType: /\bTimer\b/,
  bunShebang: /^#![^\n]*\bbun\b/m,
  bunCommand: /\bbun\s+(?:install|run|test|x)\b/,
  absoluteUserPath: /\/Users\/[A-Za-z0-9._-]+/,
};

const ASSERTION_REPLACEMENTS = {
  toBe: "assert.strictEqual",
  toEqual: "assert.deepStrictEqual",
  toMatchObject: "assert.partialDeepStrictEqual",
  toThrow: "assert.throws",
  rejects: "assert.rejects",
};

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument sequence near ${key ?? "<end>"}`);
    }
    values[key.slice(2)] = value;
  }

  const repository = values.repository;
  if (!(repository in REPOSITORY_CONTRACTS)) {
    throw new Error("--repository must be dotagents or dotpi");
  }
  for (const required of ["root", "inventory-output", "parity-output"]) {
    if (!values[required]) throw new Error(`Missing --${required}`);
  }

  return {
    repository,
    root: resolve(values.root),
    inventoryOutput: resolve(values["inventory-output"]),
    parityOutput: resolve(values["parity-output"]),
    sourceRef: values.ref ?? "pre-node-pnpm-raw",
  };
}

function matchesExclusion(path, exclusion) {
  const prefix = exclusion.pattern.endsWith("/**")
    ? exclusion.pattern.slice(0, -3)
    : exclusion.pattern;
  return path === prefix || path.startsWith(`${prefix}/`);
}

function exclusionFor(path, exclusions) {
  return exclusions.find((exclusion) => matchesExclusion(path, exclusion));
}

function gitOutput(root, args, options = {}) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  }).trim();
}

function collectFiles(root, sourceRef) {
  const output = gitOutput(root, ["ls-tree", "-r", "--name-only", "-z", sourceRef]);
  return output
    .split("\0")
    .filter(Boolean)
    .map((repositoryPath) => ({ repositoryPath }))
    .sort((left, right) => left.repositoryPath.localeCompare(right.repositoryPath));
}

function readTextFiles(root, sourceRef, files) {
  const records = [];
  for (const file of files) {
    const contents = gitOutput(
      root,
      ["show", `${sourceRef}:${file.repositoryPath}`],
      { encoding: "utf8" },
    );
    if (contents.includes("\u0000")) continue;
    records.push({ ...file, contents });
  }
  return records;
}

function listMatchingFiles(records, pattern, exclusions) {
  const activeFiles = [];
  const excludedFiles = [];
  for (const record of records) {
    if (!pattern.test(record.contents)) continue;
    pattern.lastIndex = 0;
    if (exclusionFor(record.repositoryPath, exclusions)) {
      excludedFiles.push(record.repositoryPath);
    } else {
      activeFiles.push(record.repositoryPath);
    }
  }
  return {
    activeFileCount: activeFiles.length,
    activeFiles,
    excludedFileCount: excludedFiles.length,
    excludedFiles,
  };
}

function extractQuotedTestCases(contents) {
  const names = [];
  const expression = /\b(?:test|it)\s*\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
  for (const match of contents.matchAll(expression)) names.push(match[2]);
  return names;
}

function extractAssertions(contents) {
  const assertions = new Set();
  for (const matcher of Object.keys(ASSERTION_REPLACEMENTS)) {
    if (new RegExp(`\\.${matcher}\\b`).test(contents)) assertions.add(matcher);
  }
  if (/\bexpect\s*\(/.test(contents)) assertions.add("other-expect-matchers");
  return [...assertions].sort();
}

function collectBunTestSurfaces(records, repository, exclusions) {
  return records
    .filter((record) => !exclusionFor(record.repositoryPath, exclusions))
    .filter((record) => USAGE_PATTERNS.bunTestImport.test(record.contents))
    .filter((record) => {
      if (record.repositoryPath.endsWith(".test.ts")) return true;
      return (
        repository === "dotagents" &&
        record.repositoryPath ===
          "skills/go/tests/stage-harness/helpers/assert-stage-output.ts"
      );
    })
    .map((record) => ({
      sourceFile: record.repositoryPath,
      targetFile: record.repositoryPath,
      role: record.repositoryPath.endsWith(".test.ts") ? "test" : "assertion-helper",
      testCaseNames: extractQuotedTestCases(record.contents),
      tableDrivenDeclarations: [...record.contents.matchAll(/\b(?:test|it)\.each\s*\(/g)].length,
      assertionsDetected: extractAssertions(record.contents),
      assertionReplacements: ASSERTION_REPLACEMENTS,
      parityStatus: "pending",
      normativeChangeJustification: null,
    }))
    .sort((left, right) => left.sourceFile.localeCompare(right.sourceFile));
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const contract = REPOSITORY_CONTRACTS[options.repository];
  const canonicalRoot = await realpath(options.root);
  const files = collectFiles(canonicalRoot, options.sourceRef);
  const records = readTextFiles(canonicalRoot, options.sourceRef, files);
  const bunLockfiles = files
    .filter((file) => file.repositoryPath.endsWith("bun.lock"))
    .map((file) => file.repositoryPath)
    .sort();
  const packageManifests = files
    .filter((file) => file.repositoryPath.endsWith("package.json"))
    .filter((file) => !exclusionFor(file.repositoryPath, contract.exclusions))
    .map((file) => file.repositoryPath)
    .sort();
  const bunTestSurfaces = collectBunTestSurfaces(
    records,
    options.repository,
    contract.exclusions,
  );

  if (bunLockfiles.length !== contract.expectedBunLockfileCount) {
    throw new Error(
      `Expected ${contract.expectedBunLockfileCount} bun.lock files, found ${bunLockfiles.length}`,
    );
  }
  if (bunTestSurfaces.length !== contract.expectedBunTestSurfaceCount) {
    throw new Error(
      `Expected ${contract.expectedBunTestSurfaceCount} Bun test surfaces, found ${bunTestSurfaces.length}`,
    );
  }

  const usages = Object.fromEntries(
    Object.entries(USAGE_PATTERNS).map(([name, pattern]) => [
      name,
      listMatchingFiles(records, pattern, contract.exclusions),
    ]),
  );
  const allBunTestReferences = listMatchingFiles(
    records,
    USAGE_PATTERNS.bunTestImport,
    contract.exclusions,
  );
  const migratedTestFiles = new Set(
    bunTestSurfaces.map((surface) => surface.sourceFile),
  );
  const nonSurfaceBunTestReferences = allBunTestReferences.activeFiles.filter(
    (path) => !migratedTestFiles.has(path),
  );
  const sourceCommit = gitOutput(canonicalRoot, [
    "rev-parse",
    `${options.sourceRef}^{}`,
  ]);
  const rawBaselineCommit = gitOutput(canonicalRoot, [
    "rev-parse",
    "pre-node-pnpm-raw^{}",
  ]);

  const inventory = {
    schemaVersion: 1,
    repository: options.repository,
    sourceCommit,
    rawBaselineTag: "pre-node-pnpm-raw",
    rawBaselineCommit,
    expectedCounts: {
      bunLockfiles: contract.expectedBunLockfileCount,
      bunTestSurfaces: contract.expectedBunTestSurfaceCount,
    },
    exclusions: contract.exclusions,
    bunLockfiles,
    packageManifests,
    bunTestSurfaces: bunTestSurfaces.map((surface) => surface.sourceFile),
    nonSurfaceBunTestReferences,
    usages,
  };
  const parityManifest = {
    schemaVersion: 1,
    repository: options.repository,
    sourceCommit,
    expectedSurfaceCount: contract.expectedBunTestSurfaceCount,
    migratedSurfaceCount: 0,
    surfaces: bunTestSurfaces,
  };

  await writeFile(options.inventoryOutput, `${JSON.stringify(inventory, null, 2)}\n`);
  await writeFile(options.parityOutput, `${JSON.stringify(parityManifest, null, 2)}\n`);
}

await main();
