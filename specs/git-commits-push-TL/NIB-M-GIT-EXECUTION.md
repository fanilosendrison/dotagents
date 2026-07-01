---
id: NIB-M-GIT-EXECUTION
type: nib-module
version: "1.0.0"
scope: git-commits-push-TL
status: active
consumers: [claude-code]
superseded_by: []
---

# 📋 NIB-M — Module Brief : Git Execution (Commit & Push)

*VegaCorp — July 2026*

## 1. Purpose
This module safely executes the Git modifications using the LLM-generated commit message. It protects against concurrent user edits (race conditions) and handles the network logic for pushing.

## 2. Interface

**Inputs:**
- `repository: string` (Absolute path)
- `commit: CommitMessage`
- `expectedDiffHash: string` (Recorded from Phase 2)
- `settings: Settings`

**Outputs:**
- Executes shell commands modifying the Git index.
- Throws Error if hash mismatches or network fails.

## 3. Algorithm

```typescript
async function executeCommitAndPush(
  repoPath: string, 
  commit: CommitMessage, 
  expectedDiffHash: string, 
  settings: Settings
): Promise<void> {
  // 1. Race Condition Protection
  const currentDiff = await execAsync(`git diff --cached`, { cwd: repoPath });
  const currentHash = crypto.createHash('sha256').update(currentDiff).digest('hex');
  
  if (currentHash !== expectedDiffHash) {
    throw new Error("Concurrent Modification Error: The staged diff changed during LLM inference.");
  }

  // 2. Commit Format Generation
  // Build conventional commit string
  let message = `${commit.type}`;
  if (commit.scope) {
    message += `(${commit.scope})`;
  }
  if (commit.isBreaking) {
    message += `!`;
  }
  message += `: ${commit.description}`;

  if (commit.body) {
    message += `\n\n${commit.body}`;
  }

  // Write message to a temporary file to avoid shell escaping issues
  const tempMsgPath = path.join(os.tmpdir(), `commit-msg-${Date.now()}.txt`);
  await writeTextFile(tempMsgPath, message);

  // 3. Execution
  await execAsync(`git commit --file=${tempMsgPath} --no-verify`, { 
    cwd: repoPath, 
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }
  });

  // 4. Push Network Logic
  if (settings.autoPush) {
    const remotes = await execAsync(`git remote`, { cwd: repoPath });
    if (!remotes.trim()) {
      // No remote configured, skip push gracefully
      return;
    }

    try {
      await execAsync(`git push`, { 
        cwd: repoPath, 
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } 
      });
    } catch (pushErr) {
      // Fallback for missing upstream branch: fatal: The current branch main has no upstream branch.
      if (pushErr.message.includes("has no upstream branch")) {
        const branchName = await execAsync(`git branch --show-current`, { cwd: repoPath });
        const firstRemote = remotes.trim().split("\n")[0].trim();
        await execAsync(`git push -u ${firstRemote} ${branchName.trim()}`, { 
          cwd: repoPath, 
          env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } 
        });
      } else {
        // Real network failure
        throw new Error(`Push Error: ${pushErr.message}`);
      }
    }
  }
}
```

## 4. Edge Cases
- **Concurrent user edits**: If the user modifies and stages new files while the LLM is thinking, the `diffHash` verification fails, completely aborting the commit for that repository. This protects the code history.
- **Upstream branch missing**: Git rejects `git push` if no remote tracking branch is set. The script gracefully falls back to `git push -u <remote> <branch>` using the first configured remote.
- **No remote configured**: If the repository has no remotes configured, the push step is skipped entirely.
- **Interactive Prompts**: `GIT_TERMINAL_PROMPT=0` ensures that SSH passphrases or username/password prompts immediately fail instead of freezing the headless worker indefinitely.

## 5. Constraints
- Must use `--no-verify` during commit because validation/testing was already successfully performed during Phase 2. Re-running Git hooks (like linters) is redundant and breaks the deterministic flow.

## 6. Integration
```typescript
// From Turnlock orchestrator Phase 4
await executeCommitAndPush(repoState.repository, result.commit, repoState.diffHash, settings);
```
