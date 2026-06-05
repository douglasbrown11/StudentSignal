import { NextRequest, NextResponse } from "next/server";
import { draftWorkOrder } from "@/lib/ai/draft";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const description: string = (body?.description ?? "").toString();
  if (description.trim().length < 10) {
    return NextResponse.json(
      { error: "Add a bit more detail (at least a sentence) so AI can fill in the fields." },
      { status: 400 },
    );
  }
  const buildingNames: string[] = Array.isArray(body?.buildingNames)
    ? body.buildingNames.filter((s: unknown) => typeof s === "string")
    : [];

  try {
    const draft = await draftWorkOrder({ description, buildingNames });
    return NextResponse.json({ draft });
  } catch (err) {
    const message = (err as Error).message || "Failed to draft work order";
    const status = /api key|authentication/i.test(message) ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
