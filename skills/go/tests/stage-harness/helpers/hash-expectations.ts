import { createHash } from "node:crypto";
import type { RepoEntry } from "./git-fixture.ts";

export function computeExpectedTrackedHash(entries: RepoEntry[]): string {
  const records = entries.map((entry) => {
    if (entry.kind === "symlink") {
      return {
        rawPath: Buffer.from(entry.path),
        mode: "120000",
        contentHash: sha256(Buffer.from(entry.target)),
      };
    }
    if (entry.kind === "deleted-after-commit") {
      return {
        rawPath: Buffer.from(entry.path),
        mode: "0",
        contentHash: "DELETED",
      };
    }
    return {
      rawPath: Buffer.from(entry.path),
      mode: entry.executable === true ? "100755" : "100644",
      contentHash: sha256(Buffer.from(entry.bytes)),
    };
  });

  records.sort((left, right) => Buffer.compare(left.rawPath, right.rawPath));
  const payload = Buffer.concat(
    records.flatMap((record) => [
      record.rawPath,
      Buffer.from("\0"),
      Buffer.from(record.mode),
      Buffer.from("\0"),
      Buffer.from(record.contentHash),
      Buffer.from("\0"),
    ]),
  );
  return sha256(payload);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
