// Zod schema for AI-autofilled work-order fields. From a free-text description
// the model proposes a clean, structured draft the user can review and edit
// before submitting. Same zod/v4 import rule as the other AI schemas.

import * as z from "zod/v4";
import { ASSET_CATEGORIES } from "./schema";

export const WorkOrderDraftSchema = z.object({
  title: z.string().describe("Concise work-order title, at most ~8 words, no trailing punctuation"),
  category: z.enum(ASSET_CATEGORIES),
  priority: z.enum(["low", "medium", "high", "critical"]),
  severity: z.enum(["low", "medium", "high", "critical"]).describe("How bad the condition is, often aligned with priority"),
  cleanedDescription: z.string().describe("A clear, operator-ready 1-2 sentence description of the problem"),
  locationName: z
    .string()
    .nullable()
    .describe("Building/area named in the report. If a provided building name matches, use it verbatim; otherwise the named place, or null if none."),
  assetName: z.string().nullable().describe("The specific equipment/asset involved, if named; else null"),
  suggestedDueInDays: z
    .number()
    .int()
    .describe("How many days from now this should be due, based on urgency (0 = today/immediate, 1 = tomorrow, 7 = this week, 30 = routine)"),
  confidence: z.enum(["low", "medium", "high"]).describe("Confidence in this draft given how much the report actually says"),
  needsMoreInfo: z
    .array(z.string())
    .describe("At MOST 3 short prompts for what the user should add to improve the work order. Empty if the report is already solid."),
});

export type WorkOrderDraft = z.infer<typeof WorkOrderDraftSchema>;
