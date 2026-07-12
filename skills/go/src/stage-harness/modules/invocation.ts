import type {
  Stage,
  StageExecutionResult,
  ResolvedStageInput,
} from "../types.ts";
import { stringifyThrownValue } from "../runtime/thrown-values.ts";

export async function invokeStageFunction(input: {
  stageFn: Stage;
  input: ResolvedStageInput;
}): Promise<StageExecutionResult> {
  try {
    const draft = await input.stageFn(input.input);
    return { kind: "returned", draft };
  } catch (cause) {
    return { kind: "threw", message: stringifyThrownValue(cause) };
  }
}
