import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, writeFileSync, symlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { $ } from 'bun';

const SCRIPT_PATH = join(import.meta.dir, 'create_symlink.ts');
const TEST_ENV = '/tmp/test_create_symlink_env';

describe('create_symlink.ts', () => {
  const targetDir = join(TEST_ENV, 'real_target');
  const symlinkPath = join(TEST_ENV, 'fake_symlink');

  beforeEach(() => {
    if (existsSync(TEST_ENV)) {
      rmSync(TEST_ENV, { recursive: true, force: true });
    }
    mkdirSync(TEST_ENV, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_ENV)) {
      rmSync(TEST_ENV, { recursive: true, force: true });
    }
  });

  async function runScript() {
    // We quote the arguments to simulate the path-guard bypass
    const out = await $`bun run ${SCRIPT_PATH} "${targetDir}" "${symlinkPath}"`.quiet();
    return out;
  }

  it('creates a symlink when nothing exists', async () => {
    const res = await runScript();
    expect(res.exitCode).toBe(0);
    
    expect(existsSync(targetDir)).toBe(true);
    expect(lstatSync(targetDir).isDirectory()).toBe(true);
    
    expect(lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(symlinkPath)).toBe(targetDir);
  });

  it('backs up an existing file', async () => {
    writeFileSync(symlinkPath, 'Hello World');
    
    const res = await runScript();
    expect(res.exitCode).toBe(0);
    
    expect(lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(existsSync(targetDir)).toBe(true);
    
    const movedFile = join(targetDir, 'fake_symlink');
    expect(existsSync(movedFile)).toBe(true);
    expect(readFileSync(movedFile, 'utf8')).toBe('Hello World');
  });

  it('backs up an existing directory', async () => {
    mkdirSync(symlinkPath);
    writeFileSync(join(symlinkPath, 'test1.txt'), 'File 1');
    writeFileSync(join(symlinkPath, 'test2.txt'), 'File 2');
    
    const res = await runScript();
    expect(res.exitCode).toBe(0);
    
    expect(lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    
    expect(existsSync(join(targetDir, 'test1.txt'))).toBe(true);
    expect(readFileSync(join(targetDir, 'test1.txt'), 'utf8')).toBe('File 1');
    expect(existsSync(join(targetDir, 'test2.txt'))).toBe(true);
  });

  it('does nothing if symlink is already correct', async () => {
    mkdirSync(targetDir);
    symlinkSync(targetDir, symlinkPath);
    
    const res = await runScript();
    expect(res.exitCode).toBe(0);
    expect(res.stdout.toString()).toContain('Doing nothing');
    
    expect(lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
  });

  it('replaces a wrong symlink', async () => {
    const wrongTarget = join(TEST_ENV, 'wrong_target');
    mkdirSync(wrongTarget);
    symlinkSync(wrongTarget, symlinkPath);
    
    const res = await runScript();
    expect(res.exitCode).toBe(0);
    
    expect(lstatSync(symlinkPath).isSymbolicLink()).toBe(true);
    expect(readlinkSync(symlinkPath)).toBe(targetDir);
  });
});
