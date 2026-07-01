---
id: NIB-S-GIT-COMMITS-PUSH
type: nib-system
version: "1.0.0"
scope: git-commits-push
status: active
consumers: [claude-code]
superseded_by: []
---

# 📋 NIB-S — System Brief : git-commits-push-TL

*VegaCorp — July 2026*

---

## 1. System Objective

The system automates the scanning, testing, security-scanning, LLM-based commit generation, committing, and pushing of git modifications across multiple repositories using the Turnlock orchestrator, maximizing execution speed through parallel workers and minimizing agent cognitive load.

---

## 2. Pipeline Architecture

The system executes in a two-stage CLI invocation workflow (initial scan and LLM delegation, followed by execution resume).

```
[CLI Init Command]
       │
       ▼
┌─────────────────────────────────────────┐
│ Phase 1: Discovery (Sequential)         │
│ Scan directories & find dirty repos     │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Phase 2: Validation & Diff Extraction   │
│ (Strictly Parallel workers per repo)    │
│  - Test execution                       │
│  - git add -A                           │
│  - Extract diff & generate diffHash     │
│  - secret-scanner check                 │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Phase 3: LLM Delegation                 │
│  - Write manifest.json                  │
│  - Emit @@TURNLOCK@@ DELEGATE tag       │
│  - Voluntary Exit / Yield                │
└─────────────────────────────────────────┘
       │
   (Host LLM executes inference and writes result.json)
       │
       ▼
[CLI --resume Command]
       │
       ▼
┌─────────────────────────────────────────┐
│ Phase 4: Commit & Push                  │
│ (Strictly Parallel workers per repo)    │
│  - Verify diffHash (prevent race)       │
│  - git commit --no-verify               │
│  - git push                             │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────┐
│ Phase 5: Reporting                      │
│ Read FSM dictionary & print summary     │
└─────────────────────────────────────────┘
```

---

## 3. Data Structures & Types

```typescript
interface Settings {
  searchPaths: string[];         // Root paths to scan (default: ["~/Developper/Projects"])
  provider: string;              // LLM Provider (e.g. "anthropic")
  model: string;                 // LLM Model (e.g. "claude-3-5-sonnet-20241022")
  temperature: number;           // LLM Temperature
  systemPromptPath: string;      // Path to system prompt file
  autoPush: boolean;             // Automatically push commits
  skipTests: boolean;            // Skip Phase 2 test suite execution
}

interface RepositoryInfo {
  id: string;                    // Unique identifier (hash of physical path)
  path: string;                  // Absolute directory path
}

interface CommitMessage {
  type: string;                  // conventional commits: feat, fix, chore, docs, style, refactor, perf, test
  scope?: string;
  description: string;           // short sentence
  body?: string;                 // optional details
  isBreaking: boolean;
}

// Structured parameters serialized inside the prompt of AgentBatchDelegationRequest
interface CommitJobPayload {
  repository: string;            // Absolute path
  diff: string;                  // Staged git diff
  diffHash: string;
  provider: string;
  model: string;
  temperature: number;
  systemPrompt: string;
}

// Structured output written by the wrapper to each job's resultPath
interface CommitJobResultSuccess {
  success: true;
  id: string;                    // Repository ID
  commit: CommitMessage;
}

interface CommitJobResultError {
  success: false;
  id: string;                    // Repository ID
  error: string;
}

type CommitJobResult = CommitJobResultSuccess | CommitJobResultError;

interface RepoState {
  repository: string;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "FAILED";
  diffHash?: string;
  commit?: CommitMessage;
  error?: string;
}

interface GlobalState {
  repos: Record<string, RepoState>; // Key is RepositoryInfo.id
}

```

---

## 4. Module Boundaries & Specification Files

This section maps the execution phases to their respective **Module Briefs (NIB-M)** and **Dependency Contracts (DC)**.

### Phase 1: Discovery
- **Module Specification**: [NIB-M-DISCOVERY.md](file:///Users/famillesendrison/.agents/specs/git-commits-push-TL/NIB-M-DISCOVERY.md)
- **Input**: `Settings`
- **Output**: `RepositoryInfo[]`
- **Contract**: Read configuration from `settings.json` located in the skill directory (`/Users/famillesendrison/.agents/skills/git-commits-push/settings.json`). Scan directories listed in `Settings.searchPaths` (with fallback to `~/Developper/Projects`). Exclude repositories in "Detached HEAD" state. Find repositories with untracked/modified files (`git status --porcelain`) or unpushed commits (`git cherry -v` or `git log @{u}..HEAD`).

### Phase 2: Validation & Diff Extraction
- **Module Specification**: [NIB-M-VALIDATION.md](file:///Users/famillesendrison/.agents/specs/git-commits-push-TL/NIB-M-VALIDATION.md)
- **Dependency Contract**: [DC-SECRET-SCANNER.md](file:///Users/famillesendrison/.agents/specs/git-commits-push-TL/DC-SECRET-SCANNER.md)
- **Input**: `RepositoryInfo[]`
- **Output**: `Record<string, { diff: string; diffHash: string }>` (in-memory state mapped by repo ID)
- **Contract**: Execute in parallel. Run test suite auto-discovery (unless `skipTests: true`). Perform `git add -A`. Extract cache diff (`git diff --cached`). Generate a SHA-256 hash of the diff (`diffHash`). Invoke `secret-scanner`'s `scanDiff` following `DC-SECRET-SCANNER.md`. Fail the worker if tests fail or a secret is detected.

### Phase 3: LLM Delegation
- **Module Specification**: [NIB-M-PI-WRAPPER.md](file:///Users/famillesendrison/.agents/specs/git-commits-push-TL/NIB-M-PI-WRAPPER.md) & [NIB-M-AUTH-RESOLVER.md](file:///Users/famillesendrison/.agents/specs/git-commits-push-TL/NIB-M-AUTH-RESOLVER.md)
- **Dependency Contract**: [DC-LLM-RUNTIME.md](file:///Users/famillesendrison/.agents/specs/git-commits-push-TL/DC-LLM-RUNTIME.md)
- **Input**: `Record<string, { diff: string; diffHash: string }>` + `Settings`
- **Output**: Writes `manifest-[attempt].json` to `<runDir>/delegations/`, prints the `@@TURNLOCK@@` protocol block (including `resume_cmd`) to stdout, and exits.
- **Contract**: Construct a `ManifestItem[]` using settings prompt files and repository diffs. Write it to the execution run directory, ensuring the wrapper knows the target `resultPath` (under `<runDir>/results/`) to write the output JSON. The Pi wrapper handles LLM invocation and Auth resolution using the secrets resolving pipeline.

### Phase 4: Commit & Push
- **Module Specification**: [NIB-M-GIT-EXECUTION.md](file:///Users/famillesendrison/.agents/specs/git-commits-push-TL/NIB-M-GIT-EXECUTION.md)
- **Input**: `ResultItem[]` (read from the dynamic `resultPath` file in Turnlock's run directory) + `Record<string, { diffHash: string }>` (saved state)
- **Output**: Modifies state of Git repositories.
- **Contract**: Executed upon `--resume` CLI command triggered by the wrapper using `resume_cmd` read from the stdout protocol block. Verify `diffHash` to prevent race conditions. Commit changes with `git commit --no-verify` under `GIT_TERMINAL_PROMPT=0`. If `autoPush` is true, run `git push` with a timeout (falling back to `git push -u origin <branch>` if no upstream is set).

### Phase 5: Reporting
- **Module Specification**: Integrated into System Orchestrator (no separate NIB-M required).
- **Input**: `GlobalState`
- **Output**: Writes standard execution report to stdout.
- **Contract**: Print a clean, readable text report listing successful commits/pushes and detailing failures (e.g. tests failed, secrets found, push rejected).

---

## 5. Global Invariants

- **I1 — Non-Interactive Shells**: All subcommands must run with `GIT_TERMINAL_PROMPT=0` to ensure no prompts block the workflow.
- **I2 — Parallel Workers**: Processing of Phase 2 and Phase 4 must occur in parallel across all repositories.
- **I3 — Idempotent Resume**: Turnlock maintains a serialized FSM state on disk to preserve error states and execution metrics across CLI processes.
- **I4 — No-Improvise Error Handling**: If any shell subcommand fails, the error must be logged into the persistent state dictionary, and the worker for that repository must immediately abort.

---

## 6. Cross-Cutting Policies

- **P1 — Authentication Resolution**: Resolving LLM API keys must follow this pipeline:
  1. Check system environment variables (e.g., `ANTHROPIC_API_KEY`).
  2. Fallback: Read `~/.pi/agent/auth.json`.
  3. If key value starts with `!`, execute the remaining string dynamically as a shell command to retrieve the token (e.g. `!doppler secrets get...`).
- **P2 — Diff Race Protection**: No commits are allowed in Phase 4 if the repository's current diff hash differs from the one recorded in Phase 2.
- **P3 — Clean Inferences**: Inferences must use `stripJsonFence: true` to prevent markdown code blocks from contaminating the JSON parser.

---

## 7. Output Contract (Phase 5 Summary)

The terminal stdout generated at Phase 5 must conform to:
```text
=== TURNLOCK EXECUTION REPORT ===

✅ [<repo-id-A>] Commit et Push réussis.
❌ [<repo-id-B>] Tests échoués (Phase 2). Dépôt ignoré.
❌ [<repo-id-C>] Erreur réseau git push (Phase 4).

=================================
```

## 8. Orchestration Pseudocode

```typescript
import { definePhase } from "turnlock/define-phase";
import { runOrchestrator } from "turnlock/engine/run-orchestrator";
import type { OrchestratorConfig } from "turnlock/types/config";
import { z } from "zod";

// Zod schemas for validation inside Turnlock
const CommitJobResultSchema = z.union([
  z.object({
    success: z.literal(true),
    id: z.string(),
    commit: z.object({
      type: z.string(),
      scope: z.string().optional(),
      description: z.string(),
      body: z.string().optional(),
      isBreaking: z.boolean(),
    }),
  }),
  z.object({
    success: z.literal(false),
    id: z.string(),
    error: z.string(),
  }),
]);

const config: OrchestratorConfig<GlobalState> = {
  name: "git-commits-push-TL",
  initial: "discoveryAndValidation",
  initialState: { repos: {} },
  resumeCommand: (runId) => `bun run turnlock-skill.ts --run-id ${runId} --resume`,
  phases: {
    discoveryAndValidation: definePhase<GlobalState>(async (state, io) => {
      const settings = readSettings();
      
      // Phase 1: Discovery
      const repos = await runDiscovery(settings);
      const nextReposState: Record<string, RepoState> = {};
      for (const repo of repos) {
        nextReposState[repo.id] = { repository: repo.path, status: "PENDING" };
      }
      
      const intermediateState = { ...state, repos: nextReposState };
      
      // Phase 2: Parallel Validation
      await runParallel(repos, async (repo) => {
        intermediateState.repos[repo.id].status = "RUNNING";
        try {
          const { diff, diffHash } = await processRepoValidationAndDiff(repo, settings);
          intermediateState.repos[repo.id].diffHash = diffHash;
          intermediateState.repos[repo.id].status = "SUCCESS";
        } catch (err) {
          intermediateState.repos[repo.id].status = "FAILED";
          intermediateState.repos[repo.id].error = err.message;
        }
      });
      
      // Phase 3: Prepare Delegation
      const successfulRepos = repos.filter(r => intermediateState.repos[r.id].status === "SUCCESS");
      if (successfulRepos.length === 0) {
        printReport(intermediateState.repos);
        return io.done({});
      }
      
      // Build delegation jobs
      const jobs = successfulRepos.map((repo) => {
        const repoState = intermediateState.repos[repo.id];
        const payload: CommitJobPayload = {
          repository: repo.path,
          diff: repoState.diffHash!, // Staged diff should be retrieved in wrapper
          diffHash: repoState.diffHash!,
          provider: settings.provider,
          model: settings.model,
          temperature: settings.temperature,
          systemPrompt: readSystemPrompt(settings.systemPromptPath),
        };
        return {
          id: repo.id,
          prompt: JSON.stringify(payload),
        };
      });
      
      return io.delegateAgentBatch(
        {
          kind: "agent-batch",
          agentType: "git-commit-generator",
          jobs,
          label: "commit-jobs",
        },
        "commitAndPush",
        intermediateState
      );
    }),

    commitAndPush: definePhase<GlobalState>(async (state, io) => {
      const settings = readSettings();
      
      // Retrieve results processed by the wrapper
      const results = io.consumePendingBatchResults(CommitJobResultSchema);
      const nextRepos = { ...state.repos };
      
      // Phase 4: Commit & Push Parallel Workers
      await runParallel(results, async (result) => {
        const repoState = nextRepos[result.id];
        if (!repoState || repoState.status !== "SUCCESS") return;
        
        repoState.status = "RUNNING";
        
        if (result.success === false) {
          repoState.status = "FAILED";
          repoState.error = result.error;
          return;
        }
        
        try {
          await executeCommitAndPush(
            repoState.repository,
            result.commit,
            repoState.diffHash!,
            settings
          );
          repoState.status = "SUCCESS";
          repoState.commit = result.commit;
        } catch (err) {
          repoState.status = "FAILED";
          repoState.error = err.message;
        }
      });
      
      // Phase 5: Reporting
      printReport(nextRepos);
      return io.done({});
    }),
  },
};

async function main() {
  await runOrchestrator(config);
}
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
