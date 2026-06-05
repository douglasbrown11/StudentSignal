import { NextRequest, NextResponse } from "next/server";
import { getWorkOrder } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const demo = req.nextUrl.searchParams.get("demo") === "1";
  const workOrder = await getWorkOrder(params.id, demo);
  if (!workOrder) {
    return NextResponse.json({ error: "Work order not found" }, { status: 404 });
  }
  return NextResponse.json({ workOrder });
}
