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
  structured: z
    .object({
      issueType: z.string().describe("Concise issue classification, e.g. 'Emergency lighting / egress safety'"),
      locationDetail: z.string().describe("The most specific location the report supports"),
      assetCategory: z.enum(ASSET_CATEGORIES),
      severity: z.enum(["low", "medium", "high", "critical"]),
      urgency: z.enum(["immediate", "same_day", "this_week", "routine"]),
      affectedUsers: z.string().describe("Who is impacted and roughly how many"),
      evidenceQuality: z.enum(["none", "weak", "moderate", "strong"]),
      likelyRootCauses: z.array(z.string()).describe("Candidate root-cause categories, most likely first"),
      missingInformation: z.array(z.string()).describe("What the system still does not know"),
      followUpQuestions: z.array(z.string()).describe("Short questions to ask the reporter to close gaps"),
    })
    .describe("The raw signal structured into operational data"),
  cleanedDescription: z.string().describe("A clear, operator-ready rewrite of the work-order description"),
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
        obligation: z.string().describe("The rule/inspection/standard implicated"),
        source: z.string().describe("Where it comes from, e.g. 'NYC Fire Code', 'NFPA 101', 'DOB'"),
        why: z.string().describe("Why this issue touches that obligation"),
      }),
    )
    .describe("Obligations the issue lives inside — not legal advice, but what to check before closing"),
  operationalImplications: z.array(z.string()).describe("Downstream/operational consequences if unaddressed"),
  recommendedWorkflow: z.object({
    suggestedNextActions: z.array(z.string()).describe("Ordered, concrete next steps for the operator"),
    suggestedAssignmentGroup: z.string().describe("Which team/trade should own this"),
    evidenceChecklist: z.array(z.string()).describe("Evidence to collect to confirm/close the issue"),
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
