import { NextRequest, NextResponse } from "next/server";
import { getWorkOrders } from "@/lib/data";
import { filterWorkOrders } from "@/lib/select";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const demo = searchParams.get("demo") === "1";
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const buildingId = searchParams.get("buildingId");
  const category = searchParams.get("category");

  const { workOrders, liveError } = await getWorkOrders(demo);
  const filtered = filterWorkOrders(workOrders, { status, priority, buildingId, category });

  return NextResponse.json({ workOrders: filtered, total: filtered.length, liveError });
}
