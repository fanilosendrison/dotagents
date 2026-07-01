---
id: NIB-M-DISCOVERY
type: nib-module
version: "1.0.0"
scope: git-commits-push-TL
status: active
consumers: [claude-code]
superseded_by: []
---

# 📋 NIB-M — Module Brief : Discovery

*VegaCorp — July 2026*

## 1. Purpose
This module identifies git repositories that contain uncommitted modifications or unpushed commits within the configured search paths. It acts as the initial data source (Phase 1) for the Turnlock orchestrator.

## 2. Interface

**Inputs:**
- `settings: Settings` (Provided by the orchestrator after reading `settings.json`)

**Outputs:**
- `RepositoryInfo[]`: A list of absolute paths mapped to unique IDs.

```typescript
interface RepositoryInfo {
  id: string;   // Unique identifier (hash or normalized string of physical path)
  path: string; // Absolute directory path
}
```

## 3. Algorithm

```typescript
function runDiscovery(settings: Settings): RepositoryInfo[] {
  const searchPaths = settings.searchPaths.length > 0 
    ? settings.searchPaths 
    : ["~/Developper/Projects"];
  
  const dirtyRepos: RepositoryInfo[] = [];

  for (const root of searchPaths) {
    const repos = findGitDirectoriesRecursively(expandPath(root));
    
    for (const repoPath of repos) {
      if (isDetachedHead(repoPath)) {
        continue;
      }
      
      const isDirty = hasLocalChanges(repoPath) || hasUnpushedCommits(repoPath);
      
      if (isDirty) {
        dirtyRepos.push({
          id: generateUniqueId(repoPath),
          path: repoPath
        });
      }
    }
  }

  return dirtyRepos;
}

// Git Helpers
function isDetachedHead(path: string): boolean {
  // exec: git branch --show-current
  // return true if empty or throws
}

function hasLocalChanges(path: string): boolean {
  // exec: git status --porcelain
  // return true if output is not empty
}

function hasUnpushedCommits(path: string): boolean {
  // exec: git log @{u}..HEAD 
  // (fallback to git cherry -v if upstream is not set)
  // return true if output is not empty
}
```

## 4. Edge Cases
- **Detached HEAD**: If a repo is in a detached HEAD state, it cannot be safely pushed. It is ignored entirely.
- **No upstream branch**: `git log @{u}..HEAD` fails if there is no tracking branch. Fallback to `git cherry -v` or assume unpushed if `git push --dry-run` indicates it.
- **Invalid path**: If a search path does not exist, log a warning and continue.

## 5. Constraints
- The directory scanning must be fast (ignore `node_modules` and hidden folders other than `.git`).
- Must operate sequentially to avoid blocking the OS limits on spawn processes, but can be fast since `git status` is local.

## 6. Integration
```typescript
// From Turnlock orchestrator Phase 1
const repos = await runDiscovery(settings);
for (const repo of repos) {
  state[repo.id] = { repository: repo.path, status: "PENDING", phase: 1 };
}
```
