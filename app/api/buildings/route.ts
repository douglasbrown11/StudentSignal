import { NextRequest, NextResponse } from "next/server";
import { getWorkOrders } from "@/lib/data";
import { topBuildings } from "@/lib/select";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const demo = req.nextUrl.searchParams.get("demo") === "1";
  const limit = Number(req.nextUrl.searchParams.get("limit")) || 5;
  const { workOrders, liveError } = await getWorkOrders(demo);
  return NextResponse.json({ buildings: topBuildings(workOrders, limit), liveError });
}
