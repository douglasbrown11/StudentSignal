// Dashboard assistant: a fast, grounded chatbot (Claude Haiku 4.5) that answers
// questions about the CURRENT work orders on screen — what's most critical and
// why, what to prioritize, likely fixes. It only reasons over the work-order
// data we hand it; it never invents records.

import Anthropic from "@anthropic-ai/sdk";
import { summaryCounts, topBuildings, isOpen } from "../select";
import type { WorkOrder } from "../types";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM = `You are the on-screen assistant for "StudentSignals", a school-district facilities work-order dashboard.

Your job: help a busy facilities operator or student quickly UNDERSTAND the work orders currently on screen — which one is most critical and WHY, what to tackle first, what a likely fix or next step is, and what patterns to notice.

Rules:
- Ground every answer in the WORK ORDER DATA provided below. Do not invent work orders, assets, dates, or numbers.
- When asked what's "most critical", reason out loud briefly using priority, overdue status, severity, category (fire & life safety / electrical outrank cosmetic), and how many people are affected. Name the specific work order(s).
- Be concise and skimmable. Prefer 2-4 short sentences or a tight bullet list. No preamble, no "as an AI".
- For "solutions", give practical, generic facilities guidance (a likely cause + a sensible first step + who should own it). Be clear it's a suggestion, not a guarantee.
- If the data doesn't support an answer, say what's missing instead of guessing.`;

function compactContext(workOrders: WorkOrder[]): string {
  const counts = summaryCounts(workOrders);
  const buildings = topBuildings(workOrders, 5);

  // Open orders first, sorted so the most pressing are at the top (and most
  // likely to survive any truncation), then a few recently-Done for context.
  const prio = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const open = workOrders
    .filter(isOpen)
    .sort(
      (a, b) =>
        Number(b.isOverdue) - Number(a.isOverdue) ||
        (prio[a.priority] ?? 9) - (prio[b.priority] ?? 9),
    );
  const ordered = [...open, ...workOrders.filter((w) => !isOpen(w))].slice(0, 60);

  const rows = ordered.map((w) => ({
    title: w.title,
    status: w.status,
    priority: w.priority,
    severity: w.severity,
    category: w.category,
    building: w.location?.name ?? null,
    due: w.dueDate ? w.dueDate.slice(0, 10) : null,
    overdue: w.isOverdue,
    asset: w.assets[0]?.name ?? null,
    assetStatus: w.assets[0]?.status ?? null,
    studentSignals: w.signals.map((s) => s.text),
  }));

  return JSON.stringify(
    {
      summary: counts,
      topBuildingsByOpen: buildings.map((b) => ({ name: b.name, open: b.openCount })),
      workOrders: rows,
    },
    null,
    2,
  );
}

export async function chatReply(args: {
  messages: ChatTurn[];
  workOrders: WorkOrder[];
}): Promise<string> {
  const { messages, workOrders } = args;

  const context = compactContext(workOrders);
  // Prepend the live data to the first user turn so it stays grounded.
  const convo: ChatTurn[] = messages.map((m, i) =>
    i === 0 && m.role === "user"
      ? { role: "user", content: `WORK ORDER DATA (the dashboard the user is looking at):\n\n${context}\n\n---\n\nQuestion: ${m.content}` }
      : m,
  );

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 700,
    system: SYSTEM,
    messages: convo,
  });

  return message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
