import { NextRequest, NextResponse } from "next/server";
import { getWorkOrders } from "@/lib/data";
import { generateClusterAnalysis } from "@/lib/ai/cluster";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const ids: string[] = Array.isArray(body?.workOrderIds) ? body.workOrderIds : [];
  if (ids.length < 2) {
    return NextResponse.json({ error: "Need at least 2 work orders to analyze a cluster" }, { status: 400 });
  }
  const demo = body?.demo === true || body?.demo === "1";

  try {
    // Resolve the work orders server-side from the same data source the
    // dashboard reads, so the analysis is grounded in real records.
    const { workOrders } = await getWorkOrders(demo);
    const idSet = new Set(ids);
    const selected = workOrders.filter((w) => idSet.has(w.id));
    if (selected.length < 2) {
      return NextResponse.json({ error: "Could not resolve the selected work orders" }, { status: 404 });
    }
    const category = body?.category ?? selected[0].category;
    const analysis = await generateClusterAnalysis({ category, workOrders: selected });
    return NextResponse.json({ analysis }, { status: 200 });
  } catch (err) {
    const message = (err as Error).message || "Failed to analyze cluster";
    const status = /api key|authentication/i.test(message) ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
