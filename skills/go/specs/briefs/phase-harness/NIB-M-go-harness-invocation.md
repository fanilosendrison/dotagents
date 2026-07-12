---
id: NIB-M-GO-HARNESS-INVOCATION
type: nib-module
version: "1.0.0"
scope: go-phase-harness/invocation
status: active
consumers: [codex]
superseded_by: []
---

# NIB-M - `/go` Harness Invocation

VegaCorp - July 2026

---

## 1. Purpose

This module invokes a phase function exactly once with normalized harness input.
It captures whether the phase returned a draft value or threw an exception.

The module deliberately does not validate the returned value. Shape validation
belongs to the schemas and evidence modules, and status normalization belongs to
the assembly module.

---

## 2. Inputs

```ts
type Phase = (input: PhaseInput) => Promise<PhaseDraftOutput>;

type InvokePhaseFunctionInput = {
  phaseFn: Phase;
  input: ResolvedPhaseInput;
};
```

`input` is produced by M2 after successful artefact directory creation.

---

## 3. Outputs

```ts
type PhaseExecutionResult =
  { kind: "returned"; draft: unknown } | { kind: "threw"; message: string };
```

The output preserves a returned value as `unknown` because M5 owns draft schema
validation. A thrown value is converted to a human-readable message.

---

## 4. Algorithm

### 4.1 Invoke phase once

```ts
async function invokePhaseFunction(
  input: InvokePhaseFunctionInput,
): Promise<PhaseExecutionResult> {
  try {
    const draft = await input.phaseFn(input.input);
    return { kind: "returned", draft };
  } catch (cause) {
    return {
      kind: "threw",
      message: stringifyThrownValue(cause),
    };
  }
}
```

The phase receives the normalized `ResolvedPhaseInput` object. The module must
not pass the original unresolved input.

### 4.2 Stringify thrown values

Use this order:

1. If the thrown value is an `Error` with a non-empty `message`, use it.
2. If it is a string, use the string.
3. If it can be JSON-stringified to a non-empty string, use that string.
4. Otherwise use `Phase threw a non-serializable value`.

The thrown stack may be written to evidence only by a future diagnostics module.
It is not part of this module's output contract.

### 4.3 No stdout or stderr capture

This v1 module does not capture process-global stdout or stderr. In-process
capture is not guaranteed by the phase contract. Phases that need diagnostics
must write evidence files and return evidence references.

---

## 5. Example

Phase:

```ts
const passingPhase: Phase = async () => ({
  status: "passed",
  evidenceRefs: [],
  errors: [],
});
```

Expected invocation output:

```ts
{
  kind: "returned",
  draft: {
    status: "passed",
    evidenceRefs: [],
    errors: [],
  },
}
```

Throwing phase:

```ts
const throwingPhase: Phase = async () => {
  throw new Error("tool failed");
};
```

Expected invocation output:

```ts
{
  kind: "threw",
  message: "tool failed",
}
```

---

## 6. Edge cases

- Phase resolves to `undefined`: return `kind: "returned"` with
  `draft: undefined`; M5 rejects it.
- Phase returns `status: "errored"`: return it unchanged; M5 rejects it.
- Phase throws a string: return that string as the message.
- Phase throws an object: return a JSON string if possible.
- Phase throws a cyclic object: return the non-serializable fallback message.
- Phase writes `output.json`: invocation still returns normally; M5 detects the
  reserved-file violation.

---

## 7. Constraints

- The phase must be called exactly once.
- The module must await the phase promise before returning.
- The module must not import or call Turnlock.
- The module must not catch and suppress process termination outside normal
  JavaScript exception flow.
- The module must not validate evidence, Git state, or final status.

The phase implementation contract remains binding: a phase must not return while
background work can still mutate `workDir` or `artefactDir`.

---

## 8. Integration

`runPhase` invokes M3 after M2:

```ts
const execution = await invokePhaseFunction({
  phaseFn,
  input: normalizedInput,
});
```

M4 must run after M3 regardless of whether `execution.kind` is `returned` or
`threw`.

---

VegaCorp - Implicit-Free Execution (IFE) - "Reliability precedes intelligence."
