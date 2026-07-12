import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, test } from "bun:test";
import {
  runStage,
  type Stage,
  type StageInput,
} from "../../../src/stage-harness/index.ts";
import {
  assertCanonicalFieldsAvailable,
  assertErroredHasBlockingError,
  assertNoOutputJson,
  assertOutputJsonMatchesReturn,
} from "../helpers/assert-stage-output.ts";
import { computeExpectedTrackedHash } from "../helpers/hash-expectations.ts";
import { createArtifactParent } from "../helpers/temp-artifacts.ts";
import {
  createCommittedRepo,
  createCommittedRepoFromEntries,
  createMergeConflictRepo,
  getBlobSha,
  getTreeSha,
  runGit,
} from "../fixtures/repositories.ts";
import {
  cyclicThrowingStage,
  dirtyTrackedFileStage,
  erroredDraftStage,
  failedWithoutErrorsStage,
  failingStageWithEvidence,
  invalidDraftStage,
  invalidErrorEvidenceStage,
  invalidErrorFileStage,
  invalidErrorLineStage,
  objectThrowingStage,
  passingStageWithEvidence,
  passedWithErrorsStage,
  reservedOutputStage,
  reservedStderrStage,
  reservedStdoutStage,
  skippedStage,
  skippedWithErrorsStage,
  stringThrowingStage,
  symlinkEscapeEvidenceStage,
  throwingStage,
  undefinedDraftStage,
} from "../fixtures/stages.ts";

describe("runStage acceptance", () => {
  test("A1 passing stage writes canonical output", async () => {
    await withRunContext(async ({ input }) => {
      const output = await runStage(passingStageWithEvidence, input);
      expect(output.status).toBe("passed");
      expect(output.errors).toEqual([]);
      expect(output.evidenceRefs).toEqual(["evidence/result.json"]);
      assertCanonicalFieldsAvailable(output);
      expect(output.worktreeClean).toBe(true);
      await assertOutputJsonMatchesReturn(output);
    });
  });

  test("A2 failing stage preserves stage errors", async () => {
    await withRunContext(async ({ input }) => {
      const output = await runStage(failingStageWithEvidence, input);
      expect(output.status).toBe("failed");
      expect(output.errors).toHaveLength(1);
      expect(output.errors[0]).toMatchObject({
        severity: "minor",
        file: "src/a.txt",
        line: 1,
        evidenceRef: "evidence/lint.json",
      });
      assertCanonicalFieldsAvailable(output);
      await assertOutputJsonMatchesReturn(output);
    });
  });

  test("A3 skipped stage has no errors", async () => {
    await withRunContext(async ({ input }) => {
      const output = await runStage(skippedStage, input);
      expect(output.status).toBe("skipped");
      expect(output.errors).toEqual([]);
      expect(output.evidenceRefs).toEqual([]);
      assertCanonicalFieldsAvailable(output);
      await assertOutputJsonMatchesReturn(output);
    });
  });

  test("A4 throwing stage becomes errored output", async () => {
    await withRunContext(async ({ input }) => {
      const output = await runStage(throwingStage, input);
      assertErroredHasBlockingError(output);
      expect(output.errors.some((error) => error.message.includes("stage exploded"))).toBe(true);
      assertCanonicalFieldsAvailable(output);
      await assertOutputJsonMatchesReturn(output);
    });
  });

  test("A5 invalid draft becomes errored output", async () => {
    await withRunContext(async ({ input }) => {
      const output = await runStage(invalidDraftStage as Stage, input);
      assertErroredHasBlockingError(output);
      expect(output.errors.some((error) => error.message.includes("draft"))).toBe(true);
      assertCanonicalFieldsAvailable(output);
      await assertOutputJsonMatchesReturn(output);
    });
  });

  test("A6 dirty tracked mutation is observable", async () => {
    await withRunContext(async ({ input, repo }) => {
      const output = await runStage(dirtyTrackedFileStage, input);
      expect(output.status).toBe("passed");
      expect(output.worktreeClean).toBe(false);
      expect(output.trackedWorktreeHash).not.toBeNull();
      expect(await fs.readFile(path.join(repo.workDir, "src/a.txt"), "utf8")).toBe("beta\n");
      await assertOutputJsonMatchesReturn(output);
    });
  });

  test("A7 reserved root output file is rejected and replaced", async () => {
    await withRunContext(async ({ input }) => {
      const output = await runStage(reservedOutputStage, input);
      assertErroredHasBlockingError(output);
      expect(output.errors.some((error) => error.message.includes("reserved"))).toBe(true);
      await assertOutputJsonMatchesReturn(output);
      expect(
        await fs.readFile(path.join(output.artefactDir, "output.json"), "utf8"),
      ).not.toBe("stage");
    });
  });

  test("A8 evidence symlink escape is rejected", async () => {
    await withRunContext(async ({ input }) => {
      const output = await runStage(symlinkEscapeEvidenceStage, input);
      assertErroredHasBlockingError(output);
      expect(output.evidenceRefs).not.toContain("evidence/escape");
      expect(output.errors.some((error) => error.message.includes("containment"))).toBe(true);
      await assertOutputJsonMatchesReturn(output);
    });
  });

  test("A9 artefact directory inside worktree fails preflight", async () => {
    const repo = await createCommittedRepo();
    let calls = 0;
    const stage: Stage = async () => {
      calls += 1;
      return { status: "passed", evidenceRefs: [], errors: [] };
    };
    try {
      const input = buildInput(repo.workDir, path.join(repo.workDir, "artifacts", "lint"), repo.baseSha);
      await expect(runStage(stage, input)).rejects.toThrow();
      expect(calls).toBe(0);
      await assertNoOutputJson(input.artefactDir);
    } finally {
      await repo.cleanup();
    }
  });

  test("A10 existing artefact directory fails before stage invocation", async () => {
    const repo = await createCommittedRepo();
    const artifacts = await createArtifactParent();
    let calls = 0;
    const stage: Stage = async () => {
      calls += 1;
      return { status: "passed", evidenceRefs: [], errors: [] };
    };
    try {
      await fs.mkdir(artifacts.artefactDir);
      const input = buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha);
      await expect(runStage(stage, input)).rejects.toThrow();
      expect(calls).toBe(0);
      await assertNoOutputJson(input.artefactDir);
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });

  test("A11 unmerged index makes tracked hash unavailable", async () => {
    const repo = await createMergeConflictRepo();
    const artifacts = await createArtifactParent();
    try {
      const output = await runStage(
        passingStageWithEvidence,
        buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
      );
      expect(output.status).toBe("errored");
      expect(output.trackedWorktreeHash).toBeNull();
      expect(output.headShaAfter).not.toBeNull();
      expect(output.worktreeClean).not.toBeNull();
      expect(output.errors.some((error) => error.message.includes("unmerged"))).toBe(true);
      await assertOutputJsonMatchesReturn(output);
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });

  test("A12 draft status and error coupling violations become errored", async () => {
    for (const stage of [
      undefinedDraftStage,
      erroredDraftStage,
      failedWithoutErrorsStage,
      passedWithErrorsStage,
      skippedWithErrorsStage,
    ]) {
      await withRunContext(async ({ input }) => {
        const output = await runStage(stage as Stage, input);
        assertErroredHasBlockingError(output);
        expect(output.errors.some((error) => error.message.includes("draft"))).toBe(true);
        assertCanonicalFieldsAvailable(output);
        await assertOutputJsonMatchesReturn(output);
      });
    }
  });

  test("A13 non-Error thrown values become blocking harness errors", async () => {
    const cases: Array<[Stage, string]> = [
      [stringThrowingStage, "string exploded"],
      [objectThrowingStage, "EXPLODED"],
      [cyclicThrowingStage, "non-serializable"],
    ];
    for (const [stage, expectedMessage] of cases) {
      await withRunContext(async ({ input }) => {
        const output = await runStage(stage, input);
        assertErroredHasBlockingError(output);
        expect(output.errors.some((error) => error.message.includes(expectedMessage))).toBe(true);
        await assertOutputJsonMatchesReturn(output);
      });
    }
  });

  test("A14 invalid error evidence references are sanitized", async () => {
    await withRunContext(async ({ input }) => {
      const output = await runStage(invalidErrorEvidenceStage, input);
      assertErroredHasBlockingError(output);
      expect(output.errors.some((error) => error.message === "Bad evidence")).toBe(true);
      expect(output.errors.find((error) => error.message === "Bad evidence")?.evidenceRef).toBeUndefined();
      await assertOutputJsonMatchesReturn(output);
    });
  });

  test("A15 invalid error file and line metadata are sanitized", async () => {
    for (const [stage, key] of [
      [invalidErrorFileStage, "file"],
      [invalidErrorLineStage, "line"],
    ] as const) {
      await withRunContext(async ({ input }) => {
        const output = await runStage(stage, input);
        assertErroredHasBlockingError(output);
        expect(output.errors.some((error) => error.message.includes("metadata"))).toBe(true);
        const stageError = output.errors.find((error) => error.severity === "minor");
        expect(stageError?.[key]).toBeUndefined();
        await assertOutputJsonMatchesReturn(output);
      });
    }
  });

  test("A16 reserved stdout and stderr root files are rejected", async () => {
    for (const stage of [reservedStdoutStage, reservedStderrStage]) {
      await withRunContext(async ({ input }) => {
        const output = await runStage(stage, input);
        assertErroredHasBlockingError(output);
        expect(output.errors.some((error) => error.message.includes("reserved"))).toBe(true);
        await assertOutputJsonMatchesReturn(output);
      });
    }
  });

  test("A17 missing artefact parent fails before stage invocation", async () => {
    const repo = await createCommittedRepo();
    let calls = 0;
    const stage: Stage = async () => {
      calls += 1;
      return { status: "passed", evidenceRefs: [], errors: [] };
    };
    const missingArtefactDir = path.join(repo.workDir, "..", "missing-parent", "lint");
    try {
      await expect(
        runStage(stage, buildInput(repo.workDir, missingArtefactDir, repo.baseSha)),
      ).rejects.toThrow();
      expect(calls).toBe(0);
    } finally {
      await repo.cleanup();
    }
  });

  test("A18 non-root workDir fails preflight", async () => {
    const repo = await createCommittedRepo({ "src/a.txt": "alpha\n" });
    const artifacts = await createArtifactParent();
    let calls = 0;
    const stage: Stage = async () => {
      calls += 1;
      return { status: "passed", evidenceRefs: [], errors: [] };
    };
    try {
      await expect(
        runStage(
          stage,
          buildInput(path.join(repo.workDir, "src"), artifacts.artefactDir, repo.baseSha),
        ),
      ).rejects.toThrow();
      expect(calls).toBe(0);
      await assertNoOutputJson(artifacts.artefactDir);
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });

  test("A19 invalid baseSha variants fail preflight", async () => {
    const repo = await createCommittedRepo();
    const variants = [
      "HEAD",
      await getTreeSha(repo.workDir),
      await getBlobSha(repo.workDir, "src/a.txt"),
      "0000000000000000000000000000000000000000",
    ];
    try {
      for (const baseSha of variants) {
        const artifacts = await createArtifactParent();
        let calls = 0;
        const stage: Stage = async () => {
          calls += 1;
          return { status: "passed", evidenceRefs: [], errors: [] };
        };
        try {
          await expect(
            runStage(stage, buildInput(repo.workDir, artifacts.artefactDir, baseSha)),
          ).rejects.toThrow();
          expect(calls).toBe(0);
          await assertNoOutputJson(artifacts.artefactDir);
        } finally {
          await artifacts.cleanup();
        }
      }
    } finally {
      await repo.cleanup();
    }
  });

  test("A20 unsupported checkout modes fail preflight", async () => {
    for (const markCommand of [
      ["update-index", "--skip-worktree", "src/a.txt"],
      ["update-index", "--assume-unchanged", "src/a.txt"],
    ]) {
      const repo = await createCommittedRepo();
      const artifacts = await createArtifactParent();
      let calls = 0;
      const stage: Stage = async () => {
        calls += 1;
        return { status: "passed", evidenceRefs: [], errors: [] };
      };
      try {
        await runGit(repo.workDir, markCommand);
        await expect(
          runStage(stage, buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha)),
        ).rejects.toThrow();
        expect(calls).toBe(0);
      } finally {
        await repo.cleanup();
        await artifacts.cleanup();
      }
    }
  });

  test("A21 non-JSON config fails preflight", async () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    for (const config of [
      { value: undefined },
      { value: Number.NaN },
      { value: Number.POSITIVE_INFINITY },
      { value: new Date("2026-01-01T00:00:00.000Z") },
      { value: new Map() },
      cyclic,
    ]) {
      await withRunContext(async ({ input }) => {
        let calls = 0;
        const stage: Stage = async () => {
          calls += 1;
          return { status: "passed", evidenceRefs: [], errors: [] };
        };
        await expect(
          runStage(stage, { ...input, config } as unknown as StageInput),
        ).rejects.toThrow();
        expect(calls).toBe(0);
      });
    }
  });

  test("A22 tracked hash covers regular file bytes and executable mode", async () => {
    const entries = [
      { kind: "file" as const, path: "src/plain.txt", bytes: "plain\n" },
      {
        kind: "file" as const,
        path: "bin/tool.sh",
        bytes: "#!/bin/sh\nexit 0\n",
        executable: true,
      },
    ];
    const repo = await createCommittedRepoFromEntries(entries);
    const artifacts = await createArtifactParent();
    try {
      const output = await runStage(
        passingStageWithEvidence,
        buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
      );
      expect(output.status).toBe("passed");
      expect(output.trackedWorktreeHash).toBe(computeExpectedTrackedHash(entries));
      await assertOutputJsonMatchesReturn(output);
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });

  test("A23 tracked hash covers symlink targets and deleted tracked files", async () => {
    const entries = [
      {
        kind: "symlink" as const,
        path: "links/current",
        target: "../target.txt",
      },
      {
        kind: "deleted-after-commit" as const,
        path: "deleted.txt",
        bytes: "gone\n",
      },
    ];
    const repo = await createCommittedRepoFromEntries(entries);
    const artifacts = await createArtifactParent();
    try {
      const output = await runStage(
        passingStageWithEvidence,
        buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
      );
      expect(output.status).toBe("passed");
      expect(output.trackedWorktreeHash).toBe(computeExpectedTrackedHash(entries));
      await assertOutputJsonMatchesReturn(output);
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });

  test("A24 tracked type mismatch makes tracked hash unavailable", async () => {
    const repo = await createCommittedRepo({ "src/a.txt": "alpha\n" });
    const artifacts = await createArtifactParent();
    try {
      await fs.rm(path.join(repo.workDir, "src/a.txt"));
      await fs.symlink("other.txt", path.join(repo.workDir, "src/a.txt"));
      const output = await runStage(
        passingStageWithEvidence,
        buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
      );
      expect(output.status).toBe("errored");
      expect(output.trackedWorktreeHash).toBeNull();
      expect(output.errors.some((error) => error.message.includes("src/a.txt"))).toBe(true);
      await assertOutputJsonMatchesReturn(output);
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });

  test("A25 submodule pointer affects hash and dirty submodule affects clean flag", async () => {
    const child = await createCommittedRepo({ "lib.txt": "one\n" });
    const parent = await createCommittedRepo({ "src/a.txt": "alpha\n" });
    const firstArtifacts = await createArtifactParent("first");
    const secondArtifacts = await createArtifactParent("second");
    const thirdArtifacts = await createArtifactParent("third");
    try {
      await runGit(parent.workDir, [
        "-c",
        "protocol.file.allow=always",
        "submodule",
        "add",
        child.workDir,
        "deps/lib",
      ]);
      await runGit(parent.workDir, ["commit", "-m", "add submodule"]);
      const baseSha = (
        await runGit(parent.workDir, ["rev-parse", "HEAD"])
      ).stdout
        .toString("utf8")
        .trim();

      const firstOutput = await runStage(
        passingStageWithEvidence,
        buildInput(parent.workDir, firstArtifacts.artefactDir, baseSha),
      );

      const submoduleWorkDir = path.join(parent.workDir, "deps/lib");
      await runGit(submoduleWorkDir, ["config", "user.name", "Example User"]);
      await runGit(submoduleWorkDir, ["config", "user.email", "user@example.invalid"]);
      await fs.writeFile(path.join(submoduleWorkDir, "lib.txt"), "two\n");
      await runGit(submoduleWorkDir, ["add", "."]);
      await runGit(submoduleWorkDir, ["commit", "-m", "two"]);
      await runGit(parent.workDir, ["add", "deps/lib"]);

      const secondOutput = await runStage(
        passingStageWithEvidence,
        buildInput(parent.workDir, secondArtifacts.artefactDir, baseSha),
      );
      expect(secondOutput.trackedWorktreeHash).not.toBe(firstOutput.trackedWorktreeHash);

      await fs.writeFile(path.join(submoduleWorkDir, "lib.txt"), "dirty\n");
      const thirdOutput = await runStage(
        passingStageWithEvidence,
        buildInput(parent.workDir, thirdArtifacts.artefactDir, baseSha),
      );
      expect(thirdOutput.trackedWorktreeHash).toBe(secondOutput.trackedWorktreeHash);
      expect(thirdOutput.worktreeClean).toBe(false);
    } finally {
      await child.cleanup();
      await parent.cleanup();
      await firstArtifacts.cleanup();
      await secondArtifacts.cleanup();
      await thirdArtifacts.cleanup();
    }
  });

  test("A26 persistence write and rename failures produce no canonical output", async () => {
    for (const fault of ["fail-write", "fail-rename", "temp-collision"]) {
      await withRunContext(async ({ input }) => {
        const previousFault = process.env.GO_PHASE_HARNESS_TEST_FAULT;
        process.env.GO_PHASE_HARNESS_TEST_FAULT = fault;
        try {
          await expect(runStage(passingStageWithEvidence, input)).rejects.toThrow();
          await assertNoOutputJson(input.artefactDir);
        } finally {
          if (previousFault === undefined) {
            delete process.env.GO_PHASE_HARNESS_TEST_FAULT;
          } else {
            process.env.GO_PHASE_HARNESS_TEST_FAULT = previousFault;
          }
        }
      });
    }
  });
});

type RunContext = {
  repo: Awaited<ReturnType<typeof createCommittedRepo>>;
  artifacts: Awaited<ReturnType<typeof createArtifactParent>>;
  input: StageInput;
};

async function withRunContext(
  run: (context: RunContext) => Promise<void>,
): Promise<void> {
  const repo = await createCommittedRepo();
  const artifacts = await createArtifactParent();
  try {
    await run({
      repo,
      artifacts,
      input: buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
    });
  } finally {
    await repo.cleanup();
    await artifacts.cleanup();
  }
}

function buildInput(
  workDir: string,
  artefactDir: string,
  baseSha: string,
): StageInput {
  return {
    runId: "run-01",
    workDir,
    artefactDir,
    baseSha,
    stage: "lint",
  };
}
