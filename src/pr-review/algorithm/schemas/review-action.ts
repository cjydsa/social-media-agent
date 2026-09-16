import { z } from "zod";
import {
  IsoTimestampSchema,
  NonBlankIdSchema,
  PositiveVersionSchema,
  ReviewActionTypeSchema,
} from "./common.js";

export const ReviewActorSchema = z.strictObject({
  id: NonBlankIdSchema,
  displayName: z.string(),
  role: z.string(),
});
export type ReviewActor = z.infer<typeof ReviewActorSchema>;

export const ReviewActionSchema = z
  .strictObject({
    actor: ReviewActorSchema,
    action: ReviewActionTypeSchema,
    reason: z.string(),
    fromVersion: PositiveVersionSchema.nullable(),
    toVersion: PositiveVersionSchema.nullable(),
    timestamp: IsoTimestampSchema,
  })
  .superRefine((action, context) => {
    if (action.action !== "REVISE") return;

    if (action.fromVersion === null || action.toVersion === null) {
      context.addIssue({
        code: "custom",
        message: "REVISE requires non-null fromVersion and toVersion.",
        path: ["toVersion"],
      });
      return;
    }

    if (action.toVersion !== action.fromVersion + 1) {
      context.addIssue({
        code: "custom",
        message: "REVISE requires toVersion to equal fromVersion + 1.",
        path: ["toVersion"],
      });
    }
  });
export type ReviewAction = z.infer<typeof ReviewActionSchema>;
