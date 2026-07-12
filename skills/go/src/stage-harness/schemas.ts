import { z } from "zod";
import type {
  JsonObject,
  JsonValue,
  StageDraftOutput,
  StageError,
  StageInput,
  StageOutput,
} from "./types.ts";

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number().finite(),
    z.string(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

export const jsonObjectSchema: z.ZodType<JsonObject> = z.record(
  z.string(),
  jsonValueSchema,
);

export const stageInputSchema = z
  .object({
    runId: z.string(),
    workDir: z.string(),
    artefactDir: z.string(),
    baseSha: z.string(),
    stage: z.string(),
    config: z.optional(jsonObjectSchema),
  })
  .strict() as z.ZodType<StageInput>;

export const stageErrorSchema = z
  .object({
    message: z.string(),
    severity: z.enum(["blocking", "major", "minor"]),
    file: z.optional(z.string()),
    line: z.optional(z.number().int()),
    evidenceRef: z.optional(z.string()),
  })
  .strict() as z.ZodType<StageError>;

export const stageDraftOutputSchema: z.ZodType<StageDraftOutput> = z
  .object({
    status: z.enum(["passed", "failed", "skipped"]),
    evidenceRefs: z.array(z.string()),
    errors: z.array(stageErrorSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.status === "passed" || value.status === "skipped") &&
      value.errors.length !== 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.status} requires zero errors`,
      });
    }

    if (value.status === "failed" && value.errors.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed requires at least one error",
      });
    }
  });

export const stageOutputSchema: z.ZodType<StageOutput> = z
  .object({
    runId: z.string().min(1),
    stage: z.string().min(1),
    status: z.enum(["passed", "failed", "skipped", "errored"]),
    artefactDir: z.string().min(1),
    evidenceRefs: z.array(z.string()),
    errors: z.array(stageErrorSchema),
    headShaAfter: z.nullable(z.string()),
    trackedWorktreeHash: z.nullable(z.string()),
    worktreeClean: z.nullable(z.boolean()),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.status === "passed" || value.status === "skipped") &&
      value.errors.length !== 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${value.status} requires zero errors`,
      });
    }

    if (value.status === "failed" && value.errors.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "failed requires at least one error",
      });
    }

    if (
      value.status === "errored" &&
      !value.errors.some((error) => error.severity === "blocking")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "errored requires at least one blocking error",
      });
    }

    if (value.status !== "errored") {
      if (value.headShaAfter === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "non-errored output requires headShaAfter",
        });
      }

      if (value.trackedWorktreeHash === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "non-errored output requires trackedWorktreeHash",
        });
      }

      if (value.worktreeClean === null) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "non-errored output requires worktreeClean",
        });
      }
    }
  });
