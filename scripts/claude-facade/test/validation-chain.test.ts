import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface PackageConfiguration {
  readonly scripts: Readonly<Record<string, string>>;
  readonly workspaces?: unknown;
}

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../../..");

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPackageConfiguration(path: string): PackageConfiguration {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!isRecord(parsed) || !isRecord(parsed.scripts)) {
    throw new Error(`Package configuration has no scripts object: ${path}`);
  }

  const scripts: Record<string, string> = {};
  for (const [name, command] of Object.entries(parsed.scripts)) {
    if (typeof command !== "string") {
      throw new Error(`Package script is not a string: ${name}`);
    }
    scripts[name] = command;
  }

  return { scripts, workspaces: parsed.workspaces };
}

describe("repository validation chain", () => {
  it("owns each independently locked package from the root test command", () => {
    const rootPackage = readPackageConfiguration(join(repositoryRoot, "package.json"));

    expect(rootPackage.workspaces).toBeUndefined();
    expect(rootPackage.scripts.test).toBe(
      "bun run test:install && bun run test:root && bun run test:git-commits-push && bun run test:scripts && bun run test:protocol",
    );
    expect(rootPackage.scripts["test:install"]).toBe(
      "bun install --frozen-lockfile && bun install --cwd skills/create-symlink-for-dot-folders --frozen-lockfile && bun install --cwd skills/git-commits-push --frozen-lockfile && bun install --cwd skills/go --frozen-lockfile && bun install --cwd scripts --frozen-lockfile && bun install --cwd skills/loop-clean/protocol --frozen-lockfile",
    );
    expect(rootPackage.scripts["test:root"]).toBe(
      "bun test --timeout 60000 --path-ignore-patterns='scripts/**' --path-ignore-patterns='skills/git-commits-push/**' --path-ignore-patterns='skills/loop-clean/protocol/**'",
    );
    expect(rootPackage.scripts["test:git-commits-push"]).toBe(
      "bun run --cwd skills/git-commits-push test",
    );
    expect(rootPackage.scripts["test:scripts"]).toBe("bun run --cwd scripts test");
    expect(rootPackage.scripts["test:protocol"]).toBe(
      "bun run --cwd skills/loop-clean/protocol typecheck && bun run --cwd skills/loop-clean/protocol test:all",
    );

    for (const lockfilePath of [
      join(repositoryRoot, "bun.lock"),
      join(repositoryRoot, "scripts", "bun.lock"),
      join(repositoryRoot, "skills", "create-symlink-for-dot-folders", "bun.lock"),
      join(repositoryRoot, "skills", "git-commits-push", "bun.lock"),
      join(repositoryRoot, "skills", "go", "bun.lock"),
      join(repositoryRoot, "skills", "loop-clean", "protocol", "bun.lock"),
    ]) {
      expect(existsSync(lockfilePath)).toBe(true);
    }
  });

  it("keeps protocol validation out of the scripts package", () => {
    const scriptsPackage = readPackageConfiguration(join(repositoryRoot, "scripts", "package.json"));

    expect(scriptsPackage.scripts.test).not.toContain("loop-clean/protocol");
    expect(scriptsPackage.scripts.test).not.toContain("test:all");
  });

  it("disables implicit dependency installation in both nested packages", () => {
    for (const bunfigPath of [
      join(repositoryRoot, "scripts", "bunfig.toml"),
      join(repositoryRoot, "skills", "loop-clean", "protocol", "bunfig.toml"),
    ]) {
      expect(readFileSync(bunfigPath, "utf8").trim()).toBe('[install]\nauto = "disable"');
    }
  });
});
