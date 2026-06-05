import { NextRequest, NextResponse } from "next/server";
import { addSignal, listSignals } from "@/lib/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ signals: await listSignals() });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { workOrderId, text, studentName } = body ?? {};
  if (!workOrderId || typeof workOrderId !== "string") {
    return NextResponse.json({ error: "workOrderId is required" }, { status: 400 });
  }
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  try {
    const signal = await addSignal({ workOrderId, text, studentName });
    return NextResponse.json({ signal }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
