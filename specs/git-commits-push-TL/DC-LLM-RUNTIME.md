---
id: DC-LLM-RUNTIME
type: dependency-contract
version: "1.0.0"
dependency_version: "workspace:*"
scope: "@fanilosendrison/llm-runtime"
status: active
consumers: [claude-code]
referenced_by: [NIB-M-PI-WRAPPER]
superseded_by: []
---

# 📄 Dependency Contract — @fanilosendrison/llm-runtime

*VegaCorp — July 2026*

## 0. Identity
- **Component**: `@fanilosendrison/llm-runtime`
- **Version**: Workspace internal module
- **Source**: Internal monorepo (`~/Developper/Projects/VegaCorp/llm-runtime`)
- **Role**: Stateless, standardized wrapper for making requests to various LLM providers (Anthropic, OpenAI, etc.). Handles retries, network mapping, and output normalization.

## 1. Interface

```typescript
export interface LlmRequest {
  provider: string;        // e.g. 'anthropic', 'openai'
  model: string;           // e.g. 'claude-3-5-sonnet-20241022'
  token: string;           // Valid API token
  temperature: number;
  systemPrompt: string;
  userPrompt: string;
  stripJsonFence?: boolean; // If true, removes ```json \n ... \n``` wrappers from output
}

// Target exported function
export function invokeLlm(request: LlmRequest): Promise<string>;
```

## 2. Behavioral contract

**`invokeLlm(request: LlmRequest): Promise<string>`**

- **Preconditions**:
  - `token` must be a populated, valid string.
  - `provider` and `model` must be supported by the internal mapping.
- **Postconditions**:
  - Returns the exact text response produced by the LLM. 
  - If `stripJsonFence` is true, the response is guaranteed to not be wrapped in markdown JSON blocks (or they are cleanly stripped).
- **Success paths**:
  - Valid API call -> Returns generated text.
  - Transient network failure -> Automatically retried internally up to 3 times -> Returns generated text.
- **Failure paths**:
  - Invalid API key -> Throws an authentication error.
  - Rate limit exceeded (after all retries) -> Throws a rate limit error.
  - Unrecognized provider/model -> Throws an initialization error.

## 3. Error semantics

- **Internal Retries**: The consumer does NOT need to implement retry logic for 5xx errors or 429 Rate Limits. The `invokeLlm` function handles standard exponential backoff.
- **Fatal Exceptions (Throw)**: If `invokeLlm` throws, it represents a **fatal, non-recoverable error** (e.g., permanent ban, quota exceeded, invalid token, or 429 persisting after max retries). The consumer must catch this and abort the inference for the affected item.

## 4. Integration patterns

**Call Pattern:**
```typescript
import { invokeLlm } from "@fanilosendrison/llm-runtime";

try {
  const resultText = await invokeLlm({
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    token: "sk-ant-...",
    temperature: 0.2,
    systemPrompt: "...",
    userPrompt: "...",
    stripJsonFence: true // Mandatory for predictable JSON parsing
  });
  
  const parsed = JSON.parse(resultText);
} catch (error) {
  // Catch fatal error and record in results array
  results.push({ id, error: error.message });
}
```

## 5. Consumer constraints
- **Stateless Usage**: The module does not manage global state or default API keys. The consumer MUST resolve and pass the `token` on every invocation.
- **JSON Parsing**: The runtime returns a string, not a JSON object. If the system prompt requests JSON, the consumer is responsible for calling `JSON.parse`. `stripJsonFence` ensures the string is parseable without manual regex cleanup.

## 6. Known limitations
- The runtime does not implement streaming. It awaits the full generation before returning. This is acceptable for short commit message generation.
