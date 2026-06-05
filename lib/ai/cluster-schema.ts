// Zod schema for the "Portfolio Cluster Analysis" — what the model produces when
// asked to treat a group of similar work orders across several buildings as ONE
// coordinated problem instead of N isolated tickets. Same zod/v4 import rule as
// schema.ts (zodOutputFormat resolves zod from "zod/v4").

import * as z from "zod/v4";

export const ClusterAnalysisSchema = z.object({
  headline: z.string().describe("Scannable 6-12 word headline framing the cross-building pattern"),
  bottomLine: z.string().describe("ONE sentence: the single coordinated action to take now and who owns it"),
  isSystemic: z
    .boolean()
    .describe("True if these look like one underlying/portfolio problem worth handling together, false if they're coincidentally similar"),
  pattern: z.string().describe("2-3 sentences: what these work orders have in common and why treating them together helps"),
  sharedRootCauses: z.array(z.string()).describe("At MOST 3 plausible shared root causes. Short phrases."),
  consolidatedActions: z
    .array(z.string())
    .describe("3-5 concrete steps to resolve the group efficiently (e.g. one vendor visit, one bulk order, one inspection sweep). Short imperative lines."),
  prioritizedBuildings: z
    .array(
      z.object({
        building: z.string().describe("Building name"),
        priority: z.enum(["first", "soon", "later"]),
        why: z.string().describe("One short phrase: why this order"),
      }),
    )
    .describe("The buildings in this cluster, ordered by which to address first"),
  efficiencyGain: z.string().describe("One sentence: the concrete benefit of batching vs. handling each ticket separately"),
  recommendedOwner: z.string().describe("Which team/role should own the coordinated response"),
  escalation: z.object({
    shouldEscalate: z.boolean(),
    level: z.enum(["none", "standard", "urgent", "emergency"]),
    reason: z.string().describe("Why escalate (safety, recurrence, compliance, scale) or why not"),
  }),
});

export type ClusterAnalysis = z.infer<typeof ClusterAnalysisSchema>;
