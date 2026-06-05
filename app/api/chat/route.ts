import { NextRequest, NextResponse } from "next/server";
import { getWorkOrders } from "@/lib/data";
import { chatReply, type ChatTurn } from "@/lib/ai/chat";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const messages: ChatTurn[] = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "messages must end with a user turn" }, { status: 400 });
  }
  // Keep payloads bounded — only the recent turns matter for this assistant.
  const trimmed = messages.slice(-10);
  const demo = body?.demo === true || body?.demo === "1";

  try {
    // Pull the work-order data server-side so the answer is grounded in the
    // same data the dashboard renders (and the API key never leaves the server).
    const { workOrders } = await getWorkOrders(demo);
    const reply = await chatReply({ messages: trimmed, workOrders });
    return NextResponse.json({ reply });
  } catch (err) {
    const message = (err as Error).message || "Chat failed";
    const status = /api key|authentication/i.test(message) ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
