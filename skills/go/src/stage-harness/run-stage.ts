import { assembleAndNormalizeOutput } from "./modules/assembly.ts";
import { validateDraftAndEvidence, validateReservedHarnessFiles } from "./modules/evidence.ts";
import { invokeStageFunction } from "./modules/invocation.ts";
import { createArtefactDirectory, writeCanonicalOutputAtomically } from "./modules/persistence.ts";
import { runInputPreflight } from "./modules/preflight.ts";
import { collectCanonicalState } from "./modules/state.ts";
import {
  HarnessNormalizationError,
  HarnessPersistenceError,
  HarnessPreflightError,
  HarnessSetupError,
} from "./errors.ts";
import type { Stage, StageInput, StageOutput } from "./types.ts";

export async function runStage(
  stageFn: Stage,
  input: StageInput,
): Promise<StageOutput> {
  const preflight = await runInputPreflight(input);
  if (!preflight.ok) {
    throw new HarnessPreflightError(preflight.reason);
  }

  const created = await createArtefactDirectory({ input: preflight.input });
  if (!created.ok) {
    throw new HarnessSetupError(created.reason);
  }

  const normalizedInput = created.input;
  const execution = await invokeStageFunction({ stageFn, input: normalizedInput });
  const canonicalState = await collectCanonicalState({ input: normalizedInput });
  const validation =
    execution.kind === "returned"
      ? await validateDraftAndEvidence({
          input: normalizedInput,
          draft: execution.draft,
        })
      : await validateReservedHarnessFiles({ input: normalizedInput });

  const assembled = assembleAndNormalizeOutput({
    input: normalizedInput,
    execution,
    canonicalState,
    validation,
  });
  if (!assembled.ok) {
    throw new HarnessNormalizationError(assembled.reason);
  }

  const persisted = await writeCanonicalOutputAtomically({
    output: assembled.output,
  });
  if (!persisted.ok) {
    throw new HarnessPersistenceError(persisted.reason);
  }

  return persisted.output;
}
