---
okf_version: "1.0"
kind: "KnowledgeAsset"
asset_type: "specification"
domain: "architecture"
severity: "strict"
name: "NX-ADR-EXTRACTION: Turnlock Map-Reduce for ADRs"
---

# NX-ADR-EXTRACTION: Turnlock Map-Reduce Orchestration

## 1. Context & Problem Statement
During the autonomous creation of Architecture Decision Records (ADRs) from session logs, the agent in Step 1 (`01-granularity-analysis`) is required to read massive JSONL transcripts. This monolithic reading approach results in severe **Context Loss** (saturation), causing the LLM to systematically miss "silent" or late-stage architectural decisions (e.g., the adoption of OKF).

## 2. Objective
Solve the Context Loss problem by refactoring the ADR extraction pipeline into a **Map-Reduce** architecture orchestrated by **Turnlock**. We will utilize `deepseek-v4-pro` via the `llm-runtime` package to process transcript chunks in parallel, guaranteeing 100% attention retention across the entire conversation.

## 3. Architecture Design

The architecture relies on 3 distinct phases managed by Turnlock:

### Phase 1: Parsing & Chunking
A pre-processor reads the `transcript.jsonl` and isolates `USER_INPUT` and `MODEL_RESPONSE` payloads, stripping away tool calls and system logs to reduce noise.
The conversation is then sliced into **Temporal Chunks**.
*(Note: The exact chunk size—e.g., 40-50 messages—is pending empirical testing, but the chunking logic must preserve the chronological flow without cutting a single turn of conversation in half).*

### Phase 2: The Map Phase (Fan-Out Batching)
Turnlock initiates a `batch` delegation. For `N` chunks, Turnlock spawns `N` parallel execution nodes.
- **Runtime**: Each node executes an independent `llm-runtime` call.
- **Model**: `deepseek-v4-pro`.
- **System Prompt**: Enforces the heuristics defined in `adr-granularity.md`.
- **Expected Output**: A strictly typed JSON array of candidate decisions extracted *only* from that specific chunk.

### Phase 3: The Reduce Phase (Fan-In & Deduplication)
Turnlock awaits the resolution of the batch. The `N` JSON arrays are flattened into a single array (`candidate-decisions.json`).
- Turnlock launches a final `llm-runtime` call (the "Reducer").
- **Task**: The Reducer deduplicates overlapping decisions (e.g., a decision spanning across Chunk 2 and Chunk 3) and applies the naming conventions (`extraction-file-naming.md`).
- **Final Output**: The consolidated `output/decisions-list.md`.

## 4. Infrastructure & Security

### 4.1. LLM Provider Routing
All calls must be routed to `deepseek-v4-pro`, which provides the highest density logic extraction capabilities for JSON and architectural concepts.

### 4.2. API Key Management (Doppler)
In strict compliance with `managing-api-keys.md`, no API keys will be hardcoded or passed via raw environment variables.
The script will fetch the newly provisioned key from Doppler at runtime:
- **Key Name**: `DEEPSEEK_API_KEY_ADR_CREATOR`
- **Doppler Project**: `adr-creator`
- **Doppler Config**: `dev_personal`

The fetch command injected into the environment will be:
`doppler secrets get DEEPSEEK_API_KEY_ADR_CREATOR -p adr-creator -c dev_personal --plain`

### 4.3. Dependencies
The orchestrator will utilize the standard published npm packages for the workspace:
- `@turnlock/core` (for the state machine and `batch` primitives)
- `llm-runtime` (for the standardized LLM wrapper)

## 5. Next Steps / Action Items
1. **Develop `turnlock-orchestrator.ts`**: Write the Turnlock flow inside `01-granularity-analysis/scripts/`.
2. **Chunk Size Calibration**: Run an empirical test on a 150-message transcript to determine if the chunk size should be based on message count (e.g., 40) or token limits.
3. **Update Step 1 Context**: Modify `01-granularity-analysis/CONTEXT.md` to trigger the `turnlock-orchestrator.ts` script instead of relying on the agent's native reading capabilities.
