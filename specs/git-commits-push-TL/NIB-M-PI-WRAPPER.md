---
id: NIB-M-PI-WRAPPER
type: nib-module
version: "1.0.0"
scope: git-commits-push-TL
status: active
consumers: [claude-code]
superseded_by: []
---

# 📋 NIB-M — Module Brief : Pi Wrapper & LLM Delegation

*VegaCorp — July 2026*

## 1. Purpose
This module acts as the consumer/wrapper (`pi-orch-git-commits-push`) in the Pi environment. It intercepts the Turnlock delegation tag, orchestrates the LLM API call using internal libraries, and cleanly restarts the Turnlock orchestrator.

## 2. Interface

**Inputs:**
- Executes as a shell wrapper listening to standard output from the Turnlock script.
- Reads the batch manifest file at `manifestPath` parsed from the stdout `@@TURNLOCK@@` protocol block.

**Outputs:**
- Writes the individual inference results (success or failure) to each job's respective `resultPath` as specified inside the manifest.
- Triggers the resume execution command using the exact `resumeCmd` read from the stdout protocol block.

---

## 3. Algorithm

```typescript
import { invokeLlm } from "@fanilosendrison/llm-runtime"; // See DC-LLM-RUNTIME
import { resolveAuthToken } from "./authResolver";       // See NIB-M-AUTH-RESOLVER

interface TurnlockBatchManifest {
  kind: "agent-batch";
  agentType: string;
  jobs: { id: string; prompt: string; resultPath: string }[];
  label: string;
}

async function handleTurnlockDelegation(manifestPath: string, resumeCmd: string): Promise<void> {
  const manifest: TurnlockBatchManifest = await readJsonFile(manifestPath);

  // Run LLM inference in parallel for all jobs in the batch
  await Promise.all(manifest.jobs.map(async (job) => {
    try {
      const payload: CommitJobPayload = JSON.parse(job.prompt);
      const token = await resolveAuthToken(payload.provider);
      
      const llmResponse = await invokeLlm({
        provider: payload.provider,
        model: payload.model,
        token: token,
        temperature: payload.temperature,
        systemPrompt: payload.systemPrompt,
        userPrompt: payload.diff,
        stripJsonFence: true // Mandatory per P3 policy
      });

      const commit: CommitMessage = JSON.parse(llmResponse);
      
      // Write individual success result to the job's resultPath
      const successResult: CommitJobResult = {
        success: true,
        id: job.id,
        commit
      };
      await writeJsonFile(job.resultPath, successResult);

    } catch (err) {
      // Write individual error result to the job's resultPath
      const errorResult: CommitJobResult = {
        success: false,
        id: job.id,
        error: `LLM Fatal Error: ${err.message}`
      };
      await writeJsonFile(job.resultPath, errorResult);
    }
  }));

  // Resume orchestrator dynamically
  execSync(resumeCmd, { stdio: 'inherit' });
}
```

## 4. Edge Cases
- **Rate Limiting**: `@fanilosendrison/llm-runtime` handles retries internally. If it throws, it means it's a persistent, fatal error. It is caught and written as an `error` key in `result.json`.
- **Invalid JSON Output**: If the LLM produces invalid JSON despite `stripJsonFence`, `JSON.parse()` will throw, routing to the error array properly.

## 5. Constraints
- Must use `stripJsonFence: true` when calling the LLM runtime to prevent markdown backticks (` ```json `) from breaking `JSON.parse`.
- Execution must run in parallel for all manifest items to bound latency.

## 6. Integration
```bash
# In the bash extension wrapper
node turnlock-skill.ts | while read line; do
  if [[ "$line" == "@@TURNLOCK@@ DELEGATE kind:agent"* ]]; then
    # Trigger Wrapper Logic
    node pi-orch-git-commits-push.js
  fi
done
```
