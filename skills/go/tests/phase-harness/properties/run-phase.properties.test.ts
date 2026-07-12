import * as fs from "node:fs/promises";
import * as path from "node:path";
import { describe, expect, test } from "bun:test";
import fc from "fast-check";
import { runPhase, type Phase, type PhaseInput } from "../../../src/phase-harness/index.ts";
import {
  assertErroredHasBlockingError,
  assertOutputJsonMatchesReturn,
} from "../helpers/assert-phase-output.ts";
import { createArtifactParent } from "../helpers/temp-artifacts.ts";
import {
  createCommittedRepo,
  createCommittedRepoFromEntries,
  runGit,
} from "../fixtures/repositories.ts";
import {
  invalidEvidenceRefPhase,
  passingPhaseWithEvidence,
} from "../fixtures/phases.ts";

describe("runPhase properties", () => {
  test("P1 identical tracked contents produce identical tracked hashes", async () => {
    await fc.assert(
      fc.asyncProperty(fileMapArbitrary(), async (fileMap) => {
        const first = await createCommittedRepo(fileMap);
        const second = await createCommittedRepo(fileMap);
        const firstArtifacts = await createArtifactParent();
        const secondArtifacts = await createArtifactParent();
        try {
          const firstOutput = await runPhase(
            passingPhaseWithEvidence,
            buildInput(first.workDir, firstArtifacts.artefactDir, first.baseSha),
          );
          const secondOutput = await runPhase(
            passingPhaseWithEvidence,
            buildInput(second.workDir, secondArtifacts.artefactDir, second.baseSha),
          );
          expect(firstOutput.status).toBe("passed");
          expect(secondOutput.status).toBe("passed");
          expect(firstOutput.trackedWorktreeHash).toBe(secondOutput.trackedWorktreeHash);
        } finally {
          await first.cleanup();
          await second.cleanup();
          await firstArtifacts.cleanup();
          await secondArtifacts.cleanup();
        }
      }),
      { numRuns: 8 },
    );
  });

  test("P2 untracked and ignored files do not affect tracked hash", async () => {
    const repo = await createCommittedRepo({ "src/a.txt": "alpha\n", ".gitignore": "ignored.txt\n" });
    const firstArtifacts = await createArtifactParent("first");
    const secondArtifacts = await createArtifactParent("second");
    const thirdArtifacts = await createArtifactParent("third");
    try {
      const firstOutput = await runPhase(
        passingPhaseWithEvidence,
        buildInput(repo.workDir, firstArtifacts.artefactDir, repo.baseSha),
      );
      await fs.writeFile(path.join(repo.workDir, "untracked.txt"), "new\n");
      const secondOutput = await runPhase(
        passingPhaseWithEvidence,
        buildInput(repo.workDir, secondArtifacts.artefactDir, repo.baseSha),
      );
      expect(secondOutput.worktreeClean).toBe(false);
      expect(secondOutput.trackedWorktreeHash).toBe(firstOutput.trackedWorktreeHash);
      await fs.rm(path.join(repo.workDir, "untracked.txt"));
      await fs.writeFile(path.join(repo.workDir, "ignored.txt"), "ignored\n");
      const thirdOutput = await runPhase(
        passingPhaseWithEvidence,
        buildInput(repo.workDir, thirdArtifacts.artefactDir, repo.baseSha),
      );
      expect(thirdOutput.trackedWorktreeHash).toBe(firstOutput.trackedWorktreeHash);
    } finally {
      await repo.cleanup();
      await firstArtifacts.cleanup();
      await secondArtifacts.cleanup();
      await thirdArtifacts.cleanup();
    }
  });

  test("P3 evidence path escapes are always errored", async () => {
    for (const ref of ["/tmp/outside", "../escape", "evidence/dir", "evidence/missing"]) {
      const repo = await createCommittedRepo();
      const artifacts = await createArtifactParent();
      try {
        const output = await runPhase(
          invalidEvidenceRefPhase(ref),
          buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
        );
        assertErroredHasBlockingError(output);
        expect(output.evidenceRefs).not.toContain(ref);
        await assertOutputJsonMatchesReturn(output);
      } finally {
        await repo.cleanup();
        await artifacts.cleanup();
      }
    }
  });

  test("P4 preflight failures never invoke phase", async () => {
    const repo = await createCommittedRepo();
    const artifacts = await createArtifactParent();
    const badInputs: PhaseInput[] = [
      { ...buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha), runId: "bad/run" },
      { ...buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha), phase: "" },
      { ...buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha), workDir: "relative" },
      { ...buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha), artefactDir: "relative" },
      { ...buildInput(repo.workDir, artifacts.artefactDir, "HEAD") },
    ];
    try {
      for (const input of badInputs) {
        let calls = 0;
        const phase: Phase = async () => {
          calls += 1;
          return { status: "passed", evidenceRefs: [], errors: [] };
        };
        await expect(runPhase(phase, input)).rejects.toThrow();
        expect(calls).toBe(0);
      }
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });

  test("P5 output JSON is the canonical return value", async () => {
    const repo = await createCommittedRepo();
    const artifacts = await createArtifactParent();
    try {
      const output = await runPhase(
        passingPhaseWithEvidence,
        buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
      );
      await assertOutputJsonMatchesReturn(output);
      expect(output.status).toBe("passed");
      expect(output.headShaAfter).not.toBeNull();
      expect(output.trackedWorktreeHash).not.toBeNull();
      expect(output.worktreeClean).not.toBeNull();
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });

  test("P6 tracked hash changes for tracked content dimensions", async () => {
    const plain = await hashForEntries([{ kind: "file", path: "a.txt", bytes: "a\n" }]);
    const changedBytes = await hashForEntries([{ kind: "file", path: "a.txt", bytes: "b\n" }]);
    const executable = await hashForEntries([
      { kind: "file", path: "a.txt", bytes: "a\n", executable: true },
    ]);
    const symlinkA = await hashForEntries([{ kind: "symlink", path: "link", target: "a" }]);
    const symlinkB = await hashForEntries([{ kind: "symlink", path: "link", target: "b" }]);
    expect(plain).not.toBe(changedBytes);
    expect(plain).not.toBe(executable);
    expect(symlinkA).not.toBe(symlinkB);
  });

  test("P7 harness errors dominate phase status", async () => {
    const statuses = ["passed", "failed", "skipped"] as const;
    for (const status of statuses) {
      const repo = await createCommittedRepo();
      const artifacts = await createArtifactParent();
      try {
        const phase: Phase = async () => {
          await fs.writeFile(path.join(artifacts.artefactDir, "output.json"), "reserved");
          return {
            status,
            evidenceRefs: [],
            errors:
              status === "failed"
                ? [{ message: "phase issue", severity: "minor" }]
                : [],
          };
        };
        const output = await runPhase(
          phase,
          buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
        );
        expect(output.status).toBe("errored");
        assertErroredHasBlockingError(output);
        if (status === "failed") {
          expect(output.errors.some((error) => error.message === "phase issue")).toBe(true);
        }
      } finally {
        await repo.cleanup();
        await artifacts.cleanup();
      }
    }
  });

  test("P8 canonical fields are collected independently", async () => {
    const repo = await createCommittedRepo();
    const artifacts = await createArtifactParent();
    try {
      await runGit(repo.workDir, ["checkout", "--orphan", "empty"]);
      await runGit(repo.workDir, ["rm", "-rf", "."], { allowFailure: true });
      const output = await runPhase(
        passingPhaseWithEvidence,
        buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
      );
      expect(output.status).toBe("errored");
      expect(output.headShaAfter).toBeNull();
      expect(output.trackedWorktreeHash).not.toBeNull();
      expect(output.worktreeClean).not.toBeNull();
    } finally {
      await repo.cleanup();
      await artifacts.cleanup();
    }
  });
});

function fileMapArbitrary(): fc.Arbitrary<Record<string, string>> {
  return fc
    .dictionary(
      fc.constantFrom("src/a.txt", "src/b.txt", "docs/readme.md"),
      fc.string({ minLength: 0, maxLength: 20 }),
      { minKeys: 1, maxKeys: 3 },
    )
    .map((value) => {
      if (Object.keys(value).length === 0) {
        return { "src/a.txt": "alpha\n" };
      }
      return value;
    });
}

async function hashForEntries(
  entries: Parameters<typeof createCommittedRepoFromEntries>[0],
): Promise<string | null> {
  const repo = await createCommittedRepoFromEntries(entries);
  const artifacts = await createArtifactParent();
  try {
    const output = await runPhase(
      passingPhaseWithEvidence,
      buildInput(repo.workDir, artifacts.artefactDir, repo.baseSha),
    );
    return output.trackedWorktreeHash;
  } finally {
    await repo.cleanup();
    await artifacts.cleanup();
  }
}

function buildInput(
  workDir: string,
  artefactDir: string,
  baseSha: string,
): PhaseInput {
  return {
    runId: "run-01",
    workDir,
    artefactDir,
    baseSha,
    phase: "lint",
  };
}
