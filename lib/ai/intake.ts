// The AI layer: turn a raw field observation (+ work-order/asset/location context
// + public data) into a structured, compliance-aware, action-ready Field
// Intelligence Report. One structured Claude call (Sonnet 4.6, adaptive thinking,
// Zod-validated output) — no free-text parsing.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ReportSchema, type FieldIntelligenceReport } from "./schema";
import type { PublicDataResult } from "../publicdata";
import type { WorkOrder } from "../types";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export interface FieldObservation {
  text: string;
  locationDetail?: string;
  when?: string;
  stillHappening?: string;
  whoAffected?: string;
  disruption?: string;
  happenedBefore?: string;
  photoNote?: string;
  photoBase64?: string;
  photoMimeType?: string;
}

const SYSTEM = `You are a facilities field-intelligence analyst for a school district / public-agency facilities team.

A work order is only a record of what someone managed to capture. The real signal starts in the field — with the student, teacher, custodian, or resident who experiences the issue before the system understands it. Your job is to turn messy human input into clean operational data that a facilities team can actually act on.

Principles:
- Be specific and operational. Turn vague reports into concrete, checkable items.
- Be honest about what is still unknown. Name the missing information and the evidence quality plainly. Never invent details the report does not support.
- Translate public data into operational MEANING, not counts. "Found 3 violations" is useless; "this issue pattern recurs in similar buildings and should be linked to compliance history before closure" is useful. Only reference public records that are provided to you. If none are provided, say what to check and where, without fabricating specific records.
- Identify the obligations the issue lives inside (fire code, building code, inspection requirements, manufacturer/insurer requirements, district SOPs). This is not legal advice — it is what the operator should see before they close the work order.
- Recommend a concrete workflow and a clear escalation decision. Escalate when there is a safety, recurrence, compliance, or unresolved-status reason.
- The student who reported it must not disappear after intake. Write them a warm, plain-language status message, and produce a single yes/no closure-verification question to ask them later to confirm reality actually changed.

WRITE FOR A BUSY OPERATOR ON A PHONE. Be ruthlessly concise:
- Lead with a scannable headline and a single "bottom line" sentence (what to do now, by when).
- Every list item is a short phrase or one imperative line — never a paragraph. Respect the "at most N" limits in the schema; fewer, sharper items beat long lists.
- No hedging, no restating the question, no filler. Plain language a 9th grader reads in seconds.

Respond ONLY by populating the required structured fields.`;

function block(label: string, value: unknown): string {
  return `### ${label}\n${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`;
}

export async function generateReport(args: {
  observation: FieldObservation;
  workOrder: WorkOrder | null;
  publicData: PublicDataResult;
}): Promise<FieldIntelligenceReport> {
  const { observation, workOrder, publicData } = args;

  const woContext = workOrder
    ? {
        title: workOrder.title,
        description: workOrder.description,
        status: workOrder.status,
        priority: workOrder.priority,
        severity: workOrder.severity,
        category: workOrder.category,
        dueDate: workOrder.dueDate,
        isOverdue: workOrder.isOverdue,
        location: workOrder.location,
        assets: workOrder.assets,
        existingSignals: workOrder.signals.map((s) => s.text),
      }
    : "(No existing work order — this is a brand-new field observation.)";

  const textContent = [
    "Produce a Field Intelligence Report for the following.",
    "",
    block("EXISTING WORK ORDER + LINKED ASSET/LOCATION CONTEXT", woContext),
    "",
    block("FIELD OBSERVATION (raw human report)", {
      whatHappened: observation.text,
      whereExactly: observation.locationDetail || "(not specified)",
      when: observation.when || "(not specified)",
      stillHappening: observation.stillHappening || "(not specified)",
      whoAffected: observation.whoAffected || "(not specified)",
      howDisruptive: observation.disruption || "(not specified)",
      hasHappenedBefore: observation.happenedBefore || "(not specified)",
      photoOrNote: observation.photoBase64
        ? "A photo has been attached — analyze it carefully and incorporate visible details into your assessment."
        : observation.photoNote || "(none)",
    }),
    "",
    block("PUBLIC DATA AVAILABLE (NYC 311 open data — citywide pattern data, may not be this exact building)", {
      source: publicData.source,
      query: publicData.query,
      note: publicData.note,
      records: publicData.records,
    }),
  ].join("\n");

  // Build message content — include the photo as a vision block if provided.
  type SupportedMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  const SUPPORTED_MIMES: SupportedMime[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const rawMime = observation.photoMimeType ?? "image/jpeg";
  const safeMime: SupportedMime = (SUPPORTED_MIMES as string[]).includes(rawMime)
    ? (rawMime as SupportedMime)
    : "image/jpeg";

  const userContentBlocks: Anthropic.MessageParam["content"] = [];
  if (observation.photoBase64) {
    (userContentBlocks as any[]).push({
      type: "image",
      source: { type: "base64", media_type: safeMime, data: observation.photoBase64 },
    });
  }
  (userContentBlocks as any[]).push({ type: "text", text: textContent });

  const message = await client.messages.parse({
    model: "claude-sonnet-4-6",
    max_tokens: 6000,
    thinking: { type: "adaptive" },
    system: SYSTEM,
    messages: [{ role: "user" as const, content: userContentBlocks }],
    output_config: { format: zodOutputFormat(ReportSchema), effort: "medium" },
  });

  if (!message.parsed_output) {
    throw new Error("The model did not return a parseable Field Intelligence Report.");
  }
  return message.parsed_output;
}
