import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PROTOCOL_DIR = join(import.meta.dir, "..", "..");

describe("protocol lockfile contract", () => {
  it("lockfile matches canonical package identity", () => {
    const packageJson = JSON.parse(
      readFileSync(join(PROTOCOL_DIR, "package.json"), "utf8"),
    );
    const lockfile = readFileSync(join(PROTOCOL_DIR, "bun.lock"), "utf8");

    expect(packageJson.name).toBe("@dotagents/loop-clean-protocol");
    expect(lockfile).toContain('"name": "@dotagents/loop-clean-protocol"');
    expect(lockfile).not.toContain("@dotclaude/loop-clean-protocol");
  });
});
