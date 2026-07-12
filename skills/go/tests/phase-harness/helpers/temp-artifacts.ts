import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export type ArtifactPaths = {
  parentDir: string;
  artefactDir: string;
  cleanup: () => Promise<void>;
};

export async function createArtifactParent(
  childName = "lint",
): Promise<ArtifactPaths> {
  const parentDir = await fs.mkdtemp(path.join(os.tmpdir(), "go-phase-art-"));
  const artefactDir = path.join(parentDir, childName);
  return {
    parentDir,
    artefactDir,
    cleanup: () => fs.rm(parentDir, { recursive: true, force: true }),
  };
}
