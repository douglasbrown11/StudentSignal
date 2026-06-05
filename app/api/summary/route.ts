import { NextRequest, NextResponse } from "next/server";
import { getWorkOrders } from "@/lib/data";
import { groupByCategory, summaryCounts } from "@/lib/select";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const demo = req.nextUrl.searchParams.get("demo") === "1";
  const { workOrders, liveError } = await getWorkOrders(demo);
  return NextResponse.json({
    counts: summaryCounts(workOrders),
    categories: groupByCategory(workOrders),
    liveError,
  });
}
