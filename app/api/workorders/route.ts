import { NextRequest, NextResponse } from "next/server";
import { getWorkOrders } from "@/lib/data";
import { filterWorkOrders } from "@/lib/select";
import { addUserWorkOrder, type NewWorkOrderInput } from "@/lib/workorders-store";
import { addSignal } from "@/lib/signals";

export const dynamic = "force-dynamic";

const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES = ["Open", "In Progress", "Done"];

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

// Create a user-entered work order (persisted locally, merged into every view).
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = (body?.title ?? "").toString().trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!body?.category) return NextResponse.json({ error: "category is required" }, { status: 400 });
  if (!PRIORITIES.includes(body?.priority)) {
    return NextResponse.json({ error: "priority must be one of " + PRIORITIES.join(", ") }, { status: 400 });
  }
  if (body?.status && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const input: NewWorkOrderInput = {
    title,
    description: body?.description ?? null,
    category: body.category,
    priority: body.priority,
    severity: body?.severity ?? null,
    status: body?.status ?? "Open",
    locationId: body?.locationId ?? null,
    locationName: body?.locationName ?? null,
    locationAddress: body?.locationAddress ?? null,
    assetName: body?.assetName ?? null,
    dueDate: body?.dueDate ?? null,
  };

  try {
    const workOrder = await addUserWorkOrder(input);

    // Attribute the submitter as the first student signal, so it shows up in the
    // detail panel and as a row badge — reusing the existing signal mechanism.
    const reporter = (body?.reporterName ?? "").toString().trim();
    if (reporter) {
      await addSignal({ workOrderId: workOrder.id, text: "Submitted this work order.", studentName: reporter });
    }

    return NextResponse.json({ workOrder }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || "Failed to create work order" }, { status: 500 });
  }
}
