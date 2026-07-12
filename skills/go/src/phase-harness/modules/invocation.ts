import type {
  Phase,
  PhaseExecutionResult,
  ResolvedPhaseInput,
} from "../types.ts";
import { stringifyThrownValue } from "../runtime/thrown-values.ts";

export async function invokePhaseFunction(input: {
  phaseFn: Phase;
  input: ResolvedPhaseInput;
}): Promise<PhaseExecutionResult> {
  try {
    const draft = await input.phaseFn(input.input);
    return { kind: "returned", draft };
  } catch (cause) {
    return { kind: "threw", message: stringifyThrownValue(cause) };
  }
}
