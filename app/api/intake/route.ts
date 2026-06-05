import { NextRequest, NextResponse } from "next/server";
import { getWorkOrder } from "@/lib/data";
import { generateReport, type FieldObservation } from "@/lib/ai/intake";
import { fetchPublicData } from "@/lib/publicdata";
import { addReport, listReports } from "@/lib/reports";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // the AI call can take a while

export async function GET() {
  return NextResponse.json({ reports: await listReports() });
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const observation: FieldObservation = body?.observation ?? {};
  if (!observation.text || !observation.text.trim()) {
    return NextResponse.json({ error: "observation.text is required" }, { status: 400 });
  }

  const workOrderId: string | null = body?.workOrderId ?? null;
  const demo = body?.demo === true || body?.demo === "1";

  // Resolve work-order context (if any).
  const workOrder = workOrderId ? await getWorkOrder(workOrderId, demo) : null;

  // Category drives the public-data lookup: prefer the WO category, else a hint.
  const category = workOrder?.category ?? body?.categoryHint ?? "general";

  try {
    const publicData = await fetchPublicData(category);
    const report = await generateReport({ observation, workOrder, publicData });

    const saved = await addReport({
      workOrderId,
      workOrderTitle: workOrder?.title ?? null,
      studentName: body?.studentName ?? null,
      observation,
      report,
    });

    return NextResponse.json({ id: saved.id, report, publicData, workOrder }, { status: 201 });
  } catch (err) {
    const message = (err as Error).message || "Failed to generate report";
    const status = /api key|authentication/i.test(message) ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
