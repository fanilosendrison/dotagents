---
id: NIB-M-VALIDATION
type: nib-module
version: "1.0.0"
scope: git-commits-push-TL
status: active
consumers: [claude-code]
superseded_by: []
---

# 📋 NIB-M — Module Brief : Validation & Diff Extraction

*VegaCorp — July 2026*

## 1. Purpose
This module prepares a "clean" execution context for the LLM. It verifies code integrity through a rigid testing cascade, stages all local files, extracts the Git diff, hashes it to prevent race conditions, and runs a strict security scan to prevent secret leaks.

## 2. Interface

**Inputs:**
- `repo: RepositoryInfo`
- `settings: Settings`

**Outputs:**
- `{ diff: string, diffHash: string }`

Throws an Error if validation or security checks fail.

## 3. Algorithm

```typescript
import { scanDiff } from "secret-scanner"; // See DC-SECRET-SCANNER

async function processRepoValidationAndDiff(repo: RepositoryInfo, settings: Settings): Promise<{ diff: string, diffHash: string }> {
  if (!settings.skipTests) {
    await runTestCascade(repo.path);
  }

  // Stage files
  await execAsync(`git add -A`, { cwd: repo.path });

  // Extract diff
  const diff = await execAsync(`git diff --cached`, { cwd: repo.path });
  if (!diff.trim()) {
    throw new Error("No changes found after staging.");
  }

  const diffHash = crypto.createHash('sha256').update(diff).digest('hex');

  // Security Scan
  const scanResult = await scanDiff(diff);
  if (scanResult.hasSecrets) {
    throw new Error(`Security Exception: Secret detected in diff. ${scanResult.details}`);
  }

  return { diff, diffHash };
}

async function runTestCascade(repoPath: string): Promise<void> {
  // 1. STACK_EVAL.yaml
  const stackEval = readYaml(path.join(repoPath, 'STACK_EVAL.yaml'));
  if (stackEval?.decisions?.test_runner) {
    switch(stackEval.decisions.test_runner) {
      case 'vitest': return execAsync('bun x vitest run', { cwd: repoPath });
      case 'pytest': return execAsync('pytest', { cwd: repoPath });
      case 'bun test': return execAsync('bun test', { cwd: repoPath });
      case 'none': return; // Skip testing
    }
  }

  // 2. package.json
  const pkgJson = readJson(path.join(repoPath, 'package.json'));
  if (pkgJson?.scripts?.test) {
    if (fileExists(path.join(repoPath, 'bun.lock')) || fileExists(path.join(repoPath, 'bun.lockb'))) {
      return execAsync('bun run test', { cwd: repoPath });
    }
    if (fileExists(path.join(repoPath, 'pnpm-lock.yaml'))) {
      return execAsync('pnpm run test', { cwd: repoPath });
    }
    if (fileExists(path.join(repoPath, 'yarn.lock'))) {
      return execAsync('yarn run test', { cwd: repoPath });
    }
    return execAsync('npm run test', { cwd: repoPath });
  }

  // 3. Auto-Discovery
  if (hasFilesMatching(repoPath, ["*.test.ts", "*.spec.ts", "*.test.js"])) {
    return execAsync('bun test', { cwd: repoPath });
  }
  if (hasFilesMatching(repoPath, ["test_*.py", "*_test.py"])) {
    return execAsync('pytest', { cwd: repoPath });
  }

  // 4. Fallback: No tests found, ignore.
  return;
}
```

## 4. Edge Cases
- **Tests fail**: If the `execAsync` for the test suite returns a non-zero exit code, it throws an error. The worker catches this and aborts the pipeline for this repo.
- **`git add -A` captures `.gitignore` violations**: The security scan handles catching accidentally staged secrets.

## 5. Constraints
- **Isolation**: Each repository validation must run in an isolated worker or asynchronous task. Test runs must not block validation of other repositories.

## 6. Integration
```typescript
// From Turnlock orchestrator Phase 2
const { diff, diffHash } = await processRepoValidationAndDiff(repo, settings);
state[repo.id].diffHash = diffHash;
```
