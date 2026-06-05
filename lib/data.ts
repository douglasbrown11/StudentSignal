// Aggregation layer: fetch live work orders, normalize them, optionally merge
// demo data, and hydrate each with its student signals. Shared by API routes.

import { caQuery, CAError } from "./ca/client";
import { LIST_WORK_ORDERS } from "./ca/queries";
import { mockWorkOrders } from "./mock";
import { normalizeWorkOrder } from "./normalize";
import { groupSignals, listSignals } from "./signals";
import { listUserWorkOrders } from "./workorders-store";
import type { WorkOrder } from "./types";

export interface WorkOrdersResult {
  workOrders: WorkOrder[];
  liveError: string | null;
}

export async function getWorkOrders(demo: boolean): Promise<WorkOrdersResult> {
  const signals = await listSignals();
  const byWo = groupSignals(signals);
  const hydrate = (w: WorkOrder): WorkOrder => ({ ...w, signals: byWo.get(w.id) ?? [] });

  let live: WorkOrder[] = [];
  let liveError: string | null = null;

  try {
    const data = await caQuery<{ workOrders: { nodes: any[] } }>(LIST_WORK_ORDERS, {
      limit: 100,
      offset: 0,
    });
    live = (data.workOrders?.nodes ?? []).map((n) => hydrate(normalizeWorkOrder(n)));
  } catch (err) {
    liveError = err instanceof CAError ? err.message : (err as Error).message;
  }

  // User-created work orders are the operator's own real records — always shown,
  // regardless of the demo toggle. Newest first so a just-added one is visible.
  const userOrders = (await listUserWorkOrders())
    .map(hydrate)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  const demoOrders = demo ? mockWorkOrders().map(hydrate) : [];

  return { workOrders: [...userOrders, ...live, ...demoOrders], liveError };
}

export async function getWorkOrder(id: string, demo: boolean): Promise<WorkOrder | null> {
  const { workOrders } = await getWorkOrders(demo);
  return workOrders.find((w) => w.id === id) ?? null;
}
