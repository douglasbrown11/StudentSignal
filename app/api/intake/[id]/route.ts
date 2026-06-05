import { NextRequest, NextResponse } from "next/server";
import { getReport, setClosure } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const report = await getReport(params.id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json({ report });
}

// Student closure loop — confirm whether reality actually changed.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (typeof body?.resolved !== "boolean") {
    return NextResponse.json({ error: "resolved (boolean) is required" }, { status: 400 });
  }
  const updated = await setClosure(params.id, {
    resolved: body.resolved,
    comment: typeof body.comment === "string" ? body.comment : null,
  });
  if (!updated) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json({ report: updated });
}
