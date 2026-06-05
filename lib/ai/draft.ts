// AI autofill for new work orders: take a free-text description (what the user
// typed) and propose clean, structured fields they can review/edit before
// submitting. One structured Claude call (Sonnet 4.6, low effort — it's a fast
// extraction, not deep analysis).

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { WorkOrderDraftSchema, type WorkOrderDraft } from "./draft-schema";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const SYSTEM = `You convert a person's plain-language description of a facilities problem into a clean, structured work order for a school-district facilities team.

Rules:
- Infer the best title, service category, priority, and severity from what's actually described. Fire/life-safety, electrical hazards, and anything blocking safe egress or occupancy lean higher priority.
- Rewrite the description so an operator can act on it: specific and concrete, but DON'T invent details (rooms, dates, model numbers) the report doesn't contain.
- For location and asset: only fill them in if the report names them. If a provided building name matches what they described, use that exact name. Otherwise null.
- Pick suggestedDueInDays from urgency, not optimism: immediate hazards = 0, same-day = 1, this-week = 7, routine = 30.
- Set confidence honestly and, if the report is thin, list the few things the user should add. Never block on missing info — always return a usable draft.

Respond ONLY by populating the required structured fields.`;

export async function draftWorkOrder(args: {
  description: string;
  buildingNames?: string[];
}): Promise<WorkOrderDraft> {
  const { description, buildingNames = [] } = args;

  const userContent = [
    "Draft a work order from this report:",
    "",
    description.trim(),
    "",
    buildingNames.length
      ? `Known building names you may match against: ${buildingNames.join(", ")}`
      : "No known building names provided.",
  ].join("\n");

  const message = await client.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user", content: userContent }],
    output_config: { format: zodOutputFormat(WorkOrderDraftSchema), effort: "low" },
  });

  if (!message.parsed_output) {
    throw new Error("The model did not return a parseable work-order draft.");
  }
  return message.parsed_output;
}
