---
id: DC-SECRET-SCANNER
type: dependency-contract
version: "1.0.0"
dependency_version: "workspace:*"
scope: secret-scanner
status: active
consumers: [claude-code]
referenced_by: [NIB-M-VALIDATION]
superseded_by: []
---

# 📄 Dependency Contract — secret-scanner

*VegaCorp — July 2026*

## 0. Identity
- **Component**: `secret-scanner`
- **Version**: Workspace internal module
- **Source**: Internal monorepo (`~/Developper/Projects/VegaCorp/secret-scanner` or similar)
- **Role**: Analyzes raw text (specifically Git diffs) to detect inadvertently staged secrets, credentials, or API keys.

## 1. Interface

```typescript
// Extracted interface from secret-scanner
interface ScanResult {
  hasSecrets: boolean;
  details?: string;     // Provided if hasSecrets is true. Describes the secrets found.
  matchCount: number;
}

// Target exported function
export function scanDiff(diffContent: string): Promise<ScanResult>;
```

## 2. Behavioral contract

**`scanDiff(diffContent: string): Promise<ScanResult>`**

- **Preconditions**:
  - `diffContent` must be a string containing a valid text payload (usually a git unified diff).
  - The module must be correctly imported from the workspace dependency.
- **Postconditions**:
  - Returns a resolved Promise with `hasSecrets: true` if ANY rule matches the content.
  - Returns a resolved Promise with `hasSecrets: false` if no patterns match.
- **Success paths**:
  - The string is successfully parsed and matched against internal regex/entropy rules. Returns standard `ScanResult`.
- **Failure paths**:
  - If the engine fails internally (e.g. out of memory on a massive diff, missing rule definitions), it **throws an Error**. 

## 3. Error semantics

- **Internal Error (Throw)**: The caller must catch internal execution errors and treat them as fatal workflow failures. If the scanner cannot run, we must assume the diff is unsafe.
- **Detection "Error" (Result)**: The detection of a secret is *not* an exception. It is returned cleanly as `hasSecrets: true`. The caller is responsible for converting this result into a domain exception (aborting the pipeline).

## 4. Integration patterns

**Call Pattern:**
```typescript
import { scanDiff } from "secret-scanner";

// During diff validation phase
const scanResult = await scanDiff(rawDiffText);
if (scanResult.hasSecrets) {
  throw new Error(`Security Exception: Secret detected in diff. ${scanResult.details}`);
}
```

## 5. Consumer constraints
- **Do NOT attempt to parse `scanResult.details`**: The structure of the details string is meant for human logs, not for machine-based logic or filtering.
- **Fail Closed**: If `scanDiff` throws an unexpected error, the consumer must fail closed (deny the commit) rather than catching and ignoring the error.

## 6. Known limitations
- The scanner processes text, not binary diffs. Binary files staged in the diff will be ignored or matched unpredictably if forced into string parsing.
