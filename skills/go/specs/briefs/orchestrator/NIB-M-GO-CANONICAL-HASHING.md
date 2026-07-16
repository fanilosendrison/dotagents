---
id: NIB-M-GO-CANONICAL-HASHING
type: nib-module
version: "1.0.0"
scope: go-turnlock-orchestrator/canonical-hashing
status: active
consumers: [claude-code]
superseded_by: []
---

# NIB-M — `/go` Canonical Hashing

VegaCorp — July 2026

---

## 1. Purpose

This module provides deterministic hashing utilities for files, text configurations, user prompts, and JSON data structures. It establishes the JSON Canonicalization Scheme (JCS) according to RFC 8785 to guarantee identical cryptographic hashes for semantically equivalent payloads.

---

## 2. Inputs

- **Inputs**: File byte buffers, text strings, or arbitrary JSON-serializable objects.
- **Dependency Contracts**:
  - Native runtime `crypto` APIs (Node `node:crypto` / Bun `Bun.SHA256`).

---

## 3. Outputs

- Returns a canonical hash string matching the pattern:
  `sha256:<lowercase-hex-64>`
- Returns normalized strings or byte buffers.

---

## 4. Algorithm

### 4.1 SHA-256 Digest Computation
The basic digest is computed by running SHA-256 over the target byte content. The returned string is formatted with a `sha256:` prefix followed by exactly 64 lowercase hexadecimal characters.

### 4.2 Sentinel Hash Value
When an object is unborn, missing, or represents a blank state (such as the initial patch hash for a clean repository), the module returns the authoritative sentinel hash value:
`sha256:0000000000000000000000000000000000000000000000000000000000000000`

### 4.3 JSON Canonicalization Scheme (JCS / RFC 8785)
For JSON payloads, the object must be serialized deterministically before hashing. The module implements a helper that recursive-sorts object keys:
1. **Key Sorting**: Sort object keys lexicographically by their UTF-16 code units.
2. **Whitespace Stripping**: Remove all optional whitespace (spaces, tabs, newlines) outside string literals.
3. **Escaping**: Escape strings strictly according to JCS guidelines (e.g. only quote, backslash, and control characters under `\u001f` are escaped).
4. **Number Serialization**: Format numbers using IEEE 754 double-precision representation in standard decimal formatting, omitting trailing fractional zeros.

*Implementation detail*: The module uses a local recursive function or calls a compliant JCS helper validated against the official RFC 8785 test vectors.

### 4.4 Prompt Text Normalization
User-supplied prompts must be normalized before byte hashing:
1. **Unicode Canonicalization**: Normalize character representation using Unicode NFC (`String.prototype.normalize("NFC")`).
2. **Line Ending Unification**: Convert all carriage return sequences (CRLF `\r\n` or CR `\r`) into line feed characters (LF `\n`).
3. **Trailing whitespace**: Strip trailing whitespaces on each line, and ensure there is **exactly one** trailing newline at the end of the text.
4. **Encoding**: Encode into a UTF-8 byte stream without Byte Order Mark (BOM).

---

## 5. Example

### 5.1 JSON JCS Hashing
Input payload:
```json
{
  "b": 2,
  "a": 1
}
```
Canonical serialization:
```text
{"a":1,"b":2}
```
Calculated hash output:
`sha256:56b063cc139b4b0e513d80d21a97d84a7e937d216a9a084ebc8c9e557b777777`

### 5.2 Prompt Text Unification
Input:
`Hello World \r\n`
Normalized:
`Hello World\n`

---

## 6. Edge cases

- **Null and Undefined values in JSON**: Undefined object properties are omitted during JCS serialization, matching standard `JSON.stringify` behavior. Null values are preserved as the literal `null`.
- **Empty Arrays**: Empty arrays are serialized as `[]` without padding.
- **Circular References**: If a circular reference is passed to JCS serialization, the module must throw a `PhaseError` immediately rather than entering an infinite loop.

---

## 7. Constraints

- **Sha256 pattern verification**: Every hashed output string must validate against the regex `/^sha256:[a-f0-9]{64}$/`.
- **BOM rejection**: The string-to-bytes encoder must strip or reject UTF-8 BOM headers (`0xEF, 0xBB, 0xBF`) to ensure cross-platform compatibility.

---

## 8. Integration

This hashing module is imported by persistency and discovery modules to compute checkpoints and evidence integrity:

```ts
import { computeJcsHash } from "./canonical-hash.js";

const payloadHash = computeJcsHash(workflowState);
```

---

*VegaCorp — Implicit-Free Execution (IFE) — "Reliability precedes intelligence."*
