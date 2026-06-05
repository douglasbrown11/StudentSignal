// The AI layer for the "group similar work orders across buildings" workflow:
// take a cluster of related work orders and decide whether it's a single
// coordinated/systemic problem, and how to resolve it as one efficient response.
// One structured Claude call (Sonnet 4.6, adaptive thinking, Zod-validated).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ClusterAnalysisSchema, type ClusterAnalysis } from "./cluster-schema";
import type { WorkOrder } from "../types";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM = `You are a facilities portfolio analyst for a school district / public-agency facilities team.

You are handed a GROUP of similar open work orders that span SEVERAL buildings. Your job is to decide whether they should be handled as ONE coordinated response instead of many separate tickets — and if so, how to do it efficiently.

Think like an operator who controls a budget and a small crew:
- Is this actually one underlying pattern (same failing part, same aging system, same vendor, same compliance deadline), or just coincidentally the same category? Be honest — set isSystemic accordingly.
- If coordinated action helps, say exactly how to batch it: one vendor mobilization, one bulk parts order, one inspection sweep, one shared root-cause fix.
- Order the buildings by which to address first, using safety, overdue status, priority, and how many people are affected.
- Make the efficiency win concrete (fewer truck rolls, one PO, one inspection vs. several).
- Decide escalation: escalate for safety, recurrence, compliance, or scale.

WRITE FOR A BUSY OPERATOR. Be ruthlessly concise: a scannable headline, one bottom-line action, short phrases in lists (respect the "at most N" limits), no filler. Ground everything in the work orders provided — do not invent buildings, parts, or dates.

Respond ONLY by populating the required structured fields.`;

export async function generateClusterAnalysis(args: {
  category: string;
  workOrders: WorkOrder[];
}): Promise<ClusterAnalysis> {
  const { category, workOrders } = args;

  const items = workOrders.map((w) => ({
    title: w.title,
    building: w.location?.name ?? w.location?.id ?? "(unknown)",
    priority: w.priority,
    severity: w.severity,
    status: w.status,
    due: w.dueDate ? w.dueDate.slice(0, 10) : null,
    overdue: w.isOverdue,
    asset: w.assets[0]?.name ?? null,
    assetStatus: w.assets[0]?.status ?? null,
    description: w.description,
    studentSignals: w.signals.map((s) => s.text),
  }));

  const userContent = [
    `Analyze this cluster of ${workOrders.length} open "${category.replace(/_/g, " ")}" work orders across ${new Set(workOrders.map((w) => w.location?.id)).size} buildings.`,
    "",
    "WORK ORDERS IN THE CLUSTER:",
    JSON.stringify(items, null, 2),
  ].join("\n");

  const message = await client.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: userContent }],
    output_config: { format: zodOutputFormat(ClusterAnalysisSchema), effort: "medium" },
  });

  if (!message.parsed_output) {
    throw new Error("The model did not return a parseable cluster analysis.");
  }
  return message.parsed_output;
}
