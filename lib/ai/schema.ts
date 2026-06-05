// Zod schema for the AI "Field Intelligence Report" — the structured record the
// model produces from a messy field observation + work-order/asset/location +
// public-data context. zodOutputFormat() imports zod from "zod/v4", so this file
// must use the same import to stay type-compatible with the SDK helper.

import * as z from "zod/v4";

export const ASSET_CATEGORIES = [
  "hvac",
  "electrical",
  "plumbing",
  "architectural",
  "computers_and_telecom",
  "fire_and_life_safety",
  "landscape",
  "security",
  "structural",
  "general",
] as const;

export const ReportSchema = z.object({
  headline: z
    .string()
    .describe("A scannable 6-10 word headline naming the issue and its stakes, e.g. 'Dark exit sign — egress safety risk in stairwell'"),
  bottomLine: z
    .string()
    .describe("ONE plain sentence: the single most important thing to do right now and by when."),
  structured: z
    .object({
      issueType: z.string().describe("Concise issue classification, e.g. 'Emergency lighting / egress safety'"),
      locationDetail: z.string().describe("The most specific location the report supports"),
      assetCategory: z.enum(ASSET_CATEGORIES),
      severity: z.enum(["low", "medium", "high", "critical"]),
      urgency: z.enum(["immediate", "same_day", "this_week", "routine"]),
      affectedUsers: z.string().describe("Who is impacted and roughly how many — one short phrase"),
      evidenceQuality: z.enum(["none", "weak", "moderate", "strong"]),
      likelyRootCauses: z.array(z.string()).describe("At MOST 3 candidate root-cause categories, most likely first. Short phrases, not sentences."),
      missingInformation: z.array(z.string()).describe("At MOST 3 things the system still does not know. Short phrases."),
      followUpQuestions: z.array(z.string()).describe("At MOST 3 short questions to ask the reporter to close gaps"),
    })
    .describe("The raw signal structured into operational data"),
  cleanedDescription: z.string().describe("A clear, operator-ready rewrite of the work-order description — 1-2 sentences, no fluff"),
  publicData: z.object({
    operationalMeaning: z
      .string()
      .describe("What the public records imply for THIS issue — translated to action, not just counts"),
    references: z
      .array(z.object({ source: z.string(), detail: z.string() }))
      .describe("Specific public sources/records and what each means here. Empty if none found."),
  }),
  compliance: z
    .array(
      z.object({
        obligation: z.string().describe("The rule/inspection/standard implicated — short"),
        source: z.string().describe("Where it comes from, e.g. 'NYC Fire Code', 'NFPA 101', 'DOB'"),
        why: z.string().describe("Why this issue touches that obligation — one short phrase"),
      }),
    )
    .describe("At MOST 3 obligations the issue lives inside — not legal advice, but what to check before closing"),
  operationalImplications: z.array(z.string()).describe("At MOST 3 downstream consequences if unaddressed. Short phrases."),
  recommendedWorkflow: z.object({
    suggestedNextActions: z.array(z.string()).describe("3-5 ordered, concrete next steps for the operator. Each one short imperative line."),
    suggestedAssignmentGroup: z.string().describe("Which team/trade should own this"),
    evidenceChecklist: z.array(z.string()).describe("At MOST 4 pieces of evidence to collect to confirm/close the issue"),
    escalation: z.object({
      shouldEscalate: z.boolean(),
      level: z.enum(["none", "standard", "urgent", "emergency"]),
      reason: z.string().describe("Why escalate (safety, recurrence, compliance, unresolved) or why not"),
    }),
  }),
  studentStatusMessage: z.string().describe("Plain-language message back to the student who reported it"),
  closureVerificationQuestion: z
    .string()
    .describe("The yes/no question to ask the reporter later to confirm reality actually changed"),
});

export type FieldIntelligenceReport = z.infer<typeof ReportSchema>;
