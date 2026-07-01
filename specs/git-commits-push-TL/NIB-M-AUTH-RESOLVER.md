---
id: NIB-M-AUTH-RESOLVER
type: nib-module
version: "1.0.0"
scope: git-commits-push-TL
status: active
consumers: [claude-code]
superseded_by: []
---

# 📋 NIB-M — Module Brief : Auth Resolver

*VegaCorp — July 2026*

## 1. Purpose
This is a standalone, reusable module inside the Pi wrapper that resolves API authentication tokens. It implements a deterministic cascade of resolution rules to securely provide tokens whether the user runs a "Vanilla Pi" setup or a sophisticated secret manager (e.g., Doppler, 1Password).

## 2. Interface

**Inputs:**
- `provider: string` (e.g., "anthropic", "openai", "gemini")

**Outputs:**
- `Promise<string>` (The raw, resolved API token)

Throws an Error if no token can be found or dynamically generated.

## 3. Algorithm

```typescript
import * as path from 'path';
import * as os from 'os';

async function resolveAuthToken(provider: string): Promise<string> {
  const envKey = `${provider.toUpperCase()}_API_KEY`;

  // 1. Check System Environment Variable
  if (process.env[envKey]) {
    return process.env[envKey];
  }

  // 2. Read ~/.pi/agent/auth.json
  const authFilePath = path.join(os.homedir(), '.pi', 'agent', 'auth.json');
  const authData = await readJsonFile(authFilePath);
  
  const tokenConfig = authData[provider];
  if (!tokenConfig) {
    throw new Error(`Authentication token for provider ${provider} not found in env or auth.json`);
  }

  // 3. Dynamic Execution (Starts with !)
  if (tokenConfig.startsWith('!')) {
    const command = tokenConfig.slice(1);
    // Execute dynamically, check exit code, and return only stdout (trimmed)
    const { stdout, stderr } = await execAsync(command);
    // Note: execAsync throws if exit code !== 0, which propagates up.
    return stdout.trim();
  }

  // 4. Raw static token
  return tokenConfig.trim();
}
```

## 4. Edge Cases
- **Missing Provider**: If the provider string does not exist in `auth.json` and is missing from ENV, it must throw immediately so the wrapper can fail gracefully.
- **Dynamic Command Fails**: If the shell command `!` returns a non-zero exit code (e.g., secret manager session expired), the exception naturally propagates up and fails the LLM inference step.
- **Command Output Noise**: If the command writes warnings or logs to `stderr` but succeeds (exit code 0), only the `stdout` is captured and returned as the token, ensuring no noise contaminates the API key.

## 5. Constraints
- The module must be strictly separated from the Turnlock orchestrator. It must export a single pure asynchronous function so that future Pi tools can import it.
- Executing dynamic commands must verify the command exit code, capture only `stdout` as the key, and strip trailing newlines and carriage returns (`\r`, `\n`).

## 6. Integration
```typescript
// Inside NIB-M-PI-WRAPPER
const token = await resolveAuthToken(item.provider);
```
