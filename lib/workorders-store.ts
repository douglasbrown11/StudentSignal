// Local persistence for USER-created work orders (data/workorders.json). These
// are work orders a student/operator adds from the dashboard — stored in the
// same normalized WorkOrder DTO shape as live/demo data (source: "user") and
// merged into getWorkOrders so every view treats them like any other record.

import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import type { Priority, Status, WorkOrder } from "./types";

const FILE = path.join(process.cwd(), "data", "workorders.json");

async function readAll(): Promise<WorkOrder[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(all: WorkOrder[]): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(all, null, 2));
}

export async function listUserWorkOrders(): Promise<WorkOrder[]> {
  return readAll();
}

export interface NewWorkOrderInput {
  title: string;
  description?: string | null;
  category: string;
  priority: Priority;
  severity?: string | null;
  status?: Status;
  locationId?: string | null;
  locationName?: string | null;
  locationAddress?: string | null;
  assetName?: string | null;
  dueDate?: string | null; // ISO (date or datetime)
}

const STAGE_FOR: Record<Status, string> = {
  Open: "To Do",
  "In Progress": "In Progress",
  Done: "Done",
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "location";
}

export async function addUserWorkOrder(input: NewWorkOrderInput): Promise<WorkOrder> {
  const title = (input.title ?? "").trim();
  if (!title) throw new Error("title is required");
  if (!input.category) throw new Error("category is required");
  if (!input.priority) throw new Error("priority is required");

  const now = Date.now();
  const id = `user-${randomUUID()}`;
  const status: Status = input.status ?? "Open";
  const dueDate = input.dueDate ? new Date(input.dueDate).toISOString() : null;

  const locName = input.locationName?.trim() || null;
  const location = input.locationId || locName
    ? {
        id: input.locationId?.trim() || `user-loc-${slug(locName ?? id)}`,
        name: locName,
        address: input.locationAddress?.trim() || null,
      }
    : null;

  const assetName = input.assetName?.trim() || null;

  const wo: WorkOrder = {
    id,
    title,
    description: input.description?.trim() || null,
    status,
    stageName: STAGE_FOR[status],
    priority: input.priority,
    severity: (input.severity?.trim() as string) || input.priority,
    category: input.category,
    createdAt: new Date(now).toISOString(),
    dueDate,
    isOverdue: status !== "Done" && !!dueDate && new Date(dueDate).getTime() < now,
    location,
    assets: assetName
      ? [{ id: `${id}-asset`, name: assetName, status: null, lastServiceDate: null }]
      : [],
    assigneeIds: [],
    source: "user",
    signals: [],
  };

  const all = await readAll();
  all.push(wo);
  await writeAll(all);
  return wo;
}
